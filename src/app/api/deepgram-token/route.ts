export const dynamic = "force-dynamic";

async function getProjectId(apiKey: string): Promise<string | null> {
  const response = await fetch("https://api.deepgram.com/v1/projects", {
    headers: { Authorization: `Token ${apiKey}` },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { projects?: { project_id: string }[] };
  return data.projects?.[0]?.project_id ?? null;
}

async function createTemporaryKey(apiKey: string, projectId: string): Promise<string | null> {
  const response = await fetch(
    `https://api.deepgram.com/v1/projects/${projectId}/keys`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "Synthio session key",
        scopes: ["usage:write"],
        time_to_live_in_seconds: 60,
      }),
    },
  );

  if (!response.ok) return null;

  const data = (await response.json()) as { key?: string };
  return data.key ?? null;
}

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "DEEPGRAM_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    const projectId = await getProjectId(apiKey);

    if (projectId) {
      const tempKey = await createTemporaryKey(apiKey, projectId);

      if (tempKey) {
        console.log("[Deepgram] Issued temporary key (60s TTL)");
        return Response.json(
          { token: tempKey },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    console.warn("[Deepgram] Could not create temporary key, falling back to main key");
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
