# Synth — Architecture Document

## Overview

Synth is an AI voice presenter that narrates slide decks like a real teacher. The AI presents proactively, users can interrupt with questions, click on diagram elements for deeper explanation, and navigate conversationally ("go back to that thing about tool calling"). The presentation topic is AI Agents (6 slides).

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         SLIDE STAGE                                │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │  React + SVG Diagram Component (per slide)                   │  │ │
│  │  │  - Interactive zones (SVG elements with long-press handlers) │  │ │
│  │  │  - Red laser highlight animation (stroke-dasharray)          │  │ │
│  │  │  - Framer Motion entry/exit transitions                      │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │                       ◂  ● ● ◉ ● ● ●  ▸                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         VOICE BAR                                  │ │
│  │  ◉ ══════════ real-time waveform (AnalyserNode) ══════════════   │ │
│  │  "The agent loop consists of three steps..."                      │ │
│  │                                              AI is presenting     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     VOICE ORCHESTRATOR                             │ │
│  │  - Owns all state transitions                                     │ │
│  │  - Manages Deepgram WebSocket (mic → STT)                        │ │
│  │  - Manages audio playback (Web Audio API)                         │ │
│  │  - Handles interrupts, zone clicks, auto-advance                  │ │
│  │  - Tracks spokenSoFar for interrupt context                       │ │
│  └──────────┬──────────────────────┬─────────────────────────────────┘ │
│             │                      │                                    │
│        WebSocket               fetch + AbortController                  │
│        (direct)                (to own API routes)                       │
│             │                      │                                    │
└─────────────┼──────────────────────┼────────────────────────────────────┘
              │                      │
              ▼                      ▼
         Deepgram Cloud         Next.js API Routes (/api/*)
         (STT - Nova 2)        ┌──────────────────────────────────────┐
              │                │                                      │
              │                │  /api/chat ──────────► GPT-4o-mini   │
              │                │  /api/narrate ───────► GPT-4o-mini   │
              │                │  /api/tts ───────────► ElevenLabs    │
              │                │                                      │
              │                │  Tool Registry                       │
              │                │  ├─ navigate_to_slide → {navigateTo} │
              │                │  └─ highlight_zone → {highlight}     │
              │                │                                      │
              │                └──────────────────────────────────────┘
              │                         │              │
              │                         ▼              ▼
              │                    GPT-4o-mini    ElevenLabs
              │                    (OpenAI)       Turbo v2
              │
              ▼
         Browser mic
         (getUserMedia)
```

---

## Component Deep-Dives

---

### Component 1: Slide Data Layer

The foundation. Every other component reads from this structure.

```ts
type Zone = {
  id: string;                   // "think", "observe", "api_tool"
  label: string;                // "Think" — displayed on hover tooltip
  description: string;          // "LLM reasons about what to do next" — sent to LLM
  svgElementId: string;         // links to the SVG element for highlighting
};

type Slide = {
  id: number;                   // 1-6
  title: string;                // "The Agent Loop"
  subtitle?: string;            // optional one-liner under title
  bullets: string[];            // key points shown on slide
  narrationHint: string;        // guidance for LLM on HOW to present this slide
  zones: Zone[];                // interactive elements
  layout: "split" | "circular" | "radial" | "stack" | "cards" | "timeline";
};
```

**The 6 slides:**

| # | Title | Layout | Diagram | Zones |
|---|-------|--------|---------|-------|
| 1 | What Are AI Agents? | split | Two boxes: LLM (brain) vs Agent (brain+hands), arrow between | llm_box, agent_box, difference_arrow |
| 2 | The Agent Loop | circular | Animated circular flow: Observe → Think → Act with feedback arrow | observe, think, act, feedback_arrow |
| 3 | Tool Calling | radial | Agent hub in center, tools radiating outward (API, Code, Search, DB) | agent_core, api_tool, code_tool, search_tool, db_tool |
| 4 | Memory & Context | stack | Two-layer: short-term conversation on top, long-term RAG/vector below | short_term, long_term, rag_arrow, vector_store |
| 5 | Real-World Agents | cards | Three styled cards: Coding Agent, Research Agent, Support Agent | coding_card, research_card, support_card |
| 6 | What's Next | timeline | Horizontal timeline: Single Agent → Multi-Agent → Autonomous, safety callout | single, multi, autonomous, safety_callout |

**narrationHint** is NOT the narration itself — it's guidance. Example for slide 2:
```
"Explain the agent loop as a simple but powerful concept. Use an analogy —
like a chef in a kitchen: observe (check the order), think (plan the dish),
act (cook it), then observe again (taste and adjust). Emphasize that this
simple loop creates emergent complex behavior."
```

The LLM generates the actual narration each time, so it's never robotic or repetitive.

---

### Component 2: Voice Orchestrator

The brain of the app. One module that owns all state and coordinates everything.

**States:**

```
idle        → App loaded, presentation not started
narrating   → AI is actively presenting a slide (TTS playing)
waiting     → Narration finished, waiting for user or auto-advance timer
listening   → User is speaking (Deepgram detected speech)
thinking    → User finished speaking, waiting for LLM response
responding  → AI is answering a user question (TTS playing)
paused      → User said "stop" / "pause"
```

**State Transition Table:**

```
┌─────────────┬──────────────────────┬─────────────────────────────────────┐
│ Current     │ Event                │ Transition + Action                  │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ idle        │ user clicks "Start"  │ → narrating                         │
│             │                      │   request mic, open Deepgram WS,    │
│             │                      │   call /api/narrate for slide 1,    │
│             │                      │   stream TTS                        │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ narrating   │ Deepgram interim     │ → listening                         │
│             │ transcript           │   audio.stop(), abort TTS fetch,    │
│             │                      │   save spokenSoFar,                 │
│             │                      │   wait for final transcript         │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ narrating   │ zone long-press      │ → thinking                          │
│             │                      │   audio.stop(), abort TTS fetch,    │
│             │                      │   save spokenSoFar,                 │
│             │                      │   send zone context to /api/chat    │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ narrating   │ TTS audio finishes   │ → waiting                           │
│             │                      │   start 5s auto-advance timer       │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ narrating   │ user clicks next/prev│ → narrating (new slide)             │
│             │                      │   audio.stop(), transition slide,   │
│             │                      │   call /api/narrate for new slide   │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ waiting     │ Deepgram transcript  │ → listening                         │
│             │                      │   cancel auto-advance timer,        │
│             │                      │   wait for final transcript         │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ waiting     │ zone long-press      │ → thinking                          │
│             │                      │   cancel timer,                     │
│             │                      │   send zone context to /api/chat    │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ waiting     │ auto-advance fires   │ → narrating (next slide)            │
│             │ (5s timer)           │   transition to next slide,         │
│             │                      │   call /api/narrate                 │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ waiting     │ user clicks next/prev│ → narrating (new slide)             │
│             │                      │   cancel timer, transition slide,   │
│             │                      │   call /api/narrate                 │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ listening   │ Deepgram final       │ → thinking                          │
│             │ transcript           │   send transcript to /api/chat      │
│             │                      │   with spokenSoFar + history        │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ thinking    │ LLM response         │ → responding                        │
│             │ received             │   execute tool calls (navigate,     │
│             │                      │   highlight), stream TTS            │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ responding  │ Deepgram interim     │ → listening                         │
│             │ transcript           │   audio.stop(), abort TTS,          │
│             │                      │   save spokenSoFar (of response),   │
│             │                      │   wait for final transcript         │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ responding  │ TTS audio finishes   │ → waiting                           │
│             │                      │   start 5s timer (but for           │
│             │                      │   "continue?" not auto-advance)     │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ paused      │ Deepgram transcript  │ → listening                         │
│             │                      │   wait for final transcript         │
├─────────────┼──────────────────────┼─────────────────────────────────────┤
│ paused      │ user clicks next/prev│ → narrating (new slide)             │
│             │                      │   transition, call /api/narrate     │
└─────────────┴──────────────────────┴─────────────────────────────────────┘
```

**Key state variables managed by the orchestrator:**

```ts
{
  state: OrchestratorState;       // "idle" | "narrating" | "waiting" | ...
  currentSlide: number;           // 1-6
  spokenSoFar: string[];          // sentences spoken in current narration/response
  conversationHistory: HistoryEntry[];  // full session history
  highlightedZone: string | null; // currently highlighted zone id
  autoAdvanceTimer: Timer | null; // 5s timer reference
  abortController: AbortController | null;  // for cancelling in-flight fetches
  deepgramConnection: LiveClient | null;    // Deepgram WebSocket
  audioContext: AudioContext | null;        // Web Audio API context
}
```

The orchestrator is NOT a React component. It's a plain TypeScript class/module that the React hook (`useVoiceSession`) wraps. This keeps the logic testable and separate from rendering.

---

### Component 3: Slide Stage (Frontend)

**What it does**: Renders the current slide with SVG diagrams, animations, and interactive zones.

**Structure:**
```
SlideStage
├── SlideTransition (Framer Motion AnimatePresence)
│   └── SlideRenderer (switches on slide.layout)
│       ├── SplitLayout      (slide 1)
│       ├── CircularLayout    (slide 2)
│       ├── RadialLayout      (slide 3)
│       ├── StackLayout       (slide 4)
│       ├── CardsLayout       (slide 5)
│       └── TimelineLayout    (slide 6)
├── ZoneOverlay
│   └── per-zone: long-press handler + hover tooltip + highlight animation
└── SlideIndicators (dots + prev/next arrows)
```

**Slide transitions**: Framer Motion `AnimatePresence` with a horizontal slide effect. Exiting slide slides out left, entering slide slides in from right (or reverse for prev).

**SVG diagrams**: Each layout component is a React component rendering inline SVG. Simple geometric shapes — circles, rectangles, rounded rects, lines, arrows. No complex illustrations. The "keynote" quality comes from:
- Source Serif 4 for slide titles
- Inter for body text and labels
- Generous whitespace and padding
- Subtle entry animations (elements fade in sequentially with stagger)
- Muted color palette with one accent color (indigo)

**Zone interaction (long-press)**:
```ts
function useZoneLongPress(onTrigger: () => void, duration = 500) {
  const timerRef = useRef<Timer>();
  const [pressing, setPressing] = useState(false);

  const onPointerDown = () => {
    setPressing(true);
    timerRef.current = setTimeout(() => {
      onTrigger();
      setPressing(false);
    }, duration);
  };

  const onPointerUp = () => {
    clearTimeout(timerRef.current);
    setPressing(false);
  };

  return { onPointerDown, onPointerUp, pressing };
}
```

- User touches/clicks and holds for 500ms → triggers zone explanation
- While pressing, zone shows a subtle fill animation (progress indicator)
- If released before 500ms → nothing happens (prevents accidental triggers)
- On trigger: orchestrator receives zone context, sends to /api/chat

**Highlight animation (red laser)**:
- SVG `<rect>` or `<circle>` gets an overlay `<path>` that traces its perimeter
- CSS animation using `stroke-dasharray` + `stroke-dashoffset` — the line "draws" around the shape
- Color: #EF4444 (red) with slight glow (filter: drop-shadow)
- Stays active while AI is talking about that zone
- Fades out over 800ms when AI finishes
- Only one zone highlighted at a time

---

### Component 4: Voice Bar (Frontend)

**What it does**: Docked at the bottom of the screen. Shows voice state, waveform, and live transcript.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  ◉ Mic button    ═══════ waveform ═══════    Status label   │
│                                                              │
│  "The agent loop consists of three steps..."    transcript   │
└──────────────────────────────────────────────────────────────┘
```

**Mic button states:**
- Idle (not started): outlined circle, muted color
- Listening (mic active, AI not speaking): green pulsing dot
- AI speaking: indigo animated dot
- Thinking: subtle loading animation

**Waveform visualizer:**
- Connected to AudioContext's AnalyserNode
- `getByteTimeDomainData()` → draw on a `<canvas>` element
- When AI is speaking: shows the AI audio waveform
- When user is speaking: shows mic input waveform
- When idle: flat line with subtle ambient animation

**Live transcript:**
- As AI speaks, the current sentence appears and updates
- As user speaks, interim Deepgram transcript appears (slightly muted, updating in real-time)
- When finalized, text becomes solid

**Status labels:**
```
"Click Start to begin"         → idle
"AI is presenting..."          → narrating
"Ask a question or continue"   → waiting
"Listening..."                 → listening
"Thinking..."                  → thinking
"Answering your question..."   → responding
"Paused"                       → paused
```

---

### Component 5: Deepgram STT Integration

**What it does**: Captures mic audio and streams it to Deepgram for real-time transcription.

**Lifecycle:**
```
User clicks "Start"
  → navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
  → Create Deepgram live connection:
      model: "nova-2"
      language: "en"
      smart_format: true
      endpointing: 500          // 500ms silence = end of utterance
      interim_results: true      // partial transcripts for fast interrupt
      utterance_end_ms: 1500     // final utterance boundary
  → Connect MediaStream to Deepgram via their SDK
  → Listen for events
```

**Events and how they're used:**

```
Event: "transcript" (interim, is_final=false)
  → Display in voice bar as muted updating text
  → If orchestrator state is "narrating" or "responding":
      INTERRUPT — stop audio immediately, transition to "listening"
  → Do NOT send to LLM yet (wait for final)

Event: "transcript" (final, is_final=true)
  → This is the accurate transcript
  → Send to orchestrator → orchestrator sends to /api/chat
  → Transition to "thinking"

Event: "utterance_end"
  → User stopped speaking (confirmed by Deepgram)
  → If we have a final transcript queued, process it now
  → Safety net for the "final transcript" event

Event: "close" / "error"
  → Auto-reconnect once after 2s delay
  → If reconnect fails: show "Voice connection lost" in voice bar
  → Slides still work manually via click navigation
```

**API key handling:**
- Server generates a short-lived Deepgram API key via `/api/deepgram-token`
- Browser uses this temporary key to open the WebSocket
- Key expires after the session
- No long-lived API key in the browser

---

### Component 6: API Routes (Backend)

Three core routes, one utility route. All in Next.js API routes.

---

#### `/api/deepgram-token` — GET

Generates a short-lived Deepgram API key for the browser.

```
Request: GET /api/deepgram-token
Response: { "token": "..." }
```

Uses Deepgram's API key management to create a scoped, expiring key.

---

#### `/api/chat` — POST

The main brain. Receives user input, calls GPT-4o-mini, returns response + tool calls.

```
Request:
{
  transcript: string,              // what user said OR "zone_click"
  currentSlide: number,
  conversationHistory: HistoryEntry[],
  interruptContext?: {
    wasNarrating: boolean,
    spokenSoFar: string[],         // sentences spoken before interrupt
    slideBeingNarrated: number
  },
  zoneContext?: {                  // if triggered by zone long-press
    zoneId: string,
    zoneLabel: string,
    zoneDescription: string
  }
}

Response:
{
  text: string,                    // what the AI says (for TTS)
  toolCalls: ToolCall[],           // navigate_to_slide, highlight_zone
}
```

**System prompt structure:**

```
You are an AI presenter — a brilliant, engaging teacher giving a talk
on AI Agents. You're not a chatbot. You're a speaker on stage.

SLIDES:
[Full content of all 6 slides with zones]

CURRENT STATE:
- Currently on slide {n}
- Narration spoken so far: "{spokenSoFar}"
- {interrupt context if applicable}

TOOLS:
- navigate_to_slide(slide_number): Navigate to a specific slide.
  Use when the user asks about a topic on a different slide, or
  when conversationally appropriate ("let me show you...").
- highlight_zone(zone_id): Highlight a specific element on the
  current slide. Use when explaining a particular component of
  a diagram.

BEHAVIOR:
- If user says "stop/pause": acknowledge and wait
- If user says "continue/go on": resume narration from where
  you left off, bridging naturally ("So as I was saying...")
- If user asks about a different topic: navigate to the relevant
  slide before answering
- If user clicked a zone: explain that specific element in depth
- Cross-reference slides when relevant ("Remember on slide 2...")
- After answering a question: offer to continue the presentation
- Adapt depth based on follow-up questions
```

**Tool registry pattern:**

```ts
const toolRegistry: Record<string, (args: any) => ToolResult> = {
  navigate_to_slide: (args) => ({
    type: "navigation",
    navigateTo: args.slide_number,
  }),
  highlight_zone: (args) => ({
    type: "highlight",
    zoneId: args.zone_id,
  }),
};

// After LLM response:
const toolCalls = response.choices[0].message.tool_calls || [];
const results = toolCalls.map(tc => ({
  name: tc.function.name,
  result: toolRegistry[tc.function.name](JSON.parse(tc.function.arguments)),
}));
```

**Response flow:**
1. Wait for full GPT-4o-mini response (~300-500ms for mini)
2. Extract tool calls → execute via registry
3. If `navigate_to_slide` was called → include in response so frontend transitions first
4. Return `{ text, toolCalls }` to browser
5. Browser executes tool actions (slide change, highlight), then sends text to `/api/tts`

We wait for full response (not streaming from LLM) because:
- GPT-4o-mini is fast enough (~500ms) that streaming saves marginal time
- Tool calls come at the end of the stream — we need them before starting TTS
- Simpler implementation, fewer edge cases

---

#### `/api/narrate` — POST

Generates narration text for a slide. Separate from `/api/chat` because narration has a different prompt and no tool calling needed.

```
Request:
{
  slideNumber: number,
  previousContext?: {
    slidesPresented: number[],    // which slides have been covered
    lastInteraction?: string,     // "user asked about X on slide 2"
  }
}

Response:
{
  narrationText: string           // the full narration to be spoken
}
```

**System prompt:**

```
You are narrating slide {n} of a presentation on AI Agents.

SLIDE CONTENT:
{slide title, bullets, zones}

NARRATION HINT:
{slide.narrationHint}

CONTEXT:
- Slides already presented: {list}
- Last interaction: {if any}

INSTRUCTIONS:
- Speak naturally, like a great teacher at a conference
- Don't just read the bullets — add examples, analogies, context
- If this isn't the first slide, transition from the previous topic
- If the user just asked a question, reference it in the transition
- Keep it to 4-8 sentences. Enough to cover the slide, short enough
  to not bore the listener.
- End with something that invites curiosity about what's next
  (except on the last slide, where you wrap up)
```

Returns the full narration text. Browser then sends this to `/api/tts`.

---

#### `/api/tts` — POST

Converts text to speech audio via ElevenLabs.

```
Request:
{
  text: string,
  voice?: string                  // ElevenLabs voice ID (default: a preset)
}

Response:
  Content-Type: audio/mpeg
  Transfer-Encoding: chunked
  → streams audio bytes
```

**Implementation:**
- Splits text into sentences (on `. `, `! `, `? `, `\n`)
- Calls ElevenLabs for each sentence using their streaming endpoint
- Streams audio chunks back to browser as they arrive
- Also sends sentence text interleaved with audio (for spokenSoFar tracking)

**Response format (SSE-style interleaving):**

```
--boundary
Content-Type: application/json
{"type": "sentence", "text": "The agent loop is a simple but powerful concept."}

--boundary
Content-Type: audio/mpeg
<audio bytes for sentence 1>

--boundary
Content-Type: application/json
{"type": "sentence", "text": "First, the agent observes its environment."}

--boundary
Content-Type: audio/mpeg
<audio bytes for sentence 2>

--boundary
Content-Type: application/json
{"type": "done"}
```

Browser reads this multipart stream:
- On `sentence` → append to `spokenSoFar`, display in voice bar
- On `audio` → decode and enqueue in AudioContext
- On `done` → signal orchestrator that TTS is complete

**Backpressure**: ElevenLabs processes one sentence at a time. While sentence 1 audio is being sent to browser, sentence 2 is being generated. Natural 1-sentence buffer. No explicit backpressure needed.

**Cancellation**: If browser aborts the fetch (user interrupted), the server catches the closed connection and stops making ElevenLabs calls for remaining sentences.

**Fallback**: If ElevenLabs returns an error or rate limits:
- Server catches the error
- Returns a special response: `{"type": "fallback", "text": "full remaining text"}`
- Browser falls back to `window.speechSynthesis.speak()` for that text
- Lower quality but the demo doesn't die

---

### Component 7: Audio Playback Manager

**What it does**: Manages the Web Audio API pipeline — decoding, queuing, playing, and visualizing audio.

```ts
class AudioPlaybackManager {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;          // for waveform visualization
  private audioQueue: AudioBuffer[];
  private currentSource: AudioBufferSourceNode | null;
  private isPlaying: boolean;

  constructor() {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.connect(this.audioContext.destination);
    this.audioQueue = [];
    this.currentSource = null;
    this.isPlaying = false;
  }

  // Decode and enqueue an audio chunk from ElevenLabs
  async enqueue(audioData: ArrayBuffer): Promise<void> {
    const buffer = await this.audioContext.decodeAudioData(audioData);
    this.audioQueue.push(buffer);
    if (!this.isPlaying) this.playNext();
  }

  // Play the next buffer in the queue
  private playNext(): void {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      this.onPlaybackComplete?.();       // callback to orchestrator
      return;
    }
    this.isPlaying = true;
    const buffer = this.audioQueue.shift()!;
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(this.analyser); // → analyser → destination
    this.currentSource.onended = () => this.playNext();
    this.currentSource.start();
  }

  // Stop immediately — for interrupts
  stop(): void {
    this.currentSource?.stop();
    this.currentSource = null;
    this.audioQueue = [];
    this.isPlaying = false;
  }

  // Get waveform data for visualization
  getWaveformData(): Uint8Array {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  // Callbacks
  onPlaybackComplete?: () => void;
}
```

**Gapless playback**: Achieved by the queue pattern — `onended` immediately calls `playNext()`. As long as the next buffer is already decoded and queued (which it should be since ElevenLabs is ~1 sentence ahead), there's no gap.

**Waveform visualization**: The `AnalyserNode` sits between source and destination. The voice bar component calls `getWaveformData()` on a `requestAnimationFrame` loop and draws to a `<canvas>`.

---

### Component 8: Conversation History

**What it does**: Maintains the full conversation context so the LLM can reference previous interactions.

```ts
type HistoryEntry = {
  role: "assistant" | "user";
  content: string;
  metadata: {
    type: "narration" | "answer" | "question" | "zone_query" | "control";
    slide: number;
    interrupted?: boolean;
    spokenUpTo?: string;       // last sentence spoken before interrupt
    timestamp: number;
  };
};
```

**What gets recorded:**

| Event | Role | Type | Content |
|-------|------|------|---------|
| AI narrates slide 2 | assistant | narration | Full narration text (or spokenUpTo if interrupted) |
| User asks question | user | question | Final Deepgram transcript |
| AI answers | assistant | answer | Full response text |
| User clicks zone | user | zone_query | "Clicked on {label}: {description}" |
| User says "stop" | user | control | "stop" / "pause" |
| User says "continue" | user | control | "continue" |

**Sent to LLM on every call.** No trimming, no summarization. A full demo session is 15-20 entries, ~3000 tokens. GPT-4o-mini has 128k context. Not a concern.

History lives in React state (via the orchestrator). Not persisted to a database — it's a demo, sessions are ephemeral.

---

### Component 9: The "Continue" Flow

The most nuanced interaction. How the LLM resumes narration after an interruption.

**What the LLM receives when user says "continue":**

```
Conversation history showing:
1. Narration of slide 2 (interrupted, spokenUpTo: "Then it enters the Think step, where the LLM reasons about—")
2. User question: "What do you mean by reasoning? Is it just a prompt?"
3. AI answer: "Great question. When I say reasoning, I mean..."
4. User: "ok continue"

System prompt addition:
"The user wants you to continue narrating slide 2.
You had said: 'The agent loop is a simple but powerful concept.
First, the agent observes its environment through tools and APIs.
Then it enters the Think step, where the LLM reasons about—'

Continue from where you left off. Bridge back naturally — briefly
echo your last point ('So as I was saying about the Think step...').
Don't repeat what you already covered. If the user's question
relates to what's coming next, weave it in."
```

**What the LLM produces:**

"So as I was saying — the Think step is where the LLM reasons about what to do next. And to your point about prompting — yes, at its core it is a structured prompt, but one that includes all the observations and available tools. Now the third step, Act, is where it gets really interesting..."

The LLM handles the bridging naturally. The key data that makes it work:
- `spokenUpTo` — exact sentences spoken before interrupt
- The Q&A exchange in history — so the LLM can reference the user's question
- The narrationHint — so the LLM knows what it was supposed to cover

No special code needed. Just the right prompt with the right context.

---

## File Structure

```
synth/
├── package.json
├── next.config.js
├── .env.local                    # API keys (not committed)
├── .env.example                  # template
│
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout, font loading (Source Serif 4 + Inter)
│   │   ├── page.tsx              # Main page — assembles SlideStage + VoiceBar
│   │   ├── globals.css           # Design tokens, base styles
│   │   └── api/
│   │       ├── chat/route.ts     # LLM chat with tool calling
│   │       ├── narrate/route.ts  # Slide narration generation
│   │       ├── tts/route.ts      # ElevenLabs TTS streaming
│   │       └── deepgram-token/route.ts  # Temporary Deepgram key
│   │
│   ├── components/
│   │   ├── SlideStage.tsx        # Slide container with transitions
│   │   ├── slides/
│   │   │   ├── SplitLayout.tsx   # Slide 1 diagram
│   │   │   ├── CircularLayout.tsx # Slide 2 diagram
│   │   │   ├── RadialLayout.tsx  # Slide 3 diagram
│   │   │   ├── StackLayout.tsx   # Slide 4 diagram
│   │   │   ├── CardsLayout.tsx   # Slide 5 diagram
│   │   │   └── TimelineLayout.tsx # Slide 6 diagram
│   │   ├── ZoneOverlay.tsx       # Long-press handler + highlight animation
│   │   ├── VoiceBar.tsx          # Bottom bar: mic, waveform, transcript
│   │   ├── Waveform.tsx          # Canvas-based waveform visualizer
│   │   ├── StartScreen.tsx       # Initial "Start Presentation" overlay
│   │   └── SlideIndicators.tsx   # Dot indicators + prev/next arrows
│   │
│   ├── lib/
│   │   ├── slides.ts             # Slide data (all 6 slides, zones, hints)
│   │   ├── orchestrator.ts       # VoiceOrchestrator class
│   │   ├── audio-manager.ts      # AudioPlaybackManager class
│   │   ├── deepgram.ts           # Deepgram client setup
│   │   ├── tool-registry.ts      # Tool name → handler map
│   │   ├── prompts.ts            # System prompt templates
│   │   └── types.ts              # Shared TypeScript types
│   │
│   └── hooks/
│       ├── useVoiceSession.ts    # React hook wrapping the orchestrator
│       └── useZoneLongPress.ts   # Long-press detection hook
│
├── public/
│   └── fonts/                    # Source Serif 4 + Inter (if self-hosting)
│
├── ARCHITECTURE.md               # This file
├── DISCUSSION.md                 # Decision log
└── README.md                     # For the evaluator
```

---

## Design System

```
COLORS
──────
Background:      #0A0A0B     (near-black)
Surface:         #141416     (slide stage, voice bar background)
Surface hover:   #1A1A1E     (subtle hover states)
Border:          #1F1F23     (dividers, slide stage border)
Text primary:    #EDEDEF     (off-white, headings, body)
Text secondary:  #71717A     (muted labels, status text)
Accent:          #6366F1     (indigo — active states, waveform, AI speaking indicator)
Accent muted:    #4F46E5     (darker indigo for hover)
Highlight:       #EF4444     (red — laser zone highlight)
Listening:       #22C55E     (green — mic active, user speaking)
Error:           #EF4444     (shared with highlight, contextual)

TYPOGRAPHY
──────────
Slide titles:    Source Serif 4, 600 weight, 2.5rem
Slide subtitle:  Source Serif 4, 400 weight, 1.25rem, text-secondary
Slide bullets:   Inter, 400 weight, 1.1rem
Zone labels:     Inter, 500 weight, 0.875rem
Voice bar text:  Inter, 400 weight, 0.95rem
Status labels:   Inter, 500 weight, 0.8rem, uppercase, letter-spacing 0.05em
UI elements:     Inter, 400-500 weight

SPACING
───────
Page padding:    48px horizontal, 32px vertical
Slide stage:     max-width 900px, centered, 64px padding
Voice bar:       full width, 80px height, 24px padding
Between slide stage and voice bar: 32px gap

EFFECTS
───────
Slide stage:     1px border (border color), subtle box-shadow
Slide transitions: Framer Motion, 400ms ease-out, horizontal slide
Element entry:   Framer Motion, staggered fade-in, 200ms per element
Zone hover:      scale 1.05, drop-shadow with accent color at 30% opacity
Zone long-press: fill animation (progress indicator during 500ms hold)
Zone highlight:  red stroke-dasharray animation tracing perimeter, 800ms fade-out
Waveform:        real-time canvas, 2px line, accent color
```

---

## Interaction Flows (Complete)

### Flow 1: App Load → Start
```
1. Page loads → StartScreen overlay visible
   - Slide 1 visible but blurred/dimmed behind overlay
   - "Start Presentation" button centered
   - Subtitle: "An AI-powered talk on AI Agents"

2. User clicks "Start"
   → Request mic permission (getUserMedia)
   → If denied: show mic-required message, allow retry
   → If granted:
     → Initialize AudioContext (requires user gesture)
     → Open Deepgram WebSocket (via /api/deepgram-token)
     → Fade out StartScreen overlay
     → Un-blur slide 1, animate elements in
     → Orchestrator state: idle → narrating
     → Call /api/narrate(slide=1)
     → Stream response to /api/tts
     → Play audio, show waveform, display transcript
```

### Flow 2: Natural Presentation (No Interaction)
```
1. Slide 1 narrating → TTS finishes
   → Orchestrator: narrating → waiting
   → Start 5s auto-advance timer
   → Voice bar: "Ask a question or click next"

2. 5 seconds pass, no user input
   → Timer fires
   → Orchestrator: waiting → narrating
   → Slide transition animation (slide 1 exits left, slide 2 enters right)
   → Call /api/narrate(slide=2, context: {slidesPresented: [1]})
   → Stream TTS, play audio

3. Repeat through all 6 slides
   → On slide 6 narration complete: no auto-advance
   → Voice bar: "That's the presentation. Any questions?"
   → Orchestrator: waiting (indefinitely, no timer)
```

### Flow 3: User Interrupts with Question
```
1. AI narrating slide 2, sentence 3 of 7:
   "First, the agent observes its environment through tools and APIs.
    Then it enters the Think step, where the LLM reasons about—"

2. User starts speaking: "what do you mean by reasoning?"
   → Deepgram fires INTERIM transcript
   → Orchestrator: narrating → listening
   → AudioPlaybackManager.stop() — instant silence
   → AbortController.abort() — cancel in-flight /api/tts
   → Save spokenSoFar: ["First, the agent observes...", "Then it enters the Think step, where the LLM reasons about—"]
   → Voice bar shows interim transcript (muted, updating)

3. User finishes speaking (Deepgram endpointing: 500ms silence)
   → Deepgram fires FINAL transcript: "What do you mean by reasoning?"
   → Orchestrator: listening → thinking
   → Voice bar: "Thinking..."
   → POST /api/chat:
     {
       transcript: "What do you mean by reasoning?",
       currentSlide: 2,
       conversationHistory: [...],
       interruptContext: {
         wasNarrating: true,
         spokenSoFar: ["First, the agent observes...", "Then it enters..."],
         slideBeingNarrated: 2
       }
     }

4. GPT-4o-mini responds (~500ms):
   {
     text: "Great question. When I say reasoning, I don't mean the LLM truly 'thinks' — it's more like structured pattern matching. The model receives all the observations and available tools as context, and generates the most likely next action. Want me to continue with the presentation?",
     toolCalls: [{ name: "highlight_zone", args: { zone_id: "think" } }]
   }

5. Execute tool calls:
   → highlight_zone("think") → frontend animates red laser around Think node
   → Orchestrator: thinking → responding

6. Stream response text to /api/tts → play audio
   → Voice bar shows transcript updating sentence by sentence

7. TTS finishes
   → Highlight fades out (800ms)
   → Orchestrator: responding → waiting
   → Start 5s timer
   → Add to history: user question + AI answer
```

### Flow 4: User Says "Continue"
```
1. In "waiting" state after answering a question (Flow 3)
   → User: "yes continue" or "go on"
   → Deepgram transcript → orchestrator: waiting → listening → thinking

2. POST /api/chat:
   {
     transcript: "yes continue",
     currentSlide: 2,
     conversationHistory: [
       { role: "assistant", type: "narration", interrupted: true,
         spokenUpTo: "Then it enters the Think step, where the LLM reasons about—" },
       { role: "user", type: "question", content: "What do you mean by reasoning?" },
       { role: "assistant", type: "answer", content: "Great question..." }
     ]
   }

3. GPT-4o-mini generates continuation:
   "So as I was saying — the Think step is where the model reasons about
    its next move. And to your point about it being pattern matching — yes,
    but it's remarkably effective. Now the third step, Act, is where things
    get interesting. This is where the agent actually does something..."

4. Orchestrator: thinking → narrating (not responding — it's continuing narration)
   → Stream to TTS → play
   → Update spokenSoFar with new sentences
```

### Flow 5: Zone Long-Press
```
1. User sees the "Think" circle on slide 2
   → Presses and holds on it
   → After 200ms: zone shows subtle fill progress animation
   → After 500ms: long-press confirmed

2. If AI was narrating:
   → AudioPlaybackManager.stop()
   → Save spokenSoFar

3. Orchestrator → thinking
   → POST /api/chat:
     {
       transcript: "zone_click",
       currentSlide: 2,
       zoneContext: {
         zoneId: "think",
         zoneLabel: "Think",
         zoneDescription: "LLM reasons about what to do next given observations and available tools"
       },
       conversationHistory: [...]
     }

4. GPT-4o-mini responds with detailed zone explanation
   → highlight_zone("think") tool call → red laser animation
   → TTS plays explanation
   → After: waiting state
```

### Flow 6: Conversational Navigation
```
1. On slide 2, user asks: "Can you show me the tool calling slide?"
   → /api/chat processes this
   → GPT-4o-mini calls navigate_to_slide(3)
   → Response: {
       text: "Sure, let me take you to tool calling.",
       toolCalls: [{ name: "navigate_to_slide", args: { slide_number: 3 } }]
     }

2. Frontend receives response:
   → Execute navigation FIRST: slide transition to slide 3
   → THEN play TTS: "Sure, let me take you to tool calling."
   → After TTS finishes: auto-trigger /api/narrate for slide 3
   → Narrate slide 3 with context: came from a question about tools
```

### Flow 7: User Says "Stop"
```
1. AI narrating, user says "stop" or "can you pause?"
   → Interim transcript → interrupt → stop audio
   → Final transcript → /api/chat
   → GPT-4o-mini recognizes control intent (not a question)
   → Response: "Sure, I'll pause here. Take your time — just let me
     know when you want to continue, or ask me anything."
   → Orchestrator: → paused (no auto-advance timer)
   → Voice bar: "Paused — listening..."
   → App sits idle until user speaks or clicks
```

---

## Error Handling Strategy

```
┌─────────────────────┬─────────────────────────────────────────────────┐
│ Failure             │ Response                                        │
├─────────────────────┼─────────────────────────────────────────────────┤
│ Mic denied          │ Modal with retry button. Slides work manually. │
│                     │ "Microphone access is needed for voice mode."  │
├─────────────────────┼─────────────────────────────────────────────────┤
│ Deepgram WS drops   │ Auto-reconnect once (2s delay).                │
│                     │ Voice bar: "Reconnecting..."                   │
│                     │ If fails: "Voice disconnected — click to retry"│
│                     │ Manual slide navigation still works.           │
├─────────────────────┼─────────────────────────────────────────────────┤
│ GPT-4o-mini fails   │ Retry once automatically.                      │
│                     │ If still fails: voice bar shows error toast,   │
│                     │ "I had trouble with that — try asking again."  │
│                     │ (spoken via fallback TTS if available)          │
├─────────────────────┼─────────────────────────────────────────────────┤
│ ElevenLabs fails    │ Silently fall back to browser SpeechSynthesis. │
│ (rate limit/error)  │ Voice bar shows subtle indicator (fallback).   │
│                     │ Demo continues with lower quality voice.       │
├─────────────────────┼─────────────────────────────────────────────────┤
│ Network mid-stream  │ Audio stops. State preserved.                  │
│                     │ Voice bar: "Connection interrupted."           │
│                     │ User can click mic to restart.                 │
└─────────────────────┴─────────────────────────────────────────────────┘
```

---

## Stretch Goals (Not in V1)

1. **Generate-Your-Own-Deck**: User enters topic → GPT generates SlideData[] → dynamic rendering
2. **Mobile responsive**: Stacked layout, larger touch targets
3. **Keyboard shortcuts**: arrow keys for nav, space for mic toggle
4. **Export transcript**: Download conversation as markdown
5. **Multi-voice**: Different ElevenLabs voices for different "moods"
6. **PDF/PPTX import**: Parse uploaded files into SlideData schema via vision model
