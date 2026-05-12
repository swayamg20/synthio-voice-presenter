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

type CardConfig = {
  zone: Zone;
  title: string;
  description: string;
  icon: "code" | "research" | "support";
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
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

function CardIcon({ icon }: { icon: CardConfig["icon"] }) {
  if (icon === "code") {
    return (
      <svg viewBox="0 0 72 72" aria-hidden="true" className="h-16 w-16">
        <rect
          x="8"
          y="12"
          width="56"
          height="44"
          rx="10"
          fill="var(--surface-hover)"
          stroke="var(--border)"
          strokeWidth="3"
        />
        <path
          d="M22 31 15 38 22 45M50 31 57 38 50 45M40 25 32 49"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (icon === "research") {
    return (
      <svg viewBox="0 0 72 72" aria-hidden="true" className="h-16 w-16">
        <path
          d="M14 17h17c7 0 11 4 11 11v29c0-7-4-11-11-11H14V17Z"
          fill="var(--surface-hover)"
          stroke="var(--border)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M58 17H42c-7 0-11 4-11 11v29c0-7 4-11 11-11h16V17Z"
          fill="var(--surface-hover)"
          stroke="var(--border)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle
          cx="45"
          cy="36"
          r="9"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
        />
        <path
          d="M52 43 59 50M20 27h11M20 36h8"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 72 72" aria-hidden="true" className="h-16 w-16">
      <path
        d="M18 39v-5c0-13 8-22 18-22s18 9 18 22v5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <rect
        x="11"
        y="34"
        width="12"
        height="19"
        rx="6"
        fill="var(--surface-hover)"
        stroke="var(--border)"
        strokeWidth="3"
      />
      <rect
        x="49"
        y="34"
        width="12"
        height="19"
        rx="6"
        fill="var(--surface-hover)"
        stroke="var(--border)"
        strokeWidth="3"
      />
      <path
        d="M54 53c-3 7-9 10-18 10h-5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="28" cy="63" r="4" fill="var(--accent)" />
    </svg>
  );
}

export function CardsLayout({
  slide,
  highlightedZone,
  onZoneLongPress,
}: SlideLayoutProps) {
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cards: CardConfig[] = [
    {
      zone: getZone(slide, "coding_card"),
      title: "Coding Agent",
      description: "Reads the repo, edits code, runs tests, and iterates from real feedback.",
      icon: "code",
    },
    {
      zone: getZone(slide, "research_card"),
      title: "Research Agent",
      description: "Searches across sources, compares claims, and returns decision-ready synthesis.",
      icon: "research",
    },
    {
      zone: getZone(slide, "support_card"),
      title: "Support Agent",
      description: "Checks account state, applies policy, resolves issues, and escalates edge cases.",
      icon: "support",
    },
  ];

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
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onZoneLongPress(zone);
      }
    },
  });

  const isHighlighted = (zone: Zone) =>
    highlightedZone === zone.id || highlightedZone === zone.svgElementId;

  return (
    <motion.section
      aria-labelledby="cards-layout-title"
      className="flex h-full w-full flex-col justify-center overflow-hidden px-6 py-5 font-sans sm:px-10 lg:px-16"
      style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)", borderRadius: 12 }}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="mb-5 max-w-4xl">
        <h2
          id="cards-layout-title"
          className="font-serif text-[clamp(1.75rem,3.5vw,2.8rem)] font-semibold leading-[0.96] tracking-normal"
        >
          {slide.title}
        </h2>
        {slide.subtitle ? (
          <p
            className="mt-4 max-w-2xl text-[clamp(1rem,1.7vw,1.35rem)] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {slide.subtitle}
          </p>
        ) : null}
      </motion.div>

      <div className="grid gap-5 md:grid-cols-3 xl:gap-7">
        {cards.map((card, index) => {
          const active = isHighlighted(card.zone);

          return (
            <motion.div
              key={card.zone.id}
              id={card.zone.svgElementId}
              role="button"
              tabIndex={0}
              aria-label={card.zone.label}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border p-5 outline-none transition"
              style={{
                background: "#FFFFFF",
                borderColor: active ? "var(--highlight)" : "var(--border)",
                boxShadow: active
                  ? "0 0 0 2px var(--highlight), 0 0 34px color-mix(in srgb, var(--highlight) 20%, transparent)"
                  : "0 4px 24px rgba(28, 25, 23, 0.06), 0 1px 4px rgba(28, 25, 23, 0.04)",
              }}
              variants={itemVariants}
              whileHover={{
                y: -8,
                scale: 1.03,
                boxShadow:
                  "0 16px 48px rgba(28, 25, 23, 0.1), 0 0 24px color-mix(in srgb, var(--accent) 12%, transparent)",
              }}
              whileTap={{ scale: 0.99 }}
              {...zoneEvents(card.zone)}
            >
              <div
                className="absolute right-[-54px] top-[-58px] h-40 w-40 rounded-full transition group-hover:scale-110"
                style={{ backgroundColor: "var(--accent)", opacity: 0.04 + index * 0.015 }}
              />
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: "var(--surface-hover)",
                  borderColor: "var(--border)",
                }}
              >
                <CardIcon icon={card.icon} />
              </div>
              <h3 className="font-serif text-xl font-semibold leading-tight tracking-normal">
                {card.title}
              </h3>
              <p
                className="mt-2 text-sm font-medium leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {card.description}
              </p>
              <div
                className="absolute bottom-0 left-7 right-7 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, var(--accent), transparent)",
                  opacity: 0.3,
                }}
              />
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

export default CardsLayout;
