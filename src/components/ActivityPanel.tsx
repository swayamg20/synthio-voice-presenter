"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import type { ActivityEvent, OrchestratorState, UserExpertise } from "@/lib/types";

type ActivityPanelProps = {
  state: OrchestratorState;
  activityLog: ActivityEvent[];
  onStart: () => void;
  onMicToggle: () => void;
  waveformRef: RefObject<HTMLCanvasElement | null>;
  userExpertise: UserExpertise;
};

const EVENT_COLORS: Record<ActivityEvent["type"], string> = {
  narrate: "var(--accent)",
  listen: "var(--listening)",
  think: "var(--text-tertiary)",
  respond: "var(--accent)",
  navigate: "var(--accent-light)",
  highlight: "var(--accent-light)",
  interrupt: "#F59E0B",
  error: "var(--error)",
};

const STATE_BADGE_TYPES = new Set<ActivityEvent["type"]>(["narrate", "listen", "respond", "interrupt"]);

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

function EventEntry({ event }: { event: ActivityEvent }) {
  const isBadge = STATE_BADGE_TYPES.has(event.type);
  const isUserSpeech = event.type === "listen" && event.message.startsWith('"');
  const color = EVENT_COLORS[event.type];

  if (isBadge) {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
        >
          <span className="h-1 w-1 rounded-full" style={{ backgroundColor: color }} />
          {event.message}
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
      </div>
    );
  }

  if (isUserSpeech) {
    return (
      <div
        className="rounded-md px-3 py-2 my-1"
        style={{ backgroundColor: "var(--surface-hover)" }}
      >
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          You said
        </span>
        <p className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
          {event.message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-mono text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {event.message}
      </span>
    </div>
  );
}

const EXPERTISE_LABELS: Record<Exclude<UserExpertise, "unknown">, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
};

export function ActivityPanel({
  state,
  activityLog,
  onStart,
  onMicToggle,
  waveformRef,
  userExpertise,
}: ActivityPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityLog.length]);

  const isIdle = state === "idle";
  const isListening = state === "listening";
  const isSpeaking = state === "narrating" || state === "responding";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-2.5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: isIdle ? "var(--border-strong)" : "var(--accent)" }}
          />
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            Agent
          </span>
        </div>
        {!isIdle && (
          <div className="flex items-center gap-2">
            {userExpertise !== "unknown" && (
              <span
                className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                  color: "var(--accent)",
                }}
              >
                {EXPERTISE_LABELS[userExpertise]}
              </span>
            )}
            <span
              className="font-mono text-[10px] uppercase tracking-wider"
              style={{
                color: isListening ? "var(--listening)" : isSpeaking ? "var(--accent)" : "var(--text-tertiary)",
              }}
            >
              {state}
            </span>
          </div>
        )}
      </div>

      {/* Voice controls */}
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        {isIdle ? (
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <svg className="h-3.5 w-3.5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14l11-7-11-7Z" />
            </svg>
            Start Presentation
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onMicToggle}
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md border transition"
              style={{
                backgroundColor: isListening ? "var(--listening)" : isSpeaking ? "var(--accent)" : "var(--surface)",
                borderColor: isListening ? "var(--listening)" : isSpeaking ? "var(--accent)" : "var(--border)",
                color: isListening || isSpeaking ? "#fff" : "var(--text-secondary)",
              }}
            >
              <MicIcon />
            </button>
            <canvas
              ref={waveformRef}
              className="block h-7 flex-1 rounded"
              style={{ backgroundColor: "var(--surface-hover)" }}
            />
          </div>
        )}
      </div>

      {/* Activity log */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {isIdle ? (
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Click Start to begin. The AI will present each slide and you can interrupt with questions anytime.
          </p>
        ) : (
          <div className="space-y-0.5">
            {activityLog.map((event) => (
              <EventEntry key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
