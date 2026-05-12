"use client";

import { motion, AnimatePresence } from "framer-motion";

interface FeaturesModalProps {
  open: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: "🎙️",
    title: "Voice Narration",
    description: "AI presents each slide like a live speaker",
  },
  {
    icon: "✋",
    title: "Interruption",
    description: "Start speaking anytime to interrupt the AI",
  },
  {
    icon: "🧭",
    title: "Slide Navigation",
    description: "Ask to go to any topic and AI navigates",
  },
  {
    icon: "🔍",
    title: "Zone Interaction",
    description:
      "Long-press (500ms) any diagram element for a deep explanation",
  },
  {
    icon: "💬",
    title: "Smart Follow-ups",
    description: "Contextual follow-up questions appear as clickable chips",
  },
  {
    icon: "🎯",
    title: "Audience Adaptation",
    description: "AI adjusts language depth based on your questions",
  },
  {
    icon: "▶️",
    title: "Resume",
    description:
      'Say "continue" after interrupting to pick up where it left off',
  },
  {
    icon: "⏭️",
    title: "Auto-advance",
    description:
      "Slides advance automatically after 5 seconds if no interaction",
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
          {/* Backdrop */}
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

          {/* Modal card */}
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
            {/* Close button */}
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>

            {/* Title */}
            <h2
              className="mb-1 font-mono text-sm font-semibold tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              Features
            </h2>
            <p
              className="mb-5 font-mono text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Everything Synthio can do during a presentation
            </p>

            {/* Feature list */}
            <ul className="space-y-3">
              {features.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-alt)" }}
                  >
                    {feature.icon}
                  </span>
                  <div className="min-w-0">
                    <span
                      className="font-mono text-xs font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {feature.title}
                    </span>
                    <p
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {feature.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
