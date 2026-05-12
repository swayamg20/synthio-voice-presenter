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
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
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

export function CircularLayout({
  slide,
  highlightedZone,
  onZoneLongPress,
}: SlideLayoutProps) {
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const observeZone = getZone(slide, "observe");
  const thinkZone = getZone(slide, "think");
  const actZone = getZone(slide, "act");
  const feedbackZone = getZone(slide, "feedback_arrow");

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

  const arrowMotion = {
    hidden: { opacity: 0, pathLength: 0 },
    show: {
      opacity: 0.86,
      pathLength: 1,
      strokeDashoffset: [0, -48],
      transition: {
        opacity: { duration: 0.35 },
        pathLength: { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
        strokeDashoffset: {
          duration: 2.8,
          repeat: Infinity,
          ease: "linear",
        },
      },
    },
  } satisfies Variants;

  return (
    <motion.svg
      viewBox="0 0 1200 675"
      role="img"
      aria-labelledby="circular-layout-title circular-layout-subtitle"
      className="h-full w-full"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <defs>
        <marker
          id="circular-arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
        </marker>
        <marker
          id="circular-arrowhead-highlight"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--highlight)" />
        </marker>
        <filter id="circular-glow" x="-35%" y="-35%" width="170%" height="170%">
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
        <radialGradient id="circular-node-wash" cx="35%" cy="20%" r="80%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.06" />
          <stop offset="54%" stopColor="#FFFFFF" stopOpacity="0.98" />
          <stop offset="100%" stopColor="var(--surface-hover)" stopOpacity="0.7" />
        </radialGradient>
      </defs>

      <rect width="1200" height="675" fill="var(--surface)" rx="12" />
      <motion.path
        d="M278 548 C442 617 762 617 926 548"
        fill="none"
        stroke="var(--border)"
        strokeWidth="2"
        opacity="0.5"
        variants={itemVariants}
      />
      <motion.circle
        cx="600"
        cy="363"
        r="246"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
        opacity="0.4"
        variants={itemVariants}
      />

      <motion.text
        id="circular-layout-title"
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
          id="circular-layout-subtitle"
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
        d="M541 262 C469 300 414 352 391 399"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="14 12"
        markerEnd="url(#circular-arrowhead)"
        variants={arrowMotion}
      />
      <motion.path
        d="M458 475 C540 543 660 543 742 475"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="14 12"
        markerEnd="url(#circular-arrowhead)"
        variants={arrowMotion}
      />
      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={feedbackZone.label}
        style={{ transformOrigin: "760px 328px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 20px color-mix(in srgb, var(--accent) 28%, transparent))",
        }}
        {...zoneEvents(feedbackZone)}
      >
        <motion.path
          id={feedbackZone.svgElementId}
          d="M809 398 C787 334 725 281 660 252"
          fill="none"
          stroke={isHighlighted(feedbackZone) ? "var(--highlight)" : "var(--accent)"}
          strokeWidth={isHighlighted(feedbackZone) ? 5 : 4}
          strokeLinecap="round"
          strokeDasharray="14 12"
          markerEnd={
            isHighlighted(feedbackZone)
              ? "url(#circular-arrowhead-highlight)"
              : "url(#circular-arrowhead)"
          }
          variants={arrowMotion}
        />
        <text
          x="875"
          y="319"
          className="font-sans"
          fill="var(--text-secondary)"
          fontSize="15"
          fontWeight="700"
          textAnchor="middle"
        >
          Feedback
        </text>
      </motion.g>

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={observeZone.label}
        style={{ transformOrigin: "600px 215px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 24px color-mix(in srgb, var(--accent) 24%, transparent))",
        }}
        {...zoneEvents(observeZone)}
      >
        <circle
          id={observeZone.svgElementId}
          cx="600"
          cy="215"
          r="92"
          fill="url(#circular-node-wash)"
          stroke={isHighlighted(observeZone) ? "var(--highlight)" : "var(--border)"}
          strokeWidth={isHighlighted(observeZone) ? 4 : 1.5}
          filter={isHighlighted(observeZone) ? "url(#circular-glow)" : undefined}
        />
        <path
          d="M551 208c14-24 32-36 49-36s35 12 49 36c-14 24-32 36-49 36s-35-12-49-36Z"
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <circle cx="600" cy="208" r="13" fill="var(--accent)" />
        <text
          x="600"
          y="277"
          textAnchor="middle"
          className="font-sans"
          fill="var(--text-primary)"
          fontSize="25"
          fontWeight="750"
        >
          Observe
        </text>
      </motion.g>

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={thinkZone.label}
        style={{ transformOrigin: "372px 455px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 24px color-mix(in srgb, var(--accent) 24%, transparent))",
        }}
        {...zoneEvents(thinkZone)}
      >
        <circle
          id={thinkZone.svgElementId}
          cx="372"
          cy="455"
          r="92"
          fill="url(#circular-node-wash)"
          stroke={isHighlighted(thinkZone) ? "var(--highlight)" : "var(--border)"}
          strokeWidth={isHighlighted(thinkZone) ? 4 : 1.5}
          filter={isHighlighted(thinkZone) ? "url(#circular-glow)" : undefined}
        />
        <circle cx="343" cy="423" r="11" fill="var(--accent)" />
        <circle cx="395" cy="413" r="11" fill="var(--accent)" opacity="0.75" />
        <circle cx="409" cy="462" r="11" fill="var(--accent)" />
        <circle cx="357" cy="475" r="11" fill="var(--accent)" opacity="0.75" />
        <path
          d="M353 424 386 416M399 424 407 451M398 464 369 473M361 464 346 434"
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.6"
        />
        <text
          x="372"
          y="517"
          textAnchor="middle"
          className="font-sans"
          fill="var(--text-primary)"
          fontSize="25"
          fontWeight="750"
        >
          Think
        </text>
      </motion.g>

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={actZone.label}
        style={{ transformOrigin: "828px 455px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 24px color-mix(in srgb, var(--accent) 24%, transparent))",
        }}
        {...zoneEvents(actZone)}
      >
        <circle
          id={actZone.svgElementId}
          cx="828"
          cy="455"
          r="92"
          fill="url(#circular-node-wash)"
          stroke={isHighlighted(actZone) ? "var(--highlight)" : "var(--border)"}
          strokeWidth={isHighlighted(actZone) ? 4 : 1.5}
          filter={isHighlighted(actZone) ? "url(#circular-glow)" : undefined}
        />
        <path
          d="M801 409v88l23-23 18 38 25-12-19-38h33L801 409Z"
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="7"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M869 414 888 395M884 447h28M836 393v-27"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <text
          x="828"
          y="517"
          textAnchor="middle"
          className="font-sans"
          fill="var(--text-primary)"
          fontSize="25"
          fontWeight="750"
        >
          Act
        </text>
      </motion.g>
    </motion.svg>
  );
}

export default CircularLayout;
