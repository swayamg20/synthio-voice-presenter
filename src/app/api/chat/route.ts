import type {
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { getOpenAIClient } from "@/lib/openai-client";
import {
  buildChatSystemPrompt,
  buildContinueSystemPrompt,
} from "@/lib/prompts";
import {
  sseEvent,
  extractSpokenTextSoFar,
  extractCompleteSentences,
} from "@/lib/sse";
import { toolDefinitions } from "@/lib/tool-registry";
import type {
  ChatRequest,
  HistoryEntry,
  ToolCall,
  UserExpertise,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function historyToMessages(
  entry: HistoryEntry,
): ChatCompletionMessageParam[] {
  const metaParts = [
    `type=${entry.metadata.type}`,
    `slide=${entry.metadata.slide}`,
    entry.metadata.interrupted ? "interrupted=true" : null,
    entry.metadata.spokenUpTo
      ? `spoken_up_to="${entry.metadata.spokenUpTo}"`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const contextMessage: ChatCompletionMessageParam = {
    role: "system",
    content: `[context] The following ${entry.role} message was ${metaParts}.`,
  };

  const contentMessage: ChatCompletionMessageParam = entry.role === "assistant"
    ? { role: "assistant", content: entry.content }
    : { role: "user", content: entry.content };

  return [contextMessage, contentMessage];
}

function isContinueIntent(transcript: string): boolean {
  return /\b(continue|go on|keep going|resume|carry on|move on|yes|yep|ok|okay)\b/i.test(
    transcript,
  );
}

function formatCurrentRequest(body: ChatRequest): string {
  const lines = [
    `User transcript: ${body.transcript}`,
    `Current slide: ${body.currentSlide}`,
  ];

  if (body.interruptContext) {
    lines.push(
      "Interrupt context:",
      `- Was narrating: ${body.interruptContext.wasNarrating}`,
      `- Slide being narrated: ${body.interruptContext.slideBeingNarrated}`,
      `- Spoken so far: ${
        body.interruptContext.spokenSoFar.length > 0
          ? body.interruptContext.spokenSoFar.join(" ")
          : "nothing"
      }`,
    );
  }

  if (body.zoneContext) {
    lines.push(
      "Zone context:",
      `- Zone id: ${body.zoneContext.zoneId}`,
      `- Label: ${body.zoneContext.zoneLabel}`,
      `- Description: ${body.zoneContext.zoneDescription}`,
      "The user long-pressed this zone. Explain it and highlight it.",
    );
  }

  return lines.join("\n");
}

function getSpokenContext(body: ChatRequest): {
  slideNumber: number;
  spokenSoFar: string[];
} {
  if (body.interruptContext?.spokenSoFar.length) {
    return {
      slideNumber: body.interruptContext.slideBeingNarrated,
      spokenSoFar: body.interruptContext.spokenSoFar,
    };
  }

  const interruptedNarration = [...(body.conversationHistory ?? [])]
    .reverse()
    .find(
      (entry) =>
        entry.role === "assistant" &&
        entry.metadata.type === "narration" &&
        entry.metadata.interrupted &&
        entry.metadata.spokenUpTo,
    );

  if (interruptedNarration?.metadata.spokenUpTo) {
    return {
      slideNumber: interruptedNarration.metadata.slide,
      spokenSoFar: [interruptedNarration.metadata.spokenUpTo],
    };
  }

  return {
    slideNumber: body.currentSlide,
    spokenSoFar: [],
  };
}

const VALID_EXPERTISE_LEVELS = new Set<UserExpertise>(["beginner", "intermediate", "expert"]);

// ---------- Tool call tracking ----------

type StreamingToolCall = {
  index: number;
  id: string;
  name: string;
  arguments: string;
};

export async function POST(request: Request) {
  let body: ChatRequest;

  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.transcript || !Number.isInteger(body.currentSlide)) {
    return Response.json(
      { error: "transcript and currentSlide are required." },
      { status: 400 },
    );
  }

  try {
    const spokenContext = getSpokenContext(body);
    const spokenSoFar = spokenContext.spokenSoFar;
    const continuationPrompt =
      isContinueIntent(body.transcript) && spokenSoFar.length > 0
        ? buildContinueSystemPrompt(spokenContext.slideNumber, spokenSoFar)
        : null;

    const systemPrompt = [
      buildChatSystemPrompt(body.currentSlide, spokenSoFar),
      continuationPrompt,
    ]
      .filter(Boolean)
      .join("\n\n");

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(body.conversationHistory ?? []).flatMap(historyToMessages),
      { role: "user", content: formatCurrentRequest(body) },
    ];

    console.log(`[Chat] System prompt length: ${systemPrompt.length} chars`);
    console.log(`[Chat] Messages count: ${messages.length}`);

    const stream = await getOpenAIClient().chat.completions.create({
      model: "gpt-5.4-mini",
      messages,
      tools: toolDefinitions,
      tool_choice: "required",
      temperature: 0.68,
      max_completion_tokens: 650,
      stream: true,
    });

    // Track streaming state
    const toolCalls: Map<number, StreamingToolCall> = new Map();
    let emittedSentenceOffset = 0;
    const emittedToolCalls: ToolCall[] = [];
    let messageContent = "";

    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (request.signal.aborted) break;

            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            // Accumulate message content (fallback if no tool calls)
            if (delta.content) {
              messageContent += delta.content;
            }

            // Process tool call deltas
            if (delta.tool_calls) {
              for (const tcDelta of delta.tool_calls) {
                const idx = tcDelta.index;

                if (!toolCalls.has(idx)) {
                  toolCalls.set(idx, {
                    index: idx,
                    id: tcDelta.id ?? "",
                    name: tcDelta.function?.name ?? "",
                    arguments: "",
                  });
                }

                const tc = toolCalls.get(idx)!;

                if (tcDelta.id) tc.id = tcDelta.id;
                if (tcDelta.function?.name) tc.name = tcDelta.function.name;
                if (tcDelta.function?.arguments) {
                  tc.arguments += tcDelta.function.arguments;
                }

                // For the respond tool, extract sentences as they stream
                if (tc.name === "respond") {
                  const spokenText = extractSpokenTextSoFar(tc.arguments);
                  if (spokenText.length > 0) {
                    const { sentences, newOffset } = extractCompleteSentences(
                      spokenText,
                      emittedSentenceOffset,
                    );

                    for (const sentence of sentences) {
                      console.log(`[Chat] Streaming sentence: "${sentence}"`);
                      controller.enqueue(sseEvent("sentence", { text: sentence }));
                    }

                    if (newOffset > emittedSentenceOffset) {
                      emittedSentenceOffset = newOffset;
                    }
                  }
                }
              }
            }
          }

          // Stream ended — process completed tool calls

          // Emit remaining spoken text from the respond tool
          let respondArgs: Record<string, unknown> | null = null;

          for (const tc of Array.from(toolCalls.values())) {
            if (tc.name === "respond") {
              try {
                respondArgs = JSON.parse(tc.arguments) as Record<string, unknown>;
                const fullSpokenText = (respondArgs.spoken_text as string) ?? "";

                // Emit any remaining text after the last sentence boundary
                const remainingText = fullSpokenText.slice(emittedSentenceOffset).trim();
                if (remainingText) {
                  console.log(`[Chat] Final sentence fragment: "${remainingText}"`);
                  controller.enqueue(sseEvent("sentence", { text: remainingText }));
                }
              } catch (error) {
                console.warn("[Chat] Failed to parse respond tool arguments.", error);
              }
            } else {
              // Non-respond tool calls (navigate_to_slide, highlight_zone)
              try {
                const args = JSON.parse(tc.arguments) as Record<string, unknown>;
                const toolCall: ToolCall = { name: tc.name, args };
                emittedToolCalls.push(toolCall);
                console.log(`[Chat] Tool call: ${tc.name}`, args);
                controller.enqueue(sseEvent("tool_call", toolCall));
              } catch (error) {
                console.warn(`[Chat] Failed to parse ${tc.name} tool arguments.`, error);
              }
            }
          }

          // If no respond tool was called, emit content as a sentence
          if (!respondArgs && messageContent.trim()) {
            console.log(`[Chat] No respond tool — using message content as speech`);
            controller.enqueue(sseEvent("sentence", { text: messageContent.trim() }));
          }

          // If no respond tool and no content, emit a fallback
          if (!respondArgs && !messageContent.trim() && emittedSentenceOffset === 0) {
            const fallbackText = emittedToolCalls.some(tc => tc.name === "navigate_to_slide")
              ? "Sure, let me show you that."
              : emittedToolCalls.some(tc => tc.name === "highlight_zone")
                ? "Let me point to the specific part of the diagram."
                : "I can continue from here.";
            controller.enqueue(sseEvent("sentence", { text: fallbackText }));
          }

          // Build the complete event
          const followUps = (respondArgs?.follow_ups as string[]) ?? [];
          const rawExpertise = (respondArgs?.expertise_assessment as string)?.toLowerCase() as UserExpertise | undefined;
          const expertiseAssessment = rawExpertise && VALID_EXPERTISE_LEVELS.has(rawExpertise)
            ? rawExpertise
            : undefined;

          const completeData = {
            followUps,
            expertiseAssessment,
            toolCalls: emittedToolCalls,
          };

          console.log(`[Chat] Stream complete:`, JSON.stringify(completeData, null, 2));
          controller.enqueue(sseEvent("complete", completeData));
        } catch (error) {
          if (!request.signal.aborted) {
            console.error("[Chat] Stream processing error.", error);
            controller.enqueue(
              sseEvent("error", { message: "Stream processing failed." }),
            );
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Stream may already be closed
          }
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Chat] Failed to generate chat response.", error);
    return Response.json(
      { error: "Failed to generate chat response." },
      { status: 500 },
    );
  }
}
