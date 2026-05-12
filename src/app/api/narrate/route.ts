import OpenAI from "openai";
import { buildNarrateSystemPrompt } from "@/lib/prompts";
import { respondOnlyToolDefinitions } from "@/lib/tool-registry";
import type { NarrateRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openai) {
    return openai;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  openai = new OpenAI({ apiKey });
  return openai;
}

// ---------- SSE helpers ----------

const textEncoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ---------- Sentence extraction from partial JSON ----------

const SPOKEN_TEXT_PREFIXES = ['"spoken_text":"', '"spoken_text": "'];

function findSpokenTextStart(partial: string): number {
  for (const prefix of SPOKEN_TEXT_PREFIXES) {
    const idx = partial.indexOf(prefix);
    if (idx !== -1) {
      return idx + prefix.length;
    }
  }
  return -1;
}

function extractSpokenTextSoFar(partial: string): string {
  const valueStart = findSpokenTextStart(partial);
  if (valueStart === -1) return "";

  let end = -1;
  for (let i = valueStart; i < partial.length; i++) {
    if (partial[i] === '"' && partial[i - 1] !== '\\') {
      end = i;
      break;
    }
  }

  const raw = end === -1 ? partial.slice(valueStart) : partial.slice(valueStart, end);

  try {
    return JSON.parse(`"${raw.replace(/$/,'')}"`);
  } catch {
    const trimmed = raw.replace(/\\+$/, '');
    try {
      return JSON.parse(`"${trimmed}"`);
    } catch {
      return trimmed;
    }
  }
}

function extractCompleteSentences(
  text: string,
  offset: number,
): { sentences: string[]; newOffset: number } {
  const remaining = text.slice(offset);
  const sentences: string[] = [];

  const regex = /[^.!?]*[.!?]+(?=\s)/g;
  let match: RegExpExecArray | null;
  let lastEnd = 0;

  while ((match = regex.exec(remaining)) !== null) {
    const sentence = match[0].trim();
    if (sentence) {
      sentences.push(sentence);
      lastEnd = match.index + match[0].length;
    }
  }

  return {
    sentences,
    newOffset: offset + lastEnd,
  };
}

export async function POST(request: Request) {
  let body: NarrateRequest;

  try {
    body = (await request.json()) as NarrateRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Number.isInteger(body.slideNumber)) {
    return Response.json(
      { error: "slideNumber is required." },
      { status: 400 },
    );
  }

  try {
    console.log(`[Narrate] Generating narration for slide ${body.slideNumber}`);
    const systemPrompt = buildNarrateSystemPrompt(
      body.slideNumber,
      body.previousContext?.slidesPresented ?? [],
      body.previousContext?.lastInteraction,
    );

    const stream = await getOpenAIClient().chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Generate the narration now. Return only the words to be spoken aloud.",
        },
      ],
      tools: respondOnlyToolDefinitions,
      tool_choice: { type: "function", function: { name: "respond" } },
      temperature: 0.74,
      max_completion_tokens: 600,
      stream: true,
    });

    let respondArguments = "";
    let emittedSentenceOffset = 0;
    let messageContent = "";

    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (request.signal.aborted) break;

            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              messageContent += delta.content;
            }

            if (delta.tool_calls) {
              for (const tcDelta of delta.tool_calls) {
                if (tcDelta.function?.arguments) {
                  respondArguments += tcDelta.function.arguments;
                }
              }

              // Extract sentences from partial arguments
              const spokenText = extractSpokenTextSoFar(respondArguments);
              if (spokenText.length > 0) {
                const { sentences, newOffset } = extractCompleteSentences(
                  spokenText,
                  emittedSentenceOffset,
                );

                for (const sentence of sentences) {
                  console.log(`[Narrate] Streaming sentence: "${sentence}"`);
                  controller.enqueue(sseEvent("sentence", { text: sentence }));
                }

                if (newOffset > emittedSentenceOffset) {
                  emittedSentenceOffset = newOffset;
                }
              }
            }
          }

          // Stream ended — emit remaining text and complete event
          let respondArgs: Record<string, unknown> | null = null;

          if (respondArguments) {
            try {
              respondArgs = JSON.parse(respondArguments) as Record<string, unknown>;
              const fullSpokenText = (respondArgs.spoken_text as string) ?? "";

              const remainingText = fullSpokenText.slice(emittedSentenceOffset).trim();
              if (remainingText) {
                console.log(`[Narrate] Final sentence fragment: "${remainingText}"`);
                controller.enqueue(sseEvent("sentence", { text: remainingText }));
              }
            } catch (error) {
              console.warn("[Narrate] Failed to parse respond tool arguments.", error);
            }
          }

          // Fallback to message content if no respond tool
          if (!respondArgs && messageContent.trim()) {
            console.log(`[Narrate] No respond tool — using message content as speech`);
            controller.enqueue(sseEvent("sentence", { text: messageContent.trim() }));
          }

          if (!respondArgs && !messageContent.trim() && emittedSentenceOffset === 0) {
            console.error("[Narrate] OpenAI returned empty narration.");
            controller.enqueue(
              sseEvent("error", { message: "Empty narration returned." }),
            );
          }

          const followUps = (respondArgs?.follow_ups as string[]) ?? [];

          console.log(`[Narrate] Stream complete for slide ${body.slideNumber}:`, JSON.stringify({ followUps }, null, 2));
          controller.enqueue(sseEvent("complete", { followUps }));
        } catch (error) {
          if (!request.signal.aborted) {
            console.error("[Narrate] Stream processing error.", error);
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
    console.error("Failed to generate narration.", error);
    return Response.json(
      { error: "Failed to generate narration." },
      { status: 500 },
    );
  }
}
