"use client";

import { motion, AnimatePresence } from "framer-motion";

interface FeaturesModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: "▶",
    title: "Start",
    description: "Click Start Presentation in the left panel. Allow mic access. Use headphones for best experience.",
    tag: null,
  },
  {
    icon: "🎙",
    title: "AI Narration",
    description: "The AI presents each slide automatically with natural speech, then asks if you have questions before moving on.",
    tag: "core",
  },
  {
    icon: "✋",
    title: "Interrupt Anytime",
    description: "Just start speaking while the AI is talking. It stops immediately and listens to your question.",
    tag: "core",
  },
  {
    icon: "🧭",
    title: "Voice Navigation",
    description: "Say \"tell me about tool calling\" or \"go to the memory slide\" and the AI navigates to the right slide automatically.",
    tag: "core",
  },
  {
    icon: "👆",
    title: "Diagram Interaction",
    description: "Long-press (hold 500ms) any element in a slide diagram. The AI highlights it with a visual indicator and explains that specific component in detail.",
    tag: null,
  },
  {
    icon: "🔎",
    title: "Auto Highlighting",
    description: "When you ask about a concept on the current slide, the AI automatically highlights the relevant diagram element while explaining it.",
    tag: null,
  },
  {
    icon: "💬",
    title: "Follow-up Suggestions",
    description: "After each response, clickable follow-up questions appear below the slide. Click one to ask it instantly.",
    tag: null,
  },
  {
    icon: "🎯",
    title: "Audience Adaptation",
    description: "Ask basic questions and the AI simplifies. Ask technical questions and it goes deeper. Adapts automatically.",
    tag: null,
  },
  {
    icon: "↩",
    title: "Resume & Continue",
    description: "After interrupting, say \"continue\" and the AI picks up exactly where it left off.",
    tag: null,
  },
];

export function FeaturesModal({ open, onClose }: FeaturesModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative z-10 mx-4 w-full max-w-lg rounded-xl border p-6 shadow-xl"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.backgroundColor = "var(--surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-tertiary)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>

            <h2
              className="font-serif text-xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Synthio
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              An AI voice presenter that narrates slides, answers your questions, and navigates the deck conversationally.
            </p>

            <div className="mt-5 space-y-3">
              {features.map((feature) => (
                <div key={feature.title} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-xs"
                    style={{ backgroundColor: "var(--surface-alt)" }}
                  >
                    {feature.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-xs font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {feature.title}
                      </span>
                      {feature.tag === "core" && (
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                          style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent)" }}
                        >
                          core
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-md py-2.5 text-sm font-medium text-white transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Got it, let's start
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
