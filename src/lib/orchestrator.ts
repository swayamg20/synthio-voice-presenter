import { AudioPlaybackManager } from "./audio-manager";
import { createDeepgramConnection } from "./deepgram";
import slides from "./slides";
import type {
  ChatRequest,
  HistoryEntry,
  OrchestratorData,
  OrchestratorState,
  ToolCall,
  UserExpertise,
  Zone,
} from "./types";

type DeepgramConnection = ReturnType<typeof createDeepgramConnection>;
type InterruptContext = NonNullable<ChatRequest["interruptContext"]>;
type ZoneContext = NonNullable<ChatRequest["zoneContext"]>;
type SpeechType = "narration" | "answer";
type StateChangeCallback = (
  state: OrchestratorState,
  data: OrchestratorData,
) => void;

type Operation = {
  id: number;
  controller: AbortController;
};

const AUTO_ADVANCE_MS = 5000;
const HIGHLIGHT_CLEAR_MS = 4000;
const TOTAL_SLIDES = slides.length;

function now(): number {
  return Date.now();
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isPauseIntent(transcript: string): boolean {
  return /\b(stop|pause|hold on|wait|be quiet|silence)\b/i.test(transcript);
}

function isContinueIntent(transcript: string): boolean {
  return /\b(continue|go on|keep going|resume|carry on|move on|yes|yep|ok|okay)\b/i.test(
    transcript,
  );
}

function getSlide(slideNumber: number) {
  return slides.find((slide) => slide.id === slideNumber);
}

// ---------- SSE parsing ----------

type SSEEvent = {
  event: string;
  data: string;
};

/**
 * Parse an SSE stream into individual events.
 * Yields { event, data } for each complete SSE event.
 */
async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) {
        throw new DOMException("SSE stream aborted.", "AbortError");
      }

      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on double newline (SSE event separator)
      const parts = buffer.split("\n\n");
      // The last part is incomplete — keep it in the buffer
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        let event = "message";
        let data = "";

        for (const line of trimmed.split("\n")) {
          if (line.startsWith("event: ")) {
            event = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            data = line.slice(6);
          }
        }

        if (data) {
          yield { event, data };
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      let event = "message";
      let data = "";

      for (const line of buffer.trim().split("\n")) {
        if (line.startsWith("event: ")) {
          event = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          data = line.slice(6);
        }
      }

      if (data) {
        yield { event, data };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class VoiceOrchestrator {
  private state: OrchestratorState = "idle";
  private currentSlide = 1;
  private transcript = "";
  private spokenSoFar: string[] = [];
  private conversationHistory: HistoryEntry[] = [];
  private highlightedZone: string | null = null;
  private autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private highlightClearTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;
  private deepgramConnection: DeepgramConnection | null = null;
  private audio: AudioPlaybackManager | null = null;
  private micStream: MediaStream | null = null;
  private slidesPresented = new Set<number>();
  private pendingInterruptContext: InterruptContext | undefined;
  private lastInteraction: string | undefined;
  private operationId = 0;
  private currentSpeechText = "";
  private currentSpeechType: SpeechType | null = null;
  private currentSpeechSlide = 1;
  private ttsStreamFinished = false;
  private resolvePlaybackComplete: (() => void) | null = null;
  private destroyed = false;
  private muted = false;
  private currentSentence = "";
  private pendingSentences: string[] = [];
  private ttsPendingCount = 0;
  private activityLog: import("./types").ActivityEvent[] = [];
  private activityIdCounter = 0;
  private followUps: string[] = [];
  private userExpertise: UserExpertise = "unknown";

  constructor(private readonly onStateChange: StateChangeCallback) {
    this.emit();
  }

  private addActivity(type: import("./types").ActivityEvent["type"], message: string): void {
    this.activityLog = [
      ...this.activityLog.slice(-19),
      { id: ++this.activityIdCounter, type, message, timestamp: now() },
    ];
  }

  async start(): Promise<void> {
    if (this.state !== "idle" || this.destroyed) {
      return;
    }

    if (typeof window === "undefined") {
      throw new Error("VoiceOrchestrator can only start in a browser.");
    }

    try {
      this.addActivity("think", "Connecting microphone...");
      this.transcript = "Connecting...";
      this.transition("thinking");
      this.ensureAudio();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micStream = stream;
      this.addActivity("think", "Setting up voice connection...");
      this.emit();

      const tokenResponse = await fetch("/api/deepgram-token", {
        cache: "no-store",
      });

      if (!tokenResponse.ok) {
        throw new Error(await this.errorText(tokenResponse));
      }

      const tokenBody = (await tokenResponse.json()) as { token?: string };

      if (!tokenBody.token) {
        throw new Error("Deepgram token response did not include a token.");
      }

      this.deepgramConnection?.stop();
      this.deepgramConnection = createDeepgramConnection(
        tokenBody.token,
        (text) => this.handleTranscript(text, false),
        (text) => this.handleTranscript(text, true),
        (error) => this.handleDeepgramError(error),
      );
      this.deepgramConnection.start(stream);
      this.addActivity("think", "Generating narration...");

      this.transcript = "";
      await this.narrate(1);
    } catch (error) {
      this.transcript =
        error instanceof Error
          ? error.message
          : "Failed to start the voice session.";
      this.state = "idle";
      this.emit();
    }
  }

  handleTranscript(text: string, isFinal: boolean): void {
    const transcript = text.trim();

    if (!transcript || this.destroyed) {
      return;
    }

    if (this.muted) {
      console.log(`[Orchestrator] Ignoring transcript while muted: "${transcript}"`);
      return;
    }

    console.log(`[Orchestrator] handleTranscript (${isFinal ? "final" : "interim"}) in state "${this.state}": "${transcript}"`);

    if (!isFinal) {
      this.transcript = transcript;

      if (this.state === "narrating" || this.state === "responding") {
        this.enterListeningFromInterrupt();
        return;
      }

      if (this.state === "waiting" || this.state === "paused") {
        this.clearAutoAdvanceTimer();
        this.transition("listening");
        return;
      }

      this.emit();
      return;
    }

    this.transcript = transcript;

    if (this.state === "narrating" || this.state === "responding") {
      this.enterListeningFromInterrupt();
    } else if (this.state === "waiting" || this.state === "paused") {
      this.clearAutoAdvanceTimer();
      this.transition("listening");
    }

    if (this.state === "listening") {
      console.log(`[Orchestrator] Dispatching chat for final transcript: "${transcript}"`);
      void this.chat(transcript);
      return;
    }

    this.emit();
  }

  handleZoneLongPress(zone: Zone): void {
    if (this.destroyed || this.state === "idle") {
      return;
    }

    this.clearAutoAdvanceTimer();
    this.highlightedZone = zone.id;

    if (this.state === "narrating" || this.state === "responding") {
      this.captureInterruptContext(this.state === "narrating");
      this.recordCurrentSpeech(true);
    }

    this.cancelCurrentOperation();
    void this.chat("zone_click", zone);
  }

  nextSlide(): void {
    if (this.currentSlide >= TOTAL_SLIDES || this.destroyed) {
      return;
    }

    if (this.state === "idle") {
      this.currentSlide = this.currentSlide + 1;
      this.emit();
      return;
    }

    void this.navigateManually(this.currentSlide + 1);
  }

  prevSlide(): void {
    if (this.currentSlide <= 1 || this.destroyed) {
      return;
    }

    if (this.state === "idle") {
      this.currentSlide = this.currentSlide - 1;
      this.emit();
      return;
    }

    void this.navigateManually(this.currentSlide - 1);
  }

  toggleMic(): void {
    if (this.state === "idle") {
      return;
    }

    if (this.state === "paused") {
      console.log("[Orchestrator] Unmuting microphone");
      this.muted = false;
      this.transcript = "";
      this.transition("waiting");
      return;
    }

    console.log("[Orchestrator] Muting microphone");
    this.muted = true;
    this.pause();
  }

  handleFollowUpClick(question: string): void {
    if (this.destroyed || this.state === "idle") {
      return;
    }

    this.followUps = [];
    this.clearAutoAdvanceTimer();

    if (this.state === "narrating" || this.state === "responding") {
      this.captureInterruptContext(this.state === "narrating");
      this.recordCurrentSpeech(true);
    }

    this.cancelCurrentOperation();
    this.transcript = question;
    this.transition("listening");
    void this.chat(question);
  }

  pause(): void {
    if (this.state === "idle" || this.state === "paused") {
      return;
    }

    if (this.state === "narrating" || this.state === "responding") {
      this.captureInterruptContext(this.state === "narrating");
      this.recordCurrentSpeech(true);
    }

    this.cancelCurrentOperation();
    this.clearAutoAdvanceTimer();
    this.transcript = "Paused";
    this.transition("paused");
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelCurrentOperation();
    this.clearAutoAdvanceTimer();
    this.clearHighlightTimer();
    this.deepgramConnection?.stop();
    this.deepgramConnection = null;
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
  }

  getWaveformData(): Uint8Array | null {
    return this.audio?.getWaveformData() ?? null;
  }

  // ---------- Navigation ----------

  private async navigateManually(slideNumber: number): Promise<void> {
    if (this.state === "narrating" || this.state === "responding") {
      this.recordCurrentSpeech(true);
    }

    this.pendingInterruptContext = undefined;
    this.cancelCurrentOperation();
    this.clearAutoAdvanceTimer();
    await this.narrate(slideNumber);
  }

  // ---------- Narrate (SSE streaming) ----------

  private async narrate(slideNumber: number): Promise<void> {
    const slide = getSlide(slideNumber);

    if (!slide || this.destroyed) {
      return;
    }

    const operation = this.beginOperation();
    this.currentSlide = slideNumber;
    this.highlightedZone = null;
    this.transcript = "";
    this.spokenSoFar = [];
    this.followUps = [];
    this.currentSpeechText = "";
    this.currentSpeechType = null;
    this.currentSpeechSlide = slideNumber;
    this.addActivity("narrate", `Presenting slide ${slideNumber}: ${slide.title}`);
    this.transition("narrating");

    try {
      console.log(`[Orchestrator] Sending /api/narrate (SSE) for slide ${slideNumber}`);

      const response = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideNumber,
          previousContext: {
            slidesPresented: Array.from(this.slidesPresented),
            lastInteraction: this.lastInteraction,
          },
        }),
        signal: operation.controller.signal,
      });

      if (!response.ok) {
        throw new Error(await this.errorText(response));
      }

      if (!this.isCurrentOperation(operation.id)) return;

      const contentType = response.headers.get("Content-Type") ?? "";

      // If the response is JSON (error case or old format), handle as fallback
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as { error?: string; narrationText?: string; followUps?: string[] };
        if (payload.error) throw new Error(payload.error);
        if (payload.narrationText) {
          this.currentSpeechText = payload.narrationText;
          this.currentSpeechType = "narration";
          this.followUps = payload.followUps ?? [];
          await this.playSingleTTS(payload.narrationText, operation.id, operation.controller.signal);
          if (!this.isCurrentOperation(operation.id)) return;
          this.recordCurrentSpeech(false);
          this.slidesPresented.add(slideNumber);
          this.finishSpeech("narration");
          return;
        }
      }

      if (!response.body) {
        throw new Error("Narrate response was not a readable stream.");
      }

      // Setup playback completion tracking
      this.ensureAudio();
      this.ttsStreamFinished = false;
      this.resolvePlaybackComplete = null;
      const playbackComplete = new Promise<void>((resolve) => {
        this.resolvePlaybackComplete = resolve;
      });

      this.currentSpeechType = "narration";
      this.currentSpeechSlide = slideNumber;
      let allSentencesText = "";
      let ttsSentenceCount = 0;

      for await (const sseEvent of parseSSEStream(response.body, operation.controller.signal)) {
        if (!this.isCurrentOperation(operation.id)) return;

        if (sseEvent.event === "sentence") {
          const { text } = JSON.parse(sseEvent.data) as { text: string };
          if (!text.trim()) continue;

          allSentencesText += (allSentencesText ? " " : "") + text;
          this.currentSpeechText = allSentencesText;
          ttsSentenceCount++;

          console.log(`[Orchestrator] Narrate sentence ${ttsSentenceCount}: "${text.slice(0, 60)}"`);

          // Track spoken text and update subtitle
          this.pendingSentences.push(text);
          this.addSpokenText(text);

          // Fire TTS for this sentence (don't await — let it enqueue audio)
          this.enqueueSentenceTTS(text, operation.id, operation.controller.signal);
        } else if (sseEvent.event === "complete") {
          const { followUps } = JSON.parse(sseEvent.data) as { followUps?: string[] };
          this.followUps = followUps ?? [];
          console.log(`[Orchestrator] Narrate complete, followUps: ${this.followUps.length}`);
        } else if (sseEvent.event === "error") {
          const { message } = JSON.parse(sseEvent.data) as { message: string };
          console.error(`[Orchestrator] Narrate stream error: ${message}`);
        }
      }

      if (!this.isCurrentOperation(operation.id)) return;

      // All sentences sent to TTS — mark stream finished and wait for audio playback
      this.markTtsStreamFinished();
      await playbackComplete;

      if (!this.isCurrentOperation(operation.id)) return;

      this.recordCurrentSpeech(false);
      this.slidesPresented.add(slideNumber);
      this.finishSpeech("narration");
    } catch (error) {
      this.handleOperationError(error, operation.id);
    } finally {
      this.clearOperation(operation);
    }
  }

  // ---------- Chat (SSE streaming) ----------

  private async chat(transcript: string, zone?: Zone): Promise<void> {
    const operation = this.beginOperation();
    const interruptContext = this.pendingInterruptContext;
    const historyBeforeCurrentUser = [...this.conversationHistory];
    const pauseIntent = isPauseIntent(transcript);
    const continueNarration =
      isContinueIntent(transcript) && this.hasInterruptedNarration();

    this.pendingInterruptContext = undefined;
    this.followUps = [];
    this.clearAutoAdvanceTimer();
    this.addUserHistory(transcript, zone);
    this.addActivity("listen", zone ? `Clicked: ${zone.label}` : `"${transcript}"`);
    this.addActivity("think", "Processing your request...");
    this.transition("thinking");

    const zoneContext: ZoneContext | undefined = zone
      ? {
          zoneId: zone.id,
          zoneLabel: zone.label,
          zoneDescription: zone.description,
        }
      : undefined;

    const body: ChatRequest = {
      transcript,
      currentSlide: this.currentSlide,
      conversationHistory: historyBeforeCurrentUser,
      interruptContext,
      zoneContext,
    };

    try {
      console.log(`[Orchestrator] Sending /api/chat (SSE)`, {
        transcript,
        currentSlide: this.currentSlide,
        historyLength: historyBeforeCurrentUser.length,
        hasInterruptContext: !!interruptContext,
        hasZoneContext: !!zoneContext,
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: operation.controller.signal,
      });

      if (!response.ok) {
        throw new Error(await this.errorText(response));
      }

      if (!this.isCurrentOperation(operation.id)) return;

      const contentType = response.headers.get("Content-Type") ?? "";

      // Handle JSON fallback (old format or error)
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as {
          error?: string;
          text?: string;
          toolCalls?: ToolCall[];
          followUps?: string[];
          expertiseAssessment?: UserExpertise;
        };
        if (payload.error) throw new Error(payload.error);

        const text = payload.text ?? "I can continue from here.";
        this.followUps = payload.followUps ?? [];
        if (payload.expertiseAssessment && payload.expertiseAssessment !== this.userExpertise) {
          this.userExpertise = payload.expertiseAssessment;
          this.addActivity("think", `Adapting to ${this.userExpertise} level`);
        }

        const navigatedToSlide = this.applyToolCalls(payload.toolCalls ?? []);
        const speechType: SpeechType = continueNarration ? "narration" : "answer";
        const speechState: OrchestratorState = continueNarration ? "narrating" : "responding";

        this.currentSpeechText = text;
        this.currentSpeechType = speechType;
        this.currentSpeechSlide = this.currentSlide;
        this.spokenSoFar = [];
        this.transcript = "";
        this.addActivity("respond", continueNarration ? "Continuing narration..." : "Responding...");
        this.transition(speechState);

        await this.playSingleTTS(text, operation.id, operation.controller.signal);
        if (!this.isCurrentOperation(operation.id)) return;
        this.recordCurrentSpeech(false);

        if (pauseIntent) {
          this.clearAutoAdvanceTimer();
          this.transcript = "";
          this.transition("paused");
          return;
        }

        if (navigatedToSlide && !continueNarration) {
          await this.narrate(navigatedToSlide);
          return;
        }

        this.finishSpeech(speechType);
        return;
      }

      if (!response.body) {
        throw new Error("Chat response was not a readable stream.");
      }

      // Setup playback completion tracking
      this.ensureAudio();
      this.ttsStreamFinished = false;
      this.resolvePlaybackComplete = null;
      const playbackComplete = new Promise<void>((resolve) => {
        this.resolvePlaybackComplete = resolve;
      });

      const speechType: SpeechType = continueNarration ? "narration" : "answer";
      const speechState: OrchestratorState = continueNarration ? "narrating" : "responding";

      this.currentSpeechType = speechType;
      this.currentSpeechSlide = this.currentSlide;
      this.spokenSoFar = [];
      this.transcript = "";
      let allSentencesText = "";
      let ttsSentenceCount = 0;
      let navigatedToSlide: number | null = null;
      let transitionedToSpeech = false;
      const allToolCalls: ToolCall[] = [];
      let streamFollowUps: string[] = [];
      let streamExpertise: UserExpertise | undefined;

      for await (const sseEvent of parseSSEStream(response.body, operation.controller.signal)) {
        if (!this.isCurrentOperation(operation.id)) return;

        if (sseEvent.event === "sentence") {
          const { text } = JSON.parse(sseEvent.data) as { text: string };
          if (!text.trim()) continue;

          // On first sentence, transition from thinking to speaking
          if (!transitionedToSpeech) {
            transitionedToSpeech = true;
            this.addActivity("respond", continueNarration ? "Continuing narration..." : "Responding...");
            this.transition(speechState);
          }

          allSentencesText += (allSentencesText ? " " : "") + text;
          this.currentSpeechText = allSentencesText;
          ttsSentenceCount++;

          console.log(`[Orchestrator] Chat sentence ${ttsSentenceCount}: "${text.slice(0, 60)}"`);

          this.pendingSentences.push(text);
          this.addSpokenText(text);

          // Fire TTS in background
          this.enqueueSentenceTTS(text, operation.id, operation.controller.signal);

        } else if (sseEvent.event === "tool_call") {
          const toolCall = JSON.parse(sseEvent.data) as ToolCall;
          console.log(`[Orchestrator] Chat tool_call: ${toolCall.name}`, toolCall.args);
          allToolCalls.push(toolCall);

          // Apply tool calls immediately
          const nav = this.applyToolCalls([toolCall]);
          if (nav) navigatedToSlide = nav;

        } else if (sseEvent.event === "complete") {
          const data = JSON.parse(sseEvent.data) as {
            followUps?: string[];
            expertiseAssessment?: UserExpertise;
            toolCalls?: ToolCall[];
          };
          streamFollowUps = data.followUps ?? [];
          streamExpertise = data.expertiseAssessment;

          // Apply any remaining tool calls from complete event
          if (data.toolCalls?.length) {
            for (const tc of data.toolCalls) {
              if (!allToolCalls.some(existing => existing.name === tc.name)) {
                allToolCalls.push(tc);
                const nav = this.applyToolCalls([tc]);
                if (nav) navigatedToSlide = nav;
              }
            }
          }

          console.log(`[Orchestrator] Chat complete, followUps: ${streamFollowUps.length}, expertise: ${streamExpertise ?? "none"}`);

        } else if (sseEvent.event === "error") {
          const { message } = JSON.parse(sseEvent.data) as { message: string };
          console.error(`[Orchestrator] Chat stream error: ${message}`);
        }
      }

      if (!this.isCurrentOperation(operation.id)) return;

      // If we never transitioned to speech (no sentences came), handle gracefully
      if (!transitionedToSpeech) {
        const fallbackText = navigatedToSlide
          ? "Sure, let me show you that."
          : "I can continue from here.";
        this.currentSpeechText = fallbackText;
        this.addActivity("respond", "Responding...");
        this.transition(speechState);
        this.pendingSentences.push(fallbackText);
        this.addSpokenText(fallbackText);
        this.enqueueSentenceTTS(fallbackText, operation.id, operation.controller.signal);
      }

      this.followUps = streamFollowUps;

      if (streamExpertise && streamExpertise !== this.userExpertise) {
        this.userExpertise = streamExpertise;
        this.addActivity("think", `Adapting to ${this.userExpertise} level`);
      }

      // All sentences sent to TTS — mark stream finished and wait for audio
      this.markTtsStreamFinished();
      await playbackComplete;

      if (!this.isCurrentOperation(operation.id)) return;

      this.recordCurrentSpeech(false);

      if (pauseIntent) {
        this.clearAutoAdvanceTimer();
        this.transcript = "";
        this.transition("paused");
        return;
      }

      if (navigatedToSlide && !continueNarration) {
        await this.narrate(navigatedToSlide);
        return;
      }

      this.finishSpeech(speechType);
    } catch (error) {
      this.handleOperationError(error, operation.id);
    } finally {
      this.clearOperation(operation);
    }
  }

  // ---------- TTS per sentence ----------

  /**
   * Fire TTS for a single sentence in the background.
   * Fetches audio from /api/tts and enqueues it for playback.
   * Does NOT await — callers fire-and-forget.
   */
  private enqueueSentenceTTS(
    sentence: string,
    operationId: number,
    signal: AbortSignal,
  ): void {
    this.ttsPendingCount++;
    // Fire in background — don't block SSE consumption
    void this.fetchAndEnqueueTTS(sentence, operationId, signal);
  }

  private async fetchAndEnqueueTTS(
    sentence: string,
    operationId: number,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      this.ensureAudio();

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence }),
        signal,
      });

      if (!this.isCurrentOperation(operationId) || signal.aborted) return;

      if (!response.ok) {
        console.warn(`[Orchestrator] TTS failed for sentence: "${sentence.slice(0, 40)}"`);
        return;
      }

      const contentType = response.headers.get("Content-Type") ?? "";

      if (contentType.includes("application/json")) {
        // Browser fallback
        const payload = (await response.json()) as { type?: string; text?: string };
        if (payload.type === "fallback" && payload.text) {
          await this.playBrowserFallback(payload.text, signal);
        }
        return;
      }

      if (contentType.startsWith("audio/")) {
        const audioBuffer = await response.arrayBuffer();
        if (!this.isCurrentOperation(operationId) || signal.aborted) return;
        await this.audio?.enqueue(audioBuffer);
      }
    } catch (error) {
      if (!isAbortError(error) && !signal.aborted) {
        console.warn(`[Orchestrator] TTS error for sentence: "${sentence.slice(0, 40)}"`, error);
      }
    } finally {
      this.ttsPendingCount = Math.max(0, this.ttsPendingCount - 1);
      this.tryResolvePlayback();
    }
  }

  /**
   * Fallback for when the full text needs to go through a single TTS call.
   * Used for JSON fallback responses from chat/narrate routes.
   */
  private async playSingleTTS(
    text: string,
    operationId: number,
    signal: AbortSignal,
  ): Promise<void> {
    this.ensureAudio();
    this.ttsStreamFinished = false;
    this.resolvePlaybackComplete = null;

    const playbackComplete = new Promise<void>((resolve) => {
      this.resolvePlaybackComplete = resolve;
    });

    // Split into sentences and fire TTS for each
    const sentences = text
      .replace(/\s+/g, " ")
      .trim()
      .match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [text];

    for (const sentence of sentences) {
      if (signal.aborted || !this.isCurrentOperation(operationId)) return;
      this.pendingSentences.push(sentence);
      this.addSpokenText(sentence);
      this.enqueueSentenceTTS(sentence, operationId, signal);
    }

    this.markTtsStreamFinished();
    await playbackComplete;
  }

  // ---------- Browser fallback ----------

  private async playBrowserFallback(
    text: string,
    signal: AbortSignal,
  ): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      const abort = () => {
        window.speechSynthesis.cancel();
        reject(new DOMException("TTS fallback was aborted.", "AbortError"));
      };

      signal.addEventListener("abort", abort, { once: true });
      utterance.onend = () => {
        signal.removeEventListener("abort", abort);
        resolve();
      };
      utterance.onerror = () => {
        signal.removeEventListener("abort", abort);
        reject(new Error("Browser speech synthesis failed."));
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  private stopPlayback(): void {
    this.audio?.stop();

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    this.markTtsStreamFinished();
  }

  // ---------- State management ----------

  private enterListeningFromInterrupt(): void {
    this.followUps = [];
    this.addActivity("interrupt", "User interrupted — listening...");
    this.captureInterruptContext(this.state === "narrating");
    this.recordCurrentSpeech(true);
    this.cancelCurrentOperation();
    this.clearAutoAdvanceTimer();
    this.transition("listening");
  }

  private captureInterruptContext(wasNarrating: boolean): void {
    this.pendingInterruptContext = {
      wasNarrating,
      spokenSoFar: [...this.spokenSoFar],
      slideBeingNarrated: this.currentSpeechSlide || this.currentSlide,
    };
  }

  private recordCurrentSpeech(interrupted: boolean): void {
    if (!this.currentSpeechType || !this.currentSpeechText.trim()) {
      return;
    }

    const spokenUpTo = this.spokenSoFar.join(" ").trim();
    const content = interrupted
      ? spokenUpTo || this.currentSpeechText
      : this.currentSpeechText;

    if (!content.trim()) {
      return;
    }

    this.conversationHistory.push({
      role: "assistant",
      content,
      metadata: {
        type: this.currentSpeechType,
        slide: this.currentSpeechSlide,
        interrupted,
        spokenUpTo: interrupted ? content : undefined,
        timestamp: now(),
      },
    });

    this.currentSpeechText = "";
    this.currentSpeechType = null;
    this.emit();
  }

  private addUserHistory(transcript: string, zone?: Zone): void {
    const isZoneQuery = Boolean(zone);
    const content = zone
      ? `Clicked on ${zone.label}: ${zone.description}`
      : transcript;
    const type: HistoryEntry["metadata"]["type"] = isZoneQuery
      ? "zone_query"
      : isPauseIntent(transcript) || isContinueIntent(transcript)
        ? "control"
        : "question";

    this.conversationHistory.push({
      role: "user",
      content,
      metadata: {
        type,
        slide: this.currentSlide,
        timestamp: now(),
      },
    });

    this.lastInteraction = content;
    this.emit();
  }

  private applyToolCalls(toolCalls: ToolCall[]): number | null {
    console.log(`[Orchestrator] Applying ${toolCalls.length} tool calls:`, toolCalls);
    let navigatedToSlide: number | null = null;
    const navigation = toolCalls.find(
      (toolCall) => toolCall.name === "navigate_to_slide",
    );

    if (navigation) {
      const slideNumber = navigation.args.slide_number;
      console.log(`[Orchestrator] navigate_to_slide -> slide ${slideNumber}`);

      if (Number.isInteger(slideNumber) && getSlide(slideNumber)) {
        const slide = getSlide(slideNumber);
        this.currentSlide = slideNumber;
        this.highlightedZone = null;
        navigatedToSlide = slideNumber;
        this.addActivity("navigate", `Navigated to slide ${slideNumber}: ${slide?.title ?? ""}`);
        this.emit();
      }
    }

    const highlight = toolCalls.find(
      (toolCall) => toolCall.name === "highlight_zone",
    );

    if (highlight && typeof highlight.args.zone_id === "string") {
      console.log(`[Orchestrator] highlight_zone -> zone "${highlight.args.zone_id}"`);
      this.highlightedZone = highlight.args.zone_id;
      this.addActivity("highlight", `Highlighting: ${highlight.args.zone_id}`);
      this.emit();
    }

    return navigatedToSlide;
  }

  private finishSpeech(speechType: SpeechType): void {
    this.scheduleHighlightClear();
    this.transcript = "";
    this.transition("waiting");

    if (speechType === "narration" && this.currentSlide < TOTAL_SLIDES) {
      this.startAutoAdvanceTimer();
    }
  }

  private startAutoAdvanceTimer(): void {
    this.clearAutoAdvanceTimer();
    this.autoAdvanceTimer = setTimeout(() => {
      this.autoAdvanceTimer = null;

      if (this.state === "waiting" && this.currentSlide < TOTAL_SLIDES) {
        this.nextSlide();
      }
    }, AUTO_ADVANCE_MS);
  }

  private clearAutoAdvanceTimer(): void {
    if (!this.autoAdvanceTimer) {
      return;
    }

    clearTimeout(this.autoAdvanceTimer);
    this.autoAdvanceTimer = null;
  }

  private scheduleHighlightClear(): void {
    if (!this.highlightedZone) {
      return;
    }

    this.clearHighlightTimer();
    this.highlightClearTimer = setTimeout(() => {
      this.highlightClearTimer = null;
      this.highlightedZone = null;
      this.emit();
    }, HIGHLIGHT_CLEAR_MS);
  }

  private clearHighlightTimer(): void {
    if (!this.highlightClearTimer) {
      return;
    }

    clearTimeout(this.highlightClearTimer);
    this.highlightClearTimer = null;
  }

  private addSpokenText(text: string): void {
    const sentence = text.trim();

    if (!sentence) {
      return;
    }

    this.spokenSoFar.push(sentence);
    this.transcript = sentence;
    this.emit();
  }

  private beginOperation(): Operation {
    this.operationId += 1;
    this.abortController?.abort();

    const controller = new AbortController();
    this.abortController = controller;

    return {
      id: this.operationId,
      controller,
    };
  }

  private cancelCurrentOperation(): void {
    this.operationId += 1;
    this.abortController?.abort();
    this.abortController = null;
    this.pendingSentences = [];
    this.ttsPendingCount = 0;
    this.ttsStreamFinished = false;
    this.stopPlayback();
  }

  private clearOperation(operation: Operation): void {
    if (this.abortController === operation.controller) {
      this.abortController = null;
    }
  }

  private isCurrentOperation(operationId: number): boolean {
    return !this.destroyed && operationId === this.operationId;
  }

  private markTtsStreamFinished(): void {
    this.ttsStreamFinished = true;
    this.tryResolvePlayback();
  }

  private tryResolvePlayback(): void {
    if (this.ttsStreamFinished && this.ttsPendingCount === 0 && !this.audio?.isPlaying) {
      this.resolveCurrentPlayback();
    }
  }

  private resolveCurrentPlayback(): void {
    const resolve = this.resolvePlaybackComplete;
    this.resolvePlaybackComplete = null;
    resolve?.();
  }

  private ensureAudio(): void {
    if (this.audio) {
      return;
    }

    this.audio = new AudioPlaybackManager();
    this.audio.onPlaybackComplete = () => {
      this.tryResolvePlayback();
    };
    this.audio.onBufferStart = () => {
      const next = this.pendingSentences.shift();
      if (next) {
        this.currentSentence = next;
        this.emit();
      }
    };
  }

  private transition(state: OrchestratorState): void {
    const prev = this.state;
    this.state = state;
    console.log(`[Orchestrator] State transition: ${prev} -> ${state}`);
    this.emit();
  }

  private emit(): void {
    this.onStateChange(this.state, {
      currentSlide: this.currentSlide,
      transcript: this.transcript,
      highlightedZone: this.highlightedZone,
      spokenSoFar: [...this.spokenSoFar],
      conversationHistory: [...this.conversationHistory],
      currentSentence: this.currentSentence,
      activityLog: [...this.activityLog],
      followUps: [...this.followUps],
      userExpertise: this.userExpertise,
    });
  }

  private hasInterruptedNarration(): boolean {
    return this.conversationHistory.some(
      (entry) =>
        entry.role === "assistant" &&
        entry.metadata.type === "narration" &&
        entry.metadata.interrupted,
    );
  }

  private handleDeepgramError(error: Error): void {
    this.transcript = error.message || "Voice connection lost.";
    this.emit();
  }

  private handleOperationError(error: unknown, operationId: number): void {
    if (isAbortError(error) || !this.isCurrentOperation(operationId)) {
      return;
    }

    console.error("Voice orchestration failed.", error);
    this.transcript =
      error instanceof Error
        ? error.message
        : "I had trouble with that. Try asking again.";
    this.transition(
      this.state === "thinking" ||
        this.state === "narrating" ||
        this.state === "responding"
        ? "waiting"
        : this.state,
    );
  }

  private async errorText(response: Response): Promise<string> {
    const fallback = `Request failed with status ${response.status}.`;

    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error || fallback;
    } catch {
      try {
        return (await response.text()) || fallback;
      } catch {
        return fallback;
      }
    }
  }
}
