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
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
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

export function StackLayout({
  slide,
  highlightedZone,
  onZoneLongPress,
}: SlideLayoutProps) {
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const shortTerm = getZone(slide, "short_term");
  const longTerm = getZone(slide, "long_term");
  const ragArrow = getZone(slide, "rag_arrow");
  const vectorStore = getZone(slide, "vector_store");

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
      aria-labelledby="stack-layout-title stack-layout-subtitle"
      className="h-full w-full"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <defs>
        <marker
          id="stack-arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
        </marker>
        <marker
          id="stack-arrowhead-highlight"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--highlight)" />
        </marker>
        <filter id="stack-glow" x="-30%" y="-30%" width="160%" height="160%">
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
        <linearGradient id="stack-short-fill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="stack-long-fill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--surface-hover)" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.88" />
        </linearGradient>
      </defs>

      <rect width="1200" height="675" fill="var(--surface)" rx="12" />
      <motion.path
        d="M155 552 C350 604 840 604 1045 552"
        fill="none"
        stroke="var(--border)"
        strokeWidth="2"
        opacity="0.5"
        variants={itemVariants}
      />
      <motion.circle
        cx="935"
        cy="265"
        r="158"
        fill="var(--accent)"
        opacity="0.04"
        variants={itemVariants}
      />

      <motion.text
        id="stack-layout-title"
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
          id="stack-layout-subtitle"
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
        aria-label={shortTerm.label}
        style={{ transformOrigin: "560px 245px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 22px color-mix(in srgb, var(--accent) 20%, transparent))",
        }}
        {...zoneEvents(shortTerm)}
      >
        <rect
          id={shortTerm.svgElementId}
          x="190"
          y="188"
          width="740"
          height="128"
          rx="30"
          fill="url(#stack-short-fill)"
          stroke={isHighlighted(shortTerm) ? "var(--highlight)" : "var(--border)"}
          strokeWidth={isHighlighted(shortTerm) ? 4 : 1.5}
          filter={isHighlighted(shortTerm) ? "url(#stack-glow)" : undefined}
        />
        <path
          d="M254 243h56M254 269h94M254 217h132"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.88"
        />
        <text
          x="430"
          y="245"
          className="font-serif"
          fill="var(--text-primary)"
          fontSize="38"
          fontWeight="650"
        >
          Short-Term Memory
        </text>
        <text
          x="432"
          y="279"
          className="font-sans"
          fill="var(--text-secondary)"
          fontSize="18"
          fontWeight="600"
        >
          Live conversation, recent tool results, working plan
        </text>
      </motion.g>

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={ragArrow.label}
        style={{ transformOrigin: "560px 365px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 18px color-mix(in srgb, var(--accent) 28%, transparent))",
        }}
        {...zoneEvents(ragArrow)}
      >
        <path
          id={ragArrow.svgElementId}
          d="M560 325 V398"
          stroke={isHighlighted(ragArrow) ? "var(--highlight)" : "var(--accent)"}
          strokeWidth={isHighlighted(ragArrow) ? 5 : 4}
          strokeLinecap="round"
          markerEnd={
            isHighlighted(ragArrow)
              ? "url(#stack-arrowhead-highlight)"
              : "url(#stack-arrowhead)"
          }
        />
        <rect x="521" y="350" width="78" height="38" rx="19" fill="var(--surface)" />
        <text
          x="560"
          y="375"
          textAnchor="middle"
          className="font-sans"
          fill="var(--text-primary)"
          fontSize="17"
          fontWeight="800"
        >
          RAG
        </text>
      </motion.g>

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={longTerm.label}
        style={{ transformOrigin: "535px 485px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 22px color-mix(in srgb, var(--accent) 20%, transparent))",
        }}
        {...zoneEvents(longTerm)}
      >
        <rect
          id={longTerm.svgElementId}
          x="160"
          y="420"
          width="750"
          height="150"
          rx="34"
          fill="url(#stack-long-fill)"
          stroke={isHighlighted(longTerm) ? "var(--highlight)" : "var(--border)"}
          strokeWidth={isHighlighted(longTerm) ? 4 : 1.5}
          filter={isHighlighted(longTerm) ? "url(#stack-glow)" : undefined}
        />
        <path
          d="M224 478c0-24 22-43 50-43s50 19 50 43-22 43-50 43-50-19-50-43Z"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
        />
        <path
          d="M244 478h60M274 448v60"
          stroke="var(--text-primary)"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.6"
        />
        <text
          x="385"
          y="481"
          className="font-serif"
          fill="var(--text-primary)"
          fontSize="38"
          fontWeight="650"
        >
          Long-Term Memory
        </text>
        <text
          x="387"
          y="516"
          className="font-sans"
          fill="var(--text-secondary)"
          fontSize="18"
          fontWeight="600"
        >
          Persistent knowledge, user preferences, project history
        </text>
      </motion.g>

      <motion.path
        d="M910 495 H946"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="8 10"
        variants={itemVariants}
      />

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={vectorStore.label}
        style={{ transformOrigin: "1010px 494px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 22px color-mix(in srgb, var(--accent) 24%, transparent))",
        }}
        {...zoneEvents(vectorStore)}
      >
        <path
          id={vectorStore.svgElementId}
          d="M954 458 C954 435 1066 435 1066 458 V526 C1066 551 954 551 954 526 Z"
          fill="#FFFFFF"
          stroke={isHighlighted(vectorStore) ? "var(--highlight)" : "var(--border)"}
          strokeWidth={isHighlighted(vectorStore) ? 4 : 1.5}
          filter={isHighlighted(vectorStore) ? "url(#stack-glow)" : undefined}
        />
        <ellipse
          cx="1010"
          cy="458"
          rx="56"
          ry="23"
          fill="var(--surface-hover)"
          stroke="var(--accent)"
          strokeWidth="4"
        />
        <path
          d="M954 493 C954 518 1066 518 1066 493"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          opacity="0.72"
        />
        <text
          x="1010"
          y="594"
          textAnchor="middle"
          className="font-sans"
          fill="var(--text-primary)"
          fontSize="20"
          fontWeight="750"
        >
          Vector Store
        </text>
      </motion.g>
    </motion.svg>
  );
}

export default StackLayout;
