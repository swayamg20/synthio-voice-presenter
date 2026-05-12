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
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] },
  },
};

const lineVariants: Variants = {
  hidden: { opacity: 0, pathLength: 0 },
  show: {
    opacity: 0.88,
    pathLength: 1,
    transition: { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
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

export function RadialLayout({
  slide,
  highlightedZone,
  onZoneLongPress,
}: SlideLayoutProps) {
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const agentCore = getZone(slide, "agent_core");
  const apiTool = getZone(slide, "api_tool");
  const codeTool = getZone(slide, "code_tool");
  const searchTool = getZone(slide, "search_tool");
  const dbTool = getZone(slide, "db_tool");

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

  const toolShell = (
    zone: Zone,
    cx: number,
    cy: number,
    title: string,
    icon: "api" | "code" | "search" | "database",
  ) => (
    <motion.g
      key={zone.id}
      variants={itemVariants}
      className="cursor-pointer transition"
      role="button"
      tabIndex={0}
      aria-label={zone.label}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      whileHover={{
        scale: 1.05,
        filter:
          "drop-shadow(0 0 22px color-mix(in srgb, var(--accent) 24%, transparent))",
      }}
      {...zoneEvents(zone)}
    >
      <circle
        id={zone.svgElementId}
        cx={cx}
        cy={cy}
        r="78"
        fill="#FFFFFF"
        stroke={isHighlighted(zone) ? "var(--highlight)" : "var(--border)"}
        strokeWidth={isHighlighted(zone) ? 4 : 1.5}
        filter={isHighlighted(zone) ? "url(#radial-glow)" : undefined}
      />
      <circle cx={cx} cy={cy} r="55" fill="var(--surface-hover)" opacity="0.42" />
      {icon === "api" ? (
        <path
          d={`M${cx - 6} ${cy - 39} L${cx - 36} ${cy + 4} H${cx - 4} L${cx - 16} ${
            cy + 39
          } L${cx + 36} ${cy - 13} H${cx + 7} Z`}
          fill="var(--accent)"
        />
      ) : null}
      {icon === "code" ? (
        <>
          <path
            d={`M${cx - 38} ${cy - 17} L${cx - 58} ${cy} L${cx - 38} ${cy + 17}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M${cx + 38} ${cy - 17} L${cx + 58} ${cy} L${cx + 38} ${cy + 17}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M${cx + 9} ${cy - 35} L${cx - 10} ${cy + 35}`}
            stroke="var(--text-primary)"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.6"
          />
        </>
      ) : null}
      {icon === "search" ? (
        <>
          <circle
            cx={cx - 9}
            cy={cy - 9}
            r="28"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
          />
          <path
            d={`M${cx + 13} ${cy + 13} L${cx + 41} ${cy + 41}`}
            stroke="var(--text-primary)"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.6"
          />
        </>
      ) : null}
      {icon === "database" ? (
        <>
          <ellipse
            cx={cx}
            cy={cy - 28}
            rx="40"
            ry="17"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="7"
          />
          <path
            d={`M${cx - 40} ${cy - 28} V${cy + 29} C${cx - 40} ${cy + 52} ${
              cx + 40
            } ${cy + 52} ${cx + 40} ${cy + 29} V${cy - 28}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="7"
          />
          <path
            d={`M${cx - 40} ${cy} C${cx - 40} ${cy + 23} ${cx + 40} ${cy + 23} ${
              cx + 40
            } ${cy}`}
            fill="none"
            stroke="var(--text-primary)"
            strokeWidth="6"
            opacity="0.5"
          />
        </>
      ) : null}
      <text
        x={cx}
        y={cy + 112}
        textAnchor="middle"
        className="font-sans"
        fill="var(--text-primary)"
        fontSize="23"
        fontWeight="750"
      >
        {title}
      </text>
    </motion.g>
  );

  return (
    <motion.svg
      viewBox="0 0 1200 675"
      role="img"
      aria-labelledby="radial-layout-title radial-layout-subtitle"
      className="h-full w-full"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <defs>
        <filter id="radial-glow" x="-35%" y="-35%" width="170%" height="170%">
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
        <radialGradient id="radial-core-wash" cx="36%" cy="25%" r="78%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.34" />
          <stop offset="42%" stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent-muted)" stopOpacity="1" />
        </radialGradient>
      </defs>

      <rect width="1200" height="675" fill="var(--surface)" rx="12" />
      <motion.circle
        cx="600"
        cy="365"
        r="270"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
        opacity="0.4"
        variants={itemVariants}
      />
      <motion.circle
        cx="600"
        cy="365"
        r="185"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
        opacity="0.5"
        variants={itemVariants}
      />

      <motion.text
        id="radial-layout-title"
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
          id="radial-layout-subtitle"
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
        d="M523 310 L398 249"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
        variants={lineVariants}
      />
      <motion.path
        d="M677 310 L802 249"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
        variants={lineVariants}
      />
      <motion.path
        d="M523 420 L398 481"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
        variants={lineVariants}
      />
      <motion.path
        d="M677 420 L802 481"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
        variants={lineVariants}
      />

      {toolShell(apiTool, 320, 210, "API", "api")}
      {toolShell(codeTool, 880, 210, "Code", "code")}
      {toolShell(searchTool, 320, 520, "Search", "search")}
      {toolShell(dbTool, 880, 520, "Database", "database")}

      <motion.g
        variants={itemVariants}
        className="cursor-pointer transition"
        role="button"
        tabIndex={0}
        aria-label={agentCore.label}
        style={{ transformOrigin: "600px 365px" }}
        whileHover={{
          scale: 1.05,
          filter:
            "drop-shadow(0 0 30px color-mix(in srgb, var(--accent) 35%, transparent))",
        }}
        {...zoneEvents(agentCore)}
      >
        <circle
          id={agentCore.svgElementId}
          cx="600"
          cy="365"
          r="112"
          fill="url(#radial-core-wash)"
          stroke={isHighlighted(agentCore) ? "var(--highlight)" : "var(--accent)"}
          strokeWidth={isHighlighted(agentCore) ? 5 : 3}
          filter="url(#radial-glow)"
        />
        <circle
          cx="600"
          cy="365"
          r="78"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.2"
          strokeWidth="2"
        />
        <path
          d="M563 351c-11 0-20-9-20-20 0-8 5-15 12-18 1-13 12-23 25-23 8 0 15 3 20 9 5-6 12-9 20-9 14 0 25 10 26 24 8 4 13 12 13 22 0 13-11 24-24 24h-8c-4 0-7-3-7-7v-51M600 302v62M582 318c8 0 16 5 19 13M620 321c-9 1-16 8-19 16"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <text
          x="600"
          y="405"
          textAnchor="middle"
          className="font-serif"
          fill="#FFFFFF"
          fontSize="33"
          fontWeight="700"
        >
          Agent
        </text>
        <text
          x="600"
          y="436"
          textAnchor="middle"
          className="font-sans"
          fill="#FFFFFF"
          fontSize="19"
          fontWeight="700"
          opacity="0.86"
        >
          Core
        </text>
      </motion.g>
    </motion.svg>
  );
}

export default RadialLayout;
