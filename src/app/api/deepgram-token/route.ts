export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "DEEPGRAM_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    // Token-based auth: creates an unlimited, short-lived token (no 250/day cap)
    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        time_to_live_in_seconds: 120,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { access_token?: string };

      if (data.access_token) {
        console.log("[Deepgram] Issued temporary token (120s TTL)");
        return Response.json(
          { token: data.access_token },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    console.warn("[Deepgram] Token grant failed, falling back to main key");
    return Response.json(
      { token: apiKey },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Deepgram] Token generation failed:", error);
    return Response.json(
      { token: apiKey },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
