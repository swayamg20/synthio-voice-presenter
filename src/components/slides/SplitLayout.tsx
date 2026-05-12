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
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
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

export function SplitLayout({
  slide,
  highlightedZone,
  onZoneLongPress,
}: SlideLayoutProps) {
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const llmZone = getZone(slide, "llm_box");
  const agentZone = getZone(slide, "agent_box");
  const differenceZone = getZone(slide, "difference_arrow");

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

  return (
    <motion.svg
      viewBox="0 0 1200 675"
      role="img"
      aria-labelledby="split-layout-title split-layout-subtitle"
      className="h-full w-full"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <defs>
        <marker
          id="split-arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
        </marker>
        <filter id="split-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" result="blur" />
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
        <linearGradient id="split-agent-wash" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.08" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="1200" height="675" fill="var(--surface)" rx="12" />
      <motion.circle
        cx="945"
        cy="135"
        r="190"
        fill="var(--accent)"
        opacity="0.05"
        variants={itemVariants}
      />
      <motion.circle
        cx="225"
        cy="530"
        r="150"
        fill="var(--border)"
        opacity="0.3"
        variants={itemVariants}
      />

      <motion.text
        id="split-layout-title"
        x="80"
        y="92"
        className="font-serif"
        fill="var(--text-primary)"
        fontSize="58"
        fontWeight="650"
        letterSpacing="0"
        variants={itemVariants}
      >
        {slide.title}
      </motion.text>
      {slide.subtitle ? (
        <motion.text
          id="split-layout-subtitle"
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

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={llmZone.label}
        style={{ transformOrigin: "315px 365px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 22px color-mix(in srgb, var(--accent) 20%, transparent))",
        }}
        {...zoneEvents(llmZone)}
      >
        <rect
          id={llmZone.svgElementId}
          x="110"
          y="210"
          width="410"
          height="310"
          rx="34"
          fill="#FFFFFF"
          stroke={isHighlighted(llmZone) ? "var(--highlight)" : "var(--border)"}
          strokeWidth={isHighlighted(llmZone) ? 4 : 1.5}
          filter={isHighlighted(llmZone) ? "url(#split-soft-glow)" : undefined}
        />
        <path
          d="M210 338c-20 0-36-16-36-36 0-14 8-26 20-32 2-22 20-39 43-39 13 0 25 6 33 15 8-9 20-15 34-15 23 0 42 17 44 40 14 7 23 22 23 39 0 24-19 43-43 43h-15c-7 0-13-6-13-13v-88M270 246v106M237 270c15 0 29 9 35 23M304 276c-16 2-28 13-32 28M218 307c12-1 22 5 28 15M331 305c-12 0-23 7-28 18"
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.72"
        />
        <text
          x="315"
          y="392"
          textAnchor="middle"
          className="font-serif"
          fill="var(--text-primary)"
          fontSize="56"
          fontWeight="650"
        >
          LLM
        </text>
        <text
          x="315"
          y="433"
          textAnchor="middle"
          className="font-sans"
          fill="var(--text-secondary)"
          fontSize="22"
          fontWeight="600"
        >
          Generates Text
        </text>
      </motion.g>

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={agentZone.label}
        style={{ transformOrigin: "885px 365px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 26px color-mix(in srgb, var(--accent) 28%, transparent))",
        }}
        {...zoneEvents(agentZone)}
      >
        <rect
          id={agentZone.svgElementId}
          x="680"
          y="210"
          width="410"
          height="310"
          rx="34"
          fill="url(#split-agent-wash)"
          stroke={isHighlighted(agentZone) ? "var(--highlight)" : "var(--accent)"}
          strokeWidth={isHighlighted(agentZone) ? 4 : 2}
          filter="url(#split-soft-glow)"
        />
        <path
          d="M772 337c-18 0-32-15-32-33 0-13 7-24 18-30 2-20 19-35 39-35 12 0 23 5 30 14 8-9 19-14 31-14 21 0 38 15 40 36 12 7 20 20 20 35 0 22-18 40-40 40h-12c-6 0-11-5-11-11v-82M827 254v98M798 277c13 0 25 8 31 20M858 282c-14 2-25 12-29 25"
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.72"
        />
        <g transform="translate(914 306)">
          <circle
            r="31"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M0-48v17M0 31v17M34-34 22-22M-22 22-34 34M48 0H31M-31 0h-17M34 34 22 22M-22-22-34-34"
            stroke="var(--accent)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle r="9" fill="var(--accent)" />
        </g>
        <text
          x="885"
          y="392"
          textAnchor="middle"
          className="font-serif"
          fill="var(--text-primary)"
          fontSize="56"
          fontWeight="650"
        >
          Agent
        </text>
        <text
          x="885"
          y="433"
          textAnchor="middle"
          className="font-sans"
          fill="var(--text-secondary)"
          fontSize="22"
          fontWeight="600"
        >
          Takes Action
        </text>
      </motion.g>

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={differenceZone.label}
        style={{ transformOrigin: "600px 365px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 18px color-mix(in srgb, var(--accent) 28%, transparent))",
        }}
        {...zoneEvents(differenceZone)}
      >
        <path
          id={differenceZone.svgElementId}
          d="M548 365 C575 342 625 342 652 365"
          fill="none"
          stroke={isHighlighted(differenceZone) ? "var(--highlight)" : "var(--accent)"}
          strokeWidth={isHighlighted(differenceZone) ? 5 : 4}
          strokeLinecap="round"
          markerEnd="url(#split-arrowhead)"
        />
        <rect
          x="498"
          y="294"
          width="204"
          height="42"
          rx="21"
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth="1"
          opacity="0.94"
        />
        <text
          x="600"
          y="321"
          textAnchor="middle"
          className="font-sans"
          fill="var(--text-primary)"
          fontSize="16"
          fontWeight="700"
        >
          The Key Difference
        </text>
      </motion.g>
    </motion.svg>
  );
}

export default SplitLayout;
