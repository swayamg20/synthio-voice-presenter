"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ActivityPanel } from "@/components/ActivityPanel";
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

  const slide = slides.find((s) => s.id === currentSlide) ?? slides[0];

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
        <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
          {currentSlide}/{slides.length}
        </span>
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
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-6">
            <div className="w-full max-w-4xl">
              <div className="mb-4">
                <h1 className="font-serif text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {slide.title}
                </h1>
                {slide.subtitle && (
                  <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>{slide.subtitle}</p>
                )}
              </div>

              <SlideStage
                currentSlide={slide}
                highlightedZone={highlightedZone}
                onZoneLongPress={onZoneLongPress}
                direction={direction}
                subtitle={currentSentence}
              />

              <div className="mt-4">
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
                    className="mt-3 flex flex-wrap justify-center gap-2"
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
    </div>
  );
}
