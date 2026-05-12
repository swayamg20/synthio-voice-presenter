# Synth — Discussion Log

## Decisions Made

### Stack
- **Frontend + Backend**: Next.js (single deploy, API routes as backend)
- **LLM**: Gemini Flash
- **STT**: Deepgram Nova (streaming WebSocket, browser-side SDK)
- **TTS**: ElevenLabs Turbo v2
- **Hosting**: Railway (single service)
- **Transport**: WebSocket (Deepgram's only), no WebRTC, no LiveKit

### Why WebSocket over WebRTC/LiveKit
- No peer-to-peer audio needed — it's user ↔ server
- WebRTC adds ICE/STUN/TURN complexity for no benefit
- LiveKit abstracts the voice pipeline — assignment wants to see YOUR thinking
- Latency bottleneck is LLM + TTS inference (~700ms), not transport (~50ms difference)
- "I chose WebSocket because the latency bottleneck is inference, not transport" = strong interview answer

### Why no Agent SDK / State Machine Framework
- Flow is not multi-step agentic (no tool chains, no loops)
- It's single LLM call → response + maybe one tool call
- Custom orchestrator (~100 lines) is cleaner than fighting a framework's abstractions
- Building it yourself IS the assignment

---

## Problems Discussed (Briefly)

### 1. Tool Execution — Dynamic, Not Hardcoded ✅ Discussed
- Tool registry pattern: map of tool name → handler function
- No if/else chains checking tool names
- Add new tools by adding one entry to the registry
- Not a database table (overkill), but not hardcoded branching

### 2. TTS Narration — Live, Not Pre-cached ✅ Discussed
- **Problem**: If TTS is pre-cached and user interrupts, LLM doesn't know what was spoken
- **Solution**: Fully live. Gemini generates narration → streams to ElevenLabs → streams to browser
- Track narration text on frontend as it plays (sentence by sentence)
- On interrupt: send `spokenSoFar` back to LLM so it knows context

### 3. Knowing What TTS Has Spoken ✅ Discussed
- Stream narration text from Gemini sentence-by-sentence
- As each sentence is sent to TTS, also send it to frontend
- Frontend appends to `spokenSoFar`
- On interrupt: "You had said these 4 sentences before the user interrupted"
- Not word-level precise, but sentence-level is good enough

### 4. State Management ✅ Discussed
- States: idle, narrating, waiting, listening, thinking, responding, paused
- Event-driven transitions (transcript received, zone clicked, TTS finished, timer fires)
- React state + switch statements, not XState or a framework
- Needs to be clean — one VoiceOrchestrator module, not scattered logic

### 5. Prompt Changes Based on State ✅ Discussed
- Different system prompts for: narrating, answering question, continuing after interrupt, auto-advancing
- Prompt includes `spokenSoFar` so LLM knows where it left off
- Prompt includes all 6 slides so LLM can navigate and cross-reference

### 6. Interruption Handling ✅ Discussed
- Deepgram transcript fires = user is speaking (Deepgram IS the VAD)
- Browser: audio.pause() instantly
- No Silero VAD, no Pipecat smart turn detection needed
- Endpointing param (500-700ms silence) = user is done speaking
- "Stop" / "pause" = control command, LLM understands intent
- "Continue" / "go on" = resume from where it stopped

### 7. Auto-Advance Between Slides ✅ Discussed
- Narration ends → wait 5 seconds for user input
- No input → auto-advance to next slide → start narrating
- Timer cancelled if user speaks or clicks

---

## Problems NOT Yet Discussed

### 8. Slide Visuals — How to Build Keynote-Level SVG Diagrams
- Chose "keynote-level with SVG diagrams" but haven't discussed HOW
- Hand-coded SVG? React SVG components? A design library?
- Animation approach — Framer Motion? CSS animations? GSAP?
- 6 different diagram types needed (split diagram, circular flow, radial, two-layer, cards, timeline)
- How much time to spend on visuals vs voice pipeline?

### 9. Clickable Zones — Implementation Details
- Positioned divs over SVG elements — but how precisely?
- Hover effect (glow/pulse) — CSS or animation library?
- How does zone click interact with ongoing narration exactly?
- Zone data structure finalization

### 10. highlight_zone Tool — Visual Feedback
- When AI calls highlight_zone, how does the frontend animate it?
- Duration of highlight? Fade out timing?
- What if AI highlights zone A then immediately highlights zone B?
- Can AI highlight multiple zones in one response?

### 11. Streaming Architecture — The Actual Pipe
- Gemini generates text → how does it stream sentence by sentence?
- Does /api/chat return the full response then /api/tts streams audio?
- Or is it one streaming endpoint that interleaves text + audio?
- Backpressure: what if Gemini generates faster than ElevenLabs can speak?
- AbortController for cancelling in-flight requests on interrupt

### 12. Deepgram Integration — Browser Side Details
- Which Deepgram SDK? @deepgram/sdk browser package?
- Audio format: what does the mic capture? PCM? Opus?
- Interim vs final transcripts — which triggers the interrupt?
- Echo cancellation: mic picks up AI audio from speakers?
- getUserMedia constraints needed

### 13. Audio Playback Management
- How to play streaming audio chunks from ElevenLabs?
- Web Audio API (AudioContext) vs <audio> element?
- Audio queue management — buffering chunks while playing
- Gapless playback between sentences?
- Volume control?

### 14. Conversation History Management
- How much history to send to Gemini on each call?
- Does history include narration text or just Q&A?
- Token limit considerations with all slides + history
- When to trim/summarize history?

### 15. Error Handling
- Deepgram WebSocket drops mid-presentation
- ElevenLabs API fails or rate limits
- Gemini call fails
- Mic permission denied
- Network issues mid-stream
- Graceful degradation strategy

### 16. The "Continue" Flow — Details
- User interrupts at sentence 4 of 10
- Says "continue"
- LLM needs to generate sentences 5-10 but naturally, not robotically
- Does it re-narrate slightly differently or try to match?
- What if user asked a question in between — does the continuation reference the Q&A?

### 17. UI Layout and Design
- Overall page layout — where does each component sit?
- Responsive? Mobile support? Or desktop-only for demo?
- Dark theme? Light theme? Murmur aesthetic or fresh?
- Typography choices
- The voice bar / waveform visualizer design

### 18. Generate-Your-Own-Deck (Stretch Goal)
- Input flow — just a text field with topic?
- How does Gemini generate zone data for diagrams it hasn't seen?
- Do generated slides get the same visual treatment?
- Or are generated slides simpler (bullets only, no SVG diagrams)?

### 19. Deployment
- Railway setup — any gotchas with WebSocket/streaming?
- Environment variables management
- Build optimization
- Demo URL for submission

### 20. README and Documentation
- What to highlight for the evaluator
- Architecture explanation
- "Why I chose X over Y" sections
- Future improvements section
- Demo video or GIF?
