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
    // Create a short-lived temporary key via Deepgram's API
    const response = await fetch("https://api.deepgram.com/v1/keys", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "Synthio session key",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 300, // 5 minutes
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const tempKey = data.key ?? data.api_key;

      if (tempKey) {
        console.log("[Deepgram] Issued temporary key (5 min TTL)");
        return Response.json(
          { token: tempKey },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    // Fallback: Deepgram's key API may require project-level access.
    // Use the main key with a warning.
    console.warn("[Deepgram] Could not create temporary key, falling back to main key");
    return Response.json(
      { token: apiKey },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Deepgram] Token generation failed:", error);
    // Fallback to main key so the demo doesn't break
    return Response.json(
      { token: apiKey },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
