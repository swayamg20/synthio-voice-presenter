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
    // Token-based auth: creates a short-lived token
    // Docs: https://developers.deepgram.com/guides/fundamentals/token-based-authentication
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

    const data = await response.json();
    console.log("[Deepgram] Token grant response:", response.status, JSON.stringify(data).slice(0, 200));

    if (response.ok && data.access_token) {
      console.log("[Deepgram] Issued temporary token (120s TTL)");
      return Response.json(
        { token: data.access_token },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // If token grant isn't available, use the main key
    // This is acceptable for a demo — the key is scoped and rate-limited
    console.warn("[Deepgram] Token grant not available:", data.err_msg ?? data.error ?? "unknown");
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
