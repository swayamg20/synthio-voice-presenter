# Synthio Design Document

## The Problem

Presentations are one-directional. The speaker talks, the audience listens. If someone has a question, they wait for the end or raise a hand awkwardly. AI can change this: what if the presenter could respond to questions in real-time, navigate to the relevant slide, and adapt to who's listening?

Synthio is a prototype exploring that interaction model.

## System Overview

Two panes. Left: agent activity log showing what the AI is doing step by step (thinking, narrating, navigating). Right: the slide with subtitles and navigation. Voice controls live in the left panel.

```
┌─────────────────────────────────────────────────────┐
│  Header: Synthio / AI Agents                   1/6  │
├──────────┬──────────────────────────────────────────┤
│ Activity │                                          │
│ Panel    │           Slide Viewer                   │
│          │           (SVG diagrams)                 │
│ Agent    │                                          │
│ state    │                                          │
│ log      │                                          │
│          │     ─── subtitle below ───               │
│ Voice    │         ● ● ◉ ● ● ●                     │
│ controls │     [follow-up chips]                    │
└──────────┴──────────────────────────────────────────┘
```

## Voice Pipeline

```
Mic → Deepgram Nova-3 (STT) → GPT-5.4-mini (LLM) → ElevenLabs (TTS) → Speaker
```

Each stage streams to the next. The critical optimization: **the LLM response streams via SSE, and we extract sentences from partial JSON as they arrive**. TTS fires on the first complete sentence while the LLM is still generating the rest. This cuts perceived latency from 3-8 seconds to ~500ms.

### Why streaming matters

Without streaming, the flow is: user speaks → wait 3s for LLM → wait 1s for TTS → user hears response (4s total). With streaming: user speaks → 500ms for first sentence → TTS fires → user hears response while the rest generates in the background.

### Structured output via tool calling

Every LLM response goes through a `respond()` tool:

```json
{
  "spoken_text": "The agent loop is a simple cycle...",
  "follow_ups": ["How fast does the loop run?", "What happens when it fails?"],
  "expertise_assessment": "intermediate"
}
```

Why a tool, not just text? Because `follow_ups` and `expertise_assessment` need to be reliably structured. Asking the LLM to append `FOLLOW_UPS: ...` as text is fragile; it forgets, formats inconsistently, or the text leaks into TTS. A tool with a JSON schema enforces structure deterministically.

`spoken_text` is deliberately the first property in the schema so that during streaming, the spoken content arrives before the metadata.

## Voice Orchestrator

A state machine with 7 states. No framework, ~200 lines.

```
idle → narrating → waiting → (auto-advance or user speaks)
                      ↓
                  listening → thinking → responding → waiting
```

**Interruption flow:** Deepgram sends interim transcripts as the user speaks. The moment one arrives while the AI is talking, the orchestrator stops audio playback instantly (`AudioBufferSourceNode.stop()`), aborts any in-flight TTS fetches, saves what was spoken so far, and waits for the final transcript to send to the LLM.

The LLM receives `spokenSoFar` as interrupt context, so it knows where the narration stopped and can bridge back naturally: "So as I was saying about the Think step..."

**Auto-advance:** After narration finishes, a 5-second timer starts. If the user doesn't speak or interact, the next slide loads automatically. Any interaction cancels the timer.

## Key Design Decisions

### Why WebSocket, not WebRTC

For the prototype, browser-to-Deepgram WebSocket was the simplest path. No ICE negotiation, no STUN/TURN servers, no media pipeline complexity. The latency bottleneck is LLM inference, not transport.

**The trade-off we accepted:** browser `getUserMedia` echo cancellation is weaker than WebRTC's hardware-level echo cancellation. This means interruption works best with headphones. Production would use WebRTC (via LiveKit) for proper echo handling.

### Why custom orchestrator, not an agent SDK

The voice loop is not multi-step agentic reasoning. It's: receive input → one LLM call → execute tool calls → play audio. A custom state machine keeps this explicit and debuggable. Agent SDKs (LangChain, Vercel AI SDK) add abstractions that obscure the state transitions we need fine control over.

### Why live TTS, not pre-cached

If narration is pre-cached and the user interrupts at sentence 4 of 10, the LLM doesn't know what was said. With live generation, we track every sentence and send `spokenSoFar` to the LLM on interrupt. The AI can reference what it already said and what it was about to say.

### Why React slides, not imported PPTX/PDF

Interactive zones (long-press to explain a diagram element) require DOM-level control. An imported PDF is a flat image with no click targets. React components with SVG elements give us per-element interactivity, highlight animations, and Framer Motion transitions.

## Production Roadmap

### Transport: WebRTC via LiveKit

The biggest architectural change. Move audio transport from browser WebSocket to LiveKit's WebRTC infrastructure. This gives us:
- Hardware echo cancellation (the current limitation with speaker-based use)
- Server-side audio processing pipeline
- Built-in room management for multi-user scenarios
- LiveKit's turn detection model (works well across languages including Hindi)

### Content: slide import and generation

Two paths to dynamic content:
- **Import:** PDF/PPTX upload → vision model extracts slide structure (titles, content, spatial layout) → renders as React components with auto-detected interactive zones
- **Generate:** user enters a topic → LLM generates a slide deck as structured JSON → same rendering pipeline

### Voice quality

- **LiveKit turn detector** for natural end-of-speech detection instead of silence-based endpointing. Handles pauses, filler words, and multi-lingual speech.
- **Multi-provider TTS** with automatic failover between ElevenLabs, Cartesia, and browser SpeechSynthesis

### Intelligence

- **Memory layer:** persistent user preferences and conversation history across sessions. The AI remembers what you asked last time and adapts.
- **Multi-language support:** the slide content, narration, and STT in the user's preferred language
- **Analytics:** which slides generated the most questions, where users interrupted, average session depth. Feeds back into slide content improvement.

### Infrastructure

- Separate frontend and backend deployments for independent scaling
- Session persistence with Redis or database storage
- CDN for static slide assets
- Rate limiting and API key rotation

## File Map

```
src/
├── app/
│   ├── api/chat/route.ts       # LLM streaming + tool calling
│   ├── api/narrate/route.ts    # Slide narration generation
│   ├── api/tts/route.ts        # Per-sentence TTS
│   └── page.tsx                # 2-pane layout
├── components/
│   ├── ActivityPanel.tsx       # Agent log + voice controls
│   ├── SlideStage.tsx          # Slide viewer + transitions
│   ├── FeaturesModal.tsx       # Feature guide (opens on load)
│   └── slides/                 # 6 SVG diagram components
├── hooks/
│   └── useVoiceSession.ts      # React bridge to orchestrator
└── lib/
    ├── orchestrator.ts         # Voice state machine
    ├── audio-manager.ts        # Web Audio API playback
    ├── deepgram.ts             # Browser STT
    ├── tool-registry.ts        # Tool definitions
    ├── prompts.ts              # LLM prompts with audience adaptation
    ├── slides.ts               # Slide content + zones
    └── sse.ts                  # Shared SSE utilities
```
