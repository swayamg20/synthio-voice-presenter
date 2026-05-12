"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type StartScreenProps = {
  onStart: () => void;
  visible: boolean;
};

export function StartScreen({ onStart, visible }: StartScreenProps) {
  const [loading, setLoading] = useState(false);

  const handleStart = () => {
    setLoading(true);
    onStart();
  };

  return (
    <AnimatePresence
      onExitComplete={() => setLoading(false)}
    >
      {visible ? (
        <motion.div
          key="start-screen"
          className="fixed inset-0 z-50 grid place-items-center px-6"
          style={{
            backgroundColor: "var(--background)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1
              className="font-serif text-[clamp(4.5rem,13vw,10rem)] font-semibold leading-none tracking-normal"
              style={{ color: "var(--text-primary)" }}
            >
              Synthio
            </h1>
            <p
              className="mt-5 text-lg font-medium sm:text-2xl"
              style={{ color: "var(--text-secondary)" }}
            >
              An AI-powered talk on AI Agents
            </p>
            <motion.button
              type="button"
              onClick={handleStart}
              disabled={loading}
              className="mt-11 rounded-full px-8 py-4 text-base font-bold transition focus:outline-none focus-visible:ring-2 sm:px-10 sm:py-5 sm:text-lg disabled:opacity-80"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-primary)",
                boxShadow:
                  "0 18px 54px color-mix(in srgb, var(--accent) 34%, transparent)",
                "--tw-ring-color": "var(--accent)",
              } as React.CSSProperties}
              whileHover={loading ? {} : { y: -2, scale: 1.02 }}
              whileTap={loading ? {} : { scale: 0.98 }}
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Connecting...
                </span>
              ) : (
                "Start Presentation"
              )}
            </motion.button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
