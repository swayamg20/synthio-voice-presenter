"use client";

import type { RefObject } from "react";
import type { OrchestratorState } from "@/lib/types";

type VoiceBarProps = {
  state: OrchestratorState;
  transcript: string;
  onMicToggle: () => void;
  onStart: () => void;
  waveformRef: RefObject<HTMLCanvasElement | null>;
};

function MicIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 14.5c2.1 0 3.8-1.7 3.8-3.8V6.8a3.8 3.8 0 0 0-7.6 0v3.9c0 2.1 1.7 3.8 3.8 3.8Z"
        stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      />
      <path
        d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v3.5M8.8 20.5h6.4"
        stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v14l11-7-11-7Z" />
    </svg>
  );
}

export function VoiceBar({ state, transcript, onMicToggle, onStart, waveformRef }: VoiceBarProps) {
  const isIdle = state === "idle";
  const isListening = state === "listening";
  const isSpeaking = state === "narrating" || state === "responding";
  const isThinking = state === "thinking";

  const statusText = isIdle
    ? "Ready to present"
    : isListening
      ? "Listening..."
      : isSpeaking
        ? "Speaking..."
        : isThinking
          ? "Thinking..."
          : state === "paused"
            ? "Paused"
            : state === "waiting"
              ? "Ask a question or click next"
              : "";

  return (
    <div
      className="flex-shrink-0 px-6 py-2.5"
      style={{
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="mx-auto flex max-w-4xl items-center gap-4">
        {isIdle ? (
          <button
            type="button"
            onClick={onStart}
            className="flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <PlayIcon />
            Start
          </button>
        ) : (
          <button
            type="button"
            onClick={onMicToggle}
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md border transition hover:opacity-90"
            style={{
              backgroundColor: isListening ? "var(--listening)" : isSpeaking ? "var(--accent)" : "var(--surface)",
              borderColor: isListening ? "var(--listening)" : isSpeaking ? "var(--accent)" : "var(--border)",
              color: isListening || isSpeaking ? "#fff" : "var(--text-secondary)",
            }}
          >
            <MicIcon />
          </button>
        )}

        <div className="min-w-0 flex-1">
          {!isIdle && (
            <canvas
              ref={waveformRef}
              className="block h-6 w-full rounded"
              style={{ backgroundColor: "var(--surface-hover)" }}
            />
          )}
          <p className="mt-0.5 truncate font-mono text-xs" style={{ color: transcript ? "var(--text-primary)" : "var(--text-tertiary)" }}>
            {transcript || statusText}
          </p>
        </div>
      </div>
    </div>
  );
}
