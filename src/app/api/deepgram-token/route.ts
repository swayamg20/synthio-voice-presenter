export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.DEEPGRAM_API_KEY;

  if (!token) {
    return Response.json(
      { error: "DEEPGRAM_API_KEY is not configured." },
      { status: 500 },
    );
  }

  // Demo shortcut: production should mint short-lived scoped Deepgram keys instead.
  return Response.json(
    { token },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
