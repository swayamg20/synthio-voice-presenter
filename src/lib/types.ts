export type Zone = {
  id: string;
  label: string;
  description: string;
  svgElementId: string;
};

export type SlideLayout =
  | "split"
  | "circular"
  | "radial"
  | "stack"
  | "cards"
  | "timeline";

export type Slide = {
  id: number;
  title: string;
  subtitle?: string;
  bullets: string[];
  narrationHint: string;
  zones: Zone[];
  layout: SlideLayout;
};

export type HistoryEntry = {
  role: "assistant" | "user";
  content: string;
  metadata: {
    type: "narration" | "answer" | "question" | "zone_query" | "control";
    slide: number;
    interrupted?: boolean;
    spokenUpTo?: string;
    timestamp: number;
  };
};

export type OrchestratorState =
  | "idle"
  | "narrating"
  | "waiting"
  | "listening"
  | "thinking"
  | "responding"
  | "paused";

export type ActivityEvent = {
  id: number;
  type: "narrate" | "listen" | "think" | "respond" | "navigate" | "highlight" | "interrupt" | "error";
  message: string;
  timestamp: number;
};

export type UserExpertise = "unknown" | "beginner" | "intermediate" | "expert";

export type OrchestratorData = {
  currentSlide: number;
  transcript: string;
  highlightedZone: string | null;
  spokenSoFar: string[];
  conversationHistory: HistoryEntry[];
  currentSentence: string;
  activityLog: ActivityEvent[];
  followUps: string[];
  userExpertise: UserExpertise;
};

export type ToolCall = {
  name: string;
  // Tool arguments are dynamic JSON payloads produced by the LLM/tool registry boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
};

export type ChatRequest = {
  transcript: string;
  currentSlide: number;
  conversationHistory: HistoryEntry[];
  interruptContext?: {
    wasNarrating: boolean;
    spokenSoFar: string[];
    slideBeingNarrated: number;
  };
  zoneContext?: {
    zoneId: string;
    zoneLabel: string;
    zoneDescription: string;
  };
};

export type ChatResponse = {
  text: string;
  toolCalls: ToolCall[];
  followUps: string[];
  expertiseAssessment?: UserExpertise;
};

export type NarrateRequest = {
  slideNumber: number;
  previousContext?: {
    slidesPresented: number[];
    lastInteraction?: string;
  };
};

export type NarrateResponse = {
  narrationText: string;
  followUps: string[];
};
