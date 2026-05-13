"use client";

import slides from "@/lib/slides";

type SlideIndicatorsProps = {
  currentSlide: number;
  totalSlides: number;
  onNext: () => void;
  onPrev: () => void;
};

export function SlideIndicators({ currentSlide, totalSlides, onNext, onPrev }: SlideIndicatorsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentSlide <= 1}
        aria-label="Previous slide"
        className="grid h-7 w-7 place-items-center rounded transition disabled:opacity-20"
        style={{ color: "var(--text-secondary)" }}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSlides }, (_, i) => {
          const isActive = i + 1 === currentSlide;
          const slideData = slides[i];
          return (
            <div
              key={i}
              title={slideData ? `${i + 1}. ${slideData.title}` : undefined}
              className="rounded-full transition-all duration-200"
              style={{
                width: isActive ? 20 : 6,
                height: 6,
                backgroundColor: isActive ? "var(--accent)" : "var(--border-strong)",
                cursor: "default",
              }}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={currentSlide >= totalSlides}
        aria-label="Next slide"
        className="grid h-7 w-7 place-items-center rounded transition disabled:opacity-20"
        style={{ color: "var(--text-secondary)" }}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
