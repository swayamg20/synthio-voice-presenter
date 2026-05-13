# Synthio

AI voice presenter that narrates slides, answers questions, and navigates the deck through conversation.

Built as a take-home to explore how voice-based AI interaction can make presentations feel like a dialogue, not a broadcast.

https://github.com/user-attachments/assets/e902b312-2bd6-42cc-91f6-8ff7a409acea

## Try It

```bash
git clone https://github.com/swayamg20/synthio-voice-presenter.git
cd synthio-voice-presenter
npm install
cp .env.example .env.local   # add OPENAI_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY
npm run dev
```

Open http://localhost:3000. Use headphones for best results. Click **Start Presentation**.

**Live demo:** [synthio-voice-presenter-production.up.railway.app](https://synthio-voice-presenter-production.up.railway.app)

## What You Can Do

- **Listen** to the AI narrate each slide like a conference speaker
- **Interrupt** by speaking anytime; the AI stops and responds to your question
- **Navigate by voice**: say "tell me about tool calling" and it jumps to the right slide
- **Press and hold** any diagram element for a focused explanation with visual highlighting
- **Click follow-up chips** that appear after each response
- **Say "continue"** after interrupting to resume from where it left off

The AI adapts its language to your expertise level automatically.

## How It Works

```
Mic → Deepgram Nova-3 → GPT-5.4-mini (streaming) → ElevenLabs → Speaker
           ↑                     ↓                        ↓
     Interim transcript    Tool calls:              TTS fires per-sentence
     = instant interrupt   navigate_to_slide()      while LLM still generates
                           highlight_zone()
                           respond() (structured)
```

The LLM streams its response as SSE. We extract sentences from the partial JSON as it generates and fire TTS immediately. The user hears the first sentence in ~500ms, not after the full 3-8s response.

Every response goes through a `respond()` tool with a strict schema: `spoken_text`, `follow_ups[]`, `expertise_assessment`. No string parsing, deterministic structure.

See [DESIGN_DOC.md](DESIGN_DOC.md) for architecture details, design decisions, and production roadmap.

## Tech Stack

| | |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind, Framer Motion |
| Backend | Next.js API Routes (SSE streaming, tool calling orchestration) |
| STT | Deepgram Nova-3 (streaming WebSocket) |
| LLM | GPT-5.4-mini (SSE streaming, tool calling) |
| TTS | ElevenLabs Turbo v2.5 |
| Audio | Web Audio API (AudioContext, AnalyserNode) |
| Deploy | Railway |
