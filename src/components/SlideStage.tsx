"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  CardsLayout,
  CircularLayout,
  RadialLayout,
  SplitLayout,
  StackLayout,
  TimelineLayout,
} from "@/components/slides";
import type { Slide, Zone } from "@/lib/types";

type SlideStageProps = {
  currentSlide: Slide;
  highlightedZone: string | null;
  onZoneLongPress: (zone: Zone) => void;
  direction: 1 | -1;
  subtitle: string;
};

type SlideLayoutProps = {
  slide: Slide;
  highlightedZone: string | null;
  onZoneLongPress: (zone: Zone) => void;
};

const transition = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1],
} as const;

const slideVariants: Variants = {
  enter: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction === 1 ? 80 : -80,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition,
  },
  exit: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction === 1 ? -80 : 80,
    transition,
  }),
};

function renderLayout({ slide, highlightedZone, onZoneLongPress }: SlideLayoutProps) {
  switch (slide.layout) {
    case "split":
      return <SplitLayout slide={slide} highlightedZone={highlightedZone} onZoneLongPress={onZoneLongPress} />;
    case "circular":
      return <CircularLayout slide={slide} highlightedZone={highlightedZone} onZoneLongPress={onZoneLongPress} />;
    case "radial":
      return <RadialLayout slide={slide} highlightedZone={highlightedZone} onZoneLongPress={onZoneLongPress} />;
    case "stack":
      return <StackLayout slide={slide} highlightedZone={highlightedZone} onZoneLongPress={onZoneLongPress} />;
    case "cards":
      return <CardsLayout slide={slide} highlightedZone={highlightedZone} onZoneLongPress={onZoneLongPress} />;
    case "timeline":
      return <TimelineLayout slide={slide} highlightedZone={highlightedZone} onZoneLongPress={onZoneLongPress} />;
    default: {
      const exhaustiveCheck: never = slide.layout;
      return exhaustiveCheck;
    }
  }
}

export function SlideStage({ currentSlide, highlightedZone, onZoneLongPress, direction, subtitle }: SlideStageProps) {
  return (
    <div
      className="w-full overflow-hidden rounded-lg"
      style={{
        backgroundColor: "var(--surface)",
        boxShadow: "0 0 0 1px var(--border), 0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div className="relative aspect-video w-full overflow-hidden">
        <AnimatePresence custom={direction} initial={false} mode="wait">
          <motion.div
            key={currentSlide.id}
            className="h-full w-full"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {renderLayout({ slide: currentSlide, highlightedZone, onZoneLongPress })}
          </motion.div>
        </AnimatePresence>

        {/* Movie-style subtitle overlay */}
        <AnimatePresence mode="wait">
          {subtitle && (
            <motion.div
              key={subtitle}
              className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-8 pb-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <p
                className="max-w-[85%] rounded-md px-4 py-2 text-center font-serif text-[15px] italic leading-relaxed"
                style={{
                  backgroundColor: "rgba(24, 24, 27, 0.78)",
                  color: "#FAFAFA",
                  backdropFilter: "blur(8px)",
                }}
              >
                {subtitle}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
