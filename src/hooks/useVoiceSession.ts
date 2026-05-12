"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";
import { VoiceOrchestrator } from "@/lib/orchestrator";
import type {
  ActivityEvent,
  OrchestratorState,
  UserExpertise,
  Zone,
} from "@/lib/types";

type UseVoiceSessionResult = {
  state: OrchestratorState;
  currentSlide: number;
  highlightedZone: string | null;
  direction: 1 | -1;
  startPresentation: () => void;
  onZoneLongPress: (zone: Zone) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  toggleMic: () => void;
  waveformRef: RefObject<HTMLCanvasElement | null>;
  currentSentence: string;
  activityLog: ActivityEvent[];
  followUps: string[];
  userExpertise: UserExpertise;
  onFollowUpClick: (question: string) => void;
};

const WAVEFORM_COLORS: Record<OrchestratorState, string> = {
  idle: "#D4D4D8",
  narrating: "#0D9488",
  waiting: "#D4D4D8",
  listening: "#22C55E",
  thinking: "#5EEAD4",
  responding: "#0D9488",
  paused: "#D4D4D8",
};

function resizeCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const context = canvas.getContext("2d");

  if (!context || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const ratio = window.devicePixelRatio || 1;
  const width = Math.floor(rect.width * ratio);
  const height = Math.floor(rect.height * ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  data: Uint8Array | null,
  state: OrchestratorState,
  frameTime: number,
) {
  const context = resizeCanvas(canvas);

  if (!context) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  const midY = height / 2;
  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 2;
  context.strokeStyle = WAVEFORM_COLORS[state];
  context.globalAlpha = state === "idle" || state === "waiting" ? 0.56 : 0.92;
  context.beginPath();

  const hasAudioData =
    data && data.length > 0 && (state === "narrating" || state === "responding");

  if (hasAudioData) {
    const step = Math.max(1, Math.floor(data.length / Math.max(1, width)));

    for (let x = 0; x < width; x += 1) {
      const sample = data[Math.min(data.length - 1, x * step)];
      const normalized = (sample - 128) / 128;
      const y = midY + normalized * height * 0.38;

      if (x === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
  } else {
    const amplitude = state === "listening" ? 4 : state === "thinking" ? 2.5 : 1.2;
    const speed = frameTime / (state === "thinking" ? 120 : 180);

    for (let x = 0; x < width; x += 1) {
      const y = midY + Math.sin(x / 18 + speed) * amplitude;

      if (x === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
  }

  context.stroke();
  context.globalAlpha = 1;
}

export function useVoiceSession(): UseVoiceSessionResult {
  const orchestratorRef = useRef<VoiceOrchestrator | null>(null);
  const waveformRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<OrchestratorState>("idle");
  const currentSlideRef = useRef(1);
  const [state, setState] = useState<OrchestratorState>("idle");
  const [currentSlide, setCurrentSlide] = useState(1);
  const [highlightedZone, setHighlightedZone] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [currentSentence, setCurrentSentence] = useState("");
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [userExpertise, setUserExpertise] = useState<UserExpertise>("unknown");

  useEffect(() => {
    const orchestrator = new VoiceOrchestrator((nextState, data) => {
      stateRef.current = nextState;
      setState(nextState);

      if (data.currentSlide !== currentSlideRef.current) {
        setDirection(data.currentSlide > currentSlideRef.current ? 1 : -1);
        currentSlideRef.current = data.currentSlide;
      }

      setCurrentSlide(data.currentSlide);
      setHighlightedZone(data.highlightedZone);
      setCurrentSentence(data.currentSentence);
      setActivityLog(data.activityLog);
      setFollowUps(data.followUps);
      setUserExpertise(data.userExpertise);
    });

    orchestratorRef.current = orchestrator;

    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;

    const render = (frameTime: number) => {
      const canvas = waveformRef.current;

      if (canvas) {
        drawWaveform(
          canvas,
          orchestratorRef.current?.getWaveformData() ?? null,
          stateRef.current,
          frameTime,
        );
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  const startPresentation = useCallback(() => {
    void orchestratorRef.current?.start();
  }, []);

  const onZoneLongPress = useCallback((zone: Zone) => {
    orchestratorRef.current?.handleZoneLongPress(zone);
  }, []);

  const nextSlide = useCallback(() => {
    orchestratorRef.current?.nextSlide();
  }, []);

  const prevSlide = useCallback(() => {
    orchestratorRef.current?.prevSlide();
  }, []);

  const toggleMic = useCallback(() => {
    orchestratorRef.current?.toggleMic();
  }, []);

  const onFollowUpClick = useCallback((question: string) => {
    orchestratorRef.current?.handleFollowUpClick(question);
  }, []);

  return {
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
  };
}
