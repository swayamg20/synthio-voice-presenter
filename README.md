# Synthio

An AI voice presenter that narrates slide decks like a real teacher. Speaks proactively, answers questions mid-presentation, navigates slides conversationally, and adapts to how you learn.

## How It Works

```
Mic → Deepgram STT → GPT-5.4-mini (SSE + tool calling) → ElevenLabs TTS → Speaker
         ↑                    ↓                                  ↓
    Interim transcript   navigate_to_slide()              Per-sentence streaming:
    = instant interrupt  highlight_zone()                 TTS fires on first sentence
    detection            respond() (structured)           while LLM still generates
```

## Key Features

- **Streaming LLM → TTS pipeline** — LLM response streams via SSE, partial JSON parsing extracts `spoken_text` sentences as they arrive, TTS fires per-sentence. Perceived latency: ~500ms instead of 3-8s.
- **Structured output via tool calling** — every LLM response goes through a `respond()` tool with a strict JSON schema (`spoken_text`, `follow_ups[]`, `expertise_assessment`). No string parsing, deterministic output.
- **Dynamic tool registry** — tools are a `name → handler` map, not hardcoded if/else. Adding a tool = one registry entry + one OpenAI function definition.
- **Audience adaptation** — AI assesses expertise from your questions and adjusts depth. Basic questions → analogies and simple language. Technical questions → deeper explanations. Invisible to the user.
- **Smart follow-up chips** — after each response, 2-3 contextual follow-up questions appear as clickable pills. Turns a linear presentation into an explorable one.
- **Interruption with context** — `spokenSoFar` tracks every sentence played. On interrupt, the LLM receives exactly what was spoken so it can bridge back naturally: "So as I was saying..."
- **Interactive diagram zones** — long-press (500ms) any SVG element for a deep explanation. Prevents accidental triggers.
- **Auto-advance** — 5-second timer after narration ends, cancelled by any interaction.

## Architecture

### Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Deepgram   │     │  GPT-5.4-mini│     │  ElevenLabs  │     │  Web Audio   │
│   Nova 2     │────▶│  (streaming) │────▶│  Turbo v2.5  │────▶│  API         │
│              │     │              │     │              │     │              │
│  STT via     │     │  SSE events: │     │  Single      │     │  AudioContext │
│  WebSocket   │     │  sentence    │     │  sentence    │     │  + Analyser  │
│  from browser│     │  tool_call   │     │  → audio     │     │  + Queue     │
│              │     │  complete    │     │  bytes       │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Voice Orchestrator

A state machine that coordinates the entire voice session. ~200 lines, no framework.

```
idle → narrating → waiting → (auto-advance or user input)
                      ↓
                  listening → thinking → responding → waiting
                      ↑                     ↓
                  (interrupt)          (interrupt)
                      ↑                     ↓
                   paused ←────────────────┘
```

| State | Trigger | Action |
|---|---|---|
| `idle` → `narrating` | User clicks Start | Request mic, connect Deepgram, generate narration, stream TTS |
| `narrating` → `listening` | Deepgram interim transcript | Stop audio instantly, save spokenSoFar, wait for final transcript |
| `listening` → `thinking` | Deepgram final transcript | Send to /api/chat with history + interrupt context |
| `thinking` → `responding` | First SSE sentence arrives | Execute tool calls, start TTS per-sentence |
| `responding` → `waiting` | All audio finishes | Set follow-ups, start 5s auto-advance timer |
| `waiting` → `narrating` | Timer fires (5s, no input) | Advance slide, generate new narration |
| Any → `paused` | User says "stop" or clicks mute | Cancel everything, muted flag blocks transcripts |

### LLM Integration

Two API routes, both streaming SSE:

**`/api/chat`** — handles user questions, zone clicks, interruptions
- System prompt includes all 6 slides, current state, audience level
- Tools: `respond()`, `navigate_to_slide()`, `highlight_zone()`
- `tool_choice: "required"` — LLM must call at least one tool
- Partial JSON parsing extracts sentences from `spoken_text` during streaming

**`/api/narrate`** — generates proactive narration for a slide
- Simpler prompt: slide content + narration hint + presented slides
- Tools: `respond()` only
- `tool_choice: { function: "respond" }` — forced structured output

### Structured Output (respond tool)

```json
{
  "respond": {
    "spoken_text": "The agent loop is observe, think, act...",
    "follow_ups": ["How fast does this loop run?", "What if it fails?"],
    "expertise_assessment": "intermediate"
  }
}
```

`spoken_text` is the first property in the schema — critical for streaming. As the LLM generates the JSON, we extract complete sentences from the partial `spoken_text` value before `follow_ups` and `expertise_assessment` arrive.

### Audio Playback

`AudioPlaybackManager` wraps Web Audio API:
- `AudioContext` → `AnalyserNode` (waveform visualization) → speakers
- Buffer queue with gapless playback via `onended` chaining
- `stop()` clears queue instantly for interruptions
- `onBufferStart` callback syncs subtitle display with actual playback

### Speech-to-Text

Deepgram Nova 2 via browser WebSocket:
- `endpointing: 1500ms` — silence threshold for end-of-utterance
- `interim_results: true` — partial transcripts trigger instant interrupt detection
- Final transcripts sent to LLM for processing
- `echoCancellation`, `noiseSuppression`, `autoGainControl` via getUserMedia
- Auto-reconnect once on WebSocket drop

## Design Decisions

| Decision | Chosen | Why |
|---|---|---|
| Transport | WebSocket (Deepgram only) | No peer-to-peer needed. Latency bottleneck is LLM+TTS, not transport. |
| LLM streaming | SSE + partial JSON parsing | TTS fires on first sentence (~500ms) vs waiting for full response (~3-8s). |
| Output structure | Tool calling (respond tool) | Deterministic schema. Follow-ups and expertise are never missing. |
| State management | Custom orchestrator | ~200 lines, clear transitions, no framework abstractions to fight. |
| TTS approach | Live per-sentence, not pre-cached | Interrupted narration needs context-aware resume. |
| Interrupt detection | Deepgram interim transcripts | Deepgram IS the VAD. No Silero/Pipecat needed for this scope. |
| Slide format | React + SVG components | Interactive zones need DOM control. Imported PPTX/PDF gives flat images. |

## Scaling for Production

| Area | Current (Demo) | Production |
|---|---|---|
| LLM latency | GPT-5.4-mini via Chat Completions | Responses API with WebSocket mode (40% faster) |
| Transport | Browser WebSocket to Deepgram | LiveKit for managed WebRTC, built-in echo cancellation |
| Turn detection | Deepgram endpointing (1500ms silence) | Silero VAD + Pipecat smart turn model |
| TTS reliability | ElevenLabs with SpeechSynthesis fallback | Multi-provider TTS with automatic failover |
| Slide content | Hardcoded React components | PDF/PPTX import via vision model, or LLM-generated slides |
| Sessions | Ephemeral (in-memory) | Persistent with conversation history storage |
| Deployment | Single Next.js on Railway | Separate frontend/backend, CDN, auto-scaling |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # SSE streaming, tool calling, expertise
│   │   ├── narrate/route.ts       # SSE streaming narration
│   │   ├── tts/route.ts           # ElevenLabs per-sentence TTS
│   │   └── deepgram-token/route.ts
│   ├── layout.tsx
│   ├── page.tsx                   # 2-pane layout
│   └── globals.css
├── components/
│   ├── ActivityPanel.tsx          # Agent log + voice controls + expertise badge
│   ├── SlideStage.tsx             # Slide viewer with transitions
│   ├── SlideIndicators.tsx
│   ├── FeaturesModal.tsx          # Feature guide modal
│   └── slides/                    # 6 SVG diagram components
├── hooks/
│   └── useVoiceSession.ts         # React bridge to orchestrator
└── lib/
    ├── orchestrator.ts            # State machine + SSE consumer + TTS queue
    ├── audio-manager.ts           # Web Audio API with AnalyserNode
    ├── deepgram.ts                # Browser STT with auto-reconnect
    ├── tool-registry.ts           # Dynamic tool name → handler map
    ├── prompts.ts                 # System prompts with audience adaptation
    ├── slides.ts                  # 6 slides with zones + narration hints
    └── types.ts
```

## Getting Started

```bash
git clone https://github.com/swayamg20/synthio-voice-presenter.git
cd synthio-voice-presenter
npm install
cp .env.example .env.local
# Add: OPENAI_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY
npm run dev
```

Open http://localhost:3000. Click **Start Presentation**. Allow microphone access.

**Use headphones** for the best experience. The browser's echo cancellation can struggle to separate your voice from the AI's audio when using speakers. Production would use WebRTC for hardware-level echo cancellation.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind, Framer Motion |
| STT | Deepgram Nova 2 (streaming WebSocket) |
| LLM | GPT-5.4-mini (SSE streaming, tool calling) |
| TTS | ElevenLabs Turbo v2.5 (per-sentence) |
| Audio | Web Audio API (AudioContext, AnalyserNode) |
| Fonts | Source Serif 4 (headings), Inter (body) |
