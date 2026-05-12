"use client";

import { useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { Slide, Zone } from "@/lib/types";

type SlideLayoutProps = {
  slide: Slide;
  highlightedZone: string | null;
  onZoneLongPress: (zone: Zone) => void;
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.11, delayChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const lineVariants: Variants = {
  hidden: { opacity: 0, pathLength: 0 },
  show: {
    opacity: 1,
    pathLength: 1,
    transition: { duration: 1.05, ease: [0.22, 1, 0.36, 1] },
  },
};

function getZone(slide: Slide, id: string): Zone {
  return (
    slide.zones.find((zone) => zone.id === id) ?? {
      id,
      label: id,
      description: "",
      svgElementId: id,
    }
  );
}

export function TimelineLayout({
  slide,
  highlightedZone,
  onZoneLongPress,
}: SlideLayoutProps) {
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const single = getZone(slide, "single");
  const multi = getZone(slide, "multi");
  const autonomous = getZone(slide, "autonomous");
  const safety = getZone(slide, "safety_callout");
  const displayTitle = slide.title === "Whats Next" ? "What's Next" : slide.title;

  const clearTimer = useCallback((zoneId: string) => {
    clearTimeout(timersRef.current[zoneId]);
    delete timersRef.current[zoneId];
  }, []);

  const startLongPress = useCallback(
    (zone: Zone) => {
      clearTimer(zone.id);
      timersRef.current[zone.id] = setTimeout(() => {
        onZoneLongPress(zone);
        delete timersRef.current[zone.id];
      }, 500);
    },
    [clearTimer, onZoneLongPress],
  );

  const zoneEvents = (zone: Zone) => ({
    onPointerDown: () => startLongPress(zone),
    onPointerUp: () => clearTimer(zone.id),
    onPointerLeave: () => clearTimer(zone.id),
    onPointerCancel: () => clearTimer(zone.id),
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onZoneLongPress(zone);
      }
    },
  });

  const isHighlighted = (zone: Zone) =>
    highlightedZone === zone.id || highlightedZone === zone.svgElementId;

  const node = (
    zone: Zone,
    cx: number,
    radius: number,
    label: string,
    caption: string,
  ) => {
    const active = isHighlighted(zone);

    return (
      <motion.g
        key={zone.id}
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={zone.label}
        style={{ transformOrigin: `${cx}px 350px` }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 24px color-mix(in srgb, var(--accent) 28%, transparent))",
        }}
        {...zoneEvents(zone)}
      >
        <circle cx={cx} cy="350" r={radius + 19} fill="var(--accent)" opacity="0.05" />
        <circle
          id={zone.svgElementId}
          cx={cx}
          cy="350"
          r={radius}
          fill={radius > 60 ? "var(--accent)" : "#FFFFFF"}
          fillOpacity={radius > 60 ? 0.92 : 1}
          stroke={active ? "var(--highlight)" : "var(--accent)"}
          strokeWidth={active ? 5 : radius > 60 ? 3 : 1.5}
          filter={active ? "url(#timeline-glow)" : undefined}
        />
        <text
          x={cx}
          y={radius > 60 ? 358 : 357}
          textAnchor="middle"
          className="font-sans"
          fill={radius > 60 ? "#FFFFFF" : "var(--text-primary)"}
          fontSize={radius > 60 ? 17 : 15}
          fontWeight="850"
        >
          {radius > 60 ? "AUTO" : radius > 50 ? "TEAM" : "ONE"}
        </text>
        <text
          x={cx}
          y={456 + (radius - 42) * 0.36}
          textAnchor="middle"
          className="font-serif"
          fill="var(--text-primary)"
          fontSize={radius > 60 ? 35 : radius > 50 ? 31 : 27}
          fontWeight="650"
        >
          {label}
        </text>
        <text
          x={cx}
          y={493 + (radius - 42) * 0.36}
          textAnchor="middle"
          className="font-sans"
          fill="var(--text-secondary)"
          fontSize="16"
          fontWeight="600"
        >
          {caption}
        </text>
      </motion.g>
    );
  };

  return (
    <motion.svg
      viewBox="0 0 1200 675"
      role="img"
      aria-labelledby="timeline-layout-title timeline-layout-subtitle"
      className="h-full w-full"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <defs>
        <filter id="timeline-glow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0.39 0 0 0 0.39 0 0.4 0 0 0.4 0 0 0.95 0 0.95 0 0 0 0.32 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="timeline-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
          <stop offset="48%" stopColor="var(--accent)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="timeline-safety-fill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      <rect width="1200" height="675" fill="var(--surface)" rx="12" />
      <motion.circle
        cx="952"
        cy="350"
        r="236"
        fill="var(--accent)"
        opacity="0.03"
        variants={itemVariants}
      />
      <motion.path
        d="M185 555 C390 610 802 610 1015 555"
        fill="none"
        stroke="var(--border)"
        strokeWidth="2"
        opacity="0.5"
        variants={itemVariants}
      />

      <motion.text
        id="timeline-layout-title"
        x="80"
        y="92"
        className="font-serif"
        fill="var(--text-primary)"
        fontSize="58"
        fontWeight="650"
        letterSpacing="0"
        variants={itemVariants}
      >
        {displayTitle}
      </motion.text>
      {slide.subtitle ? (
        <motion.text
          id="timeline-layout-subtitle"
          x="82"
          y="132"
          className="font-sans"
          fill="var(--text-secondary)"
          fontSize="20"
          fontWeight="500"
          variants={itemVariants}
        >
          {slide.subtitle}
        </motion.text>
      ) : null}

      <motion.path
        d="M250 350 H950"
        stroke="url(#timeline-line)"
        strokeWidth="7"
        strokeLinecap="round"
        variants={lineVariants}
      />
      <motion.path
        d="M250 350 H950"
        stroke="var(--text-primary)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.08"
        variants={lineVariants}
      />

      {node(single, 265, 42, "Single Agent", "One loop, one goal")}
      {node(multi, 600, 56, "Multi-Agent", "Specialized collaborators")}
      {node(autonomous, 935, 72, "Autonomous", "Long-running workflows")}

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={safety.label}
        style={{ transformOrigin: "600px 584px" }}
        whileHover={{
          scale: 1.03,
          filter:
            "drop-shadow(0 0 22px color-mix(in srgb, var(--accent) 24%, transparent))",
        }}
        {...zoneEvents(safety)}
      >
        <rect
          id={safety.svgElementId}
          x="258"
          y="555"
          width="684"
          height="72"
          rx="36"
          fill="url(#timeline-safety-fill)"
          stroke={isHighlighted(safety) ? "var(--highlight)" : "var(--border)"}
          strokeWidth={isHighlighted(safety) ? 4 : 1.5}
          filter={isHighlighted(safety) ? "url(#timeline-glow)" : undefined}
        />
        <circle cx="312" cy="591" r="18" fill="var(--accent)" opacity="0.1" />
        <path
          d="M312 574 328 581V593c0 17-16 25-16 25s-16-8-16-25v-12l16-7Z"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <text
          x="354"
          y="587"
          className="font-sans"
          fill="var(--text-primary)"
          fontSize="20"
          fontWeight="850"
        >
          Safety scales with autonomy
        </text>
        <text
          x="354"
          y="612"
          className="font-sans"
          fill="var(--text-secondary)"
          fontSize="16"
          fontWeight="600"
        >
          Permissions, evaluations, audit trails, and human control stay in the loop.
        </text>
      </motion.g>
    </motion.svg>
  );
}

export default TimelineLayout;
