import OpenAI from "openai";

let openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (openai) {
    return openai;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  openai = new OpenAI({ apiKey });
  return openai;
}
