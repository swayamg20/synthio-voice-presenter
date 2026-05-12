"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ActivityPanel } from "@/components/ActivityPanel";
import { FeaturesModal } from "@/components/FeaturesModal";
import { SlideIndicators } from "@/components/SlideIndicators";
import { SlideStage } from "@/components/SlideStage";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import slides from "@/lib/slides";

export default function Home() {
  const {
    state,
    currentSlide,
    highlightedZone,
    direction,
    startPresentation,
    onZoneLongPress,
    nextSlide,
    prevSlide,
    toggleMic,
    waveformRef,
    currentSentence,
    activityLog,
    followUps,
    userExpertise,
    onFollowUpClick,
  } = useVoiceSession();

  const [featuresOpen, setFeaturesOpen] = useState(false);

  const slide = slides.find((s) => s.id === currentSlide) ?? slides[0];
  const isIdle = state === "idle";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header
        className="flex flex-shrink-0 items-center justify-between px-5 py-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
            Synthio
          </span>
          <span className="font-mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>/</span>
          <span className="font-mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>AI Agents</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {currentSlide} / {slides.length}
          </span>
          <button
            type="button"
            onClick={() => setFeaturesOpen(true)}
            className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm1 12H7V7h2v5ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
            </svg>
            Features
          </button>
        </div>
      </header>

      {/* 2-pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Agent panel */}
        <aside
          className="flex w-72 flex-shrink-0 flex-col overflow-hidden"
          style={{ borderRight: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
        >
          <ActivityPanel
            state={state}
            activityLog={activityLog}
            currentSentence={currentSentence}
            onStart={startPresentation}
            onMicToggle={toggleMic}
            waveformRef={waveformRef}
            userExpertise={userExpertise}
          />
        </aside>

        {/* Right — Presentation */}
        <main className="flex flex-1 flex-col overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-3">
            <div className="w-full max-w-5xl">
              <SlideStage
                currentSlide={slide}
                highlightedZone={highlightedZone}
                onZoneLongPress={onZoneLongPress}
                direction={direction}
              />

              {/* Subtitle below slide */}
              <div className="mt-2 flex min-h-[2.5rem] items-center justify-center">
                <AnimatePresence mode="wait">
                  {currentSentence && !isIdle && (
                    <motion.div
                      key={currentSentence}
                      className="max-w-3xl rounded-md px-4 py-2"
                      style={{
                        backgroundColor: "rgba(24, 24, 27, 0.82)",
                        backdropFilter: "blur(6px)",
                      }}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <p className="text-center font-serif text-sm italic leading-relaxed text-white/90">
                        {currentSentence}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation + follow-ups */}
              <div className="mt-1">
                <SlideIndicators
                  currentSlide={currentSlide}
                  totalSlides={slides.length}
                  onNext={nextSlide}
                  onPrev={prevSlide}
                />
              </div>

              <AnimatePresence>
                {followUps.length > 0 && state === "waiting" && (
                  <motion.div
                    className="mt-2 flex flex-wrap justify-center gap-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                  >
                    {followUps.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => onFollowUpClick(question)}
                        className="rounded-full border px-3 py-1 font-mono text-xs transition-colors"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text-secondary)",
                          backgroundColor: "transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--accent)";
                          e.currentTarget.style.color = "var(--accent)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border)";
                          e.currentTarget.style.color = "var(--text-secondary)";
                        }}
                      >
                        {question}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>

      <FeaturesModal open={featuresOpen} onClose={() => setFeaturesOpen(false)} />
    </div>
  );
}
