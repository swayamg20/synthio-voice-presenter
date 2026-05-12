export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5";

type TtsRequest = {
  text: string;
  voice?: string;
};

async function fetchElevenLabsAudio(
  sentence: string,
  voiceId: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const url = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId,
    )}/stream`,
  );
  url.searchParams.set("output_format", "mp3_44100_128");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
    },
    body: JSON.stringify({
      text: sentence,
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.78,
        style: 0,
        use_speaker_boost: true,
      },
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs TTS failed with status ${response.status}: ${errorText}`,
    );
  }

  return response.arrayBuffer();
}

export async function POST(request: Request) {
  let body: TtsRequest;

  try {
    body = (await request.json()) as TtsRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return Response.json({ error: "text is required." }, { status: 400 });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.log("[TTS] No ELEVENLABS_API_KEY, using browser fallback");
    return Response.json({
      type: "fallback",
      text: body.text,
    });
  }

  const voiceId = body.voice || DEFAULT_VOICE_ID;
  console.log(`[TTS] Processing single sentence: "${body.text.slice(0, 80)}"`);

  try {
    const audioBuffer = await fetchElevenLabsAudio(
      body.text,
      voiceId,
      request.signal,
    );

    console.log(`[TTS] Audio generated: ${audioBuffer.byteLength} bytes`);

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    console.error("[TTS] ElevenLabs TTS failed, using browser fallback.", error);
    return Response.json({
      type: "fallback",
      text: body.text,
    });
  }
}
