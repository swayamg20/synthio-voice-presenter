const textEncoder = new TextEncoder();

export function sseEvent(event: string, data: unknown): Uint8Array {
  return textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const SPOKEN_TEXT_PREFIXES = ['"spoken_text":"', '"spoken_text": "'];

export function findSpokenTextStart(partial: string): number {
  for (const prefix of SPOKEN_TEXT_PREFIXES) {
    const idx = partial.indexOf(prefix);
    if (idx !== -1) {
      return idx + prefix.length;
    }
  }
  return -1;
}

/**
 * Extract the current spoken_text value from partial JSON arguments.
 * The value starts after "spoken_text":"  and continues until an unescaped quote.
 * Since the JSON is partial (still streaming), we may not have the closing quote yet.
 */
export function extractSpokenTextSoFar(partial: string): string {
  const valueStart = findSpokenTextStart(partial);
  if (valueStart === -1) return "";

  // Scan for the end of the string value (unescaped quote)
  let end = -1;
  for (let i = valueStart; i < partial.length; i++) {
    if (partial[i] === '"' && partial[i - 1] !== '\\') {
      end = i;
      break;
    }
  }

  const raw = end === -1 ? partial.slice(valueStart) : partial.slice(valueStart, end);

  // Unescape JSON string escapes
  try {
    return JSON.parse(`"${raw.replace(/$/,'')}"`);
  } catch {
    // If JSON.parse fails (partial escape at end), trim the trailing incomplete escape
    const trimmed = raw.replace(/\\+$/, '');
    try {
      return JSON.parse(`"${trimmed}"`);
    } catch {
      return trimmed;
    }
  }
}

/**
 * Given the full spoken text so far, extract complete sentences starting from `offset`.
 * Returns the sentences found and the new offset (characters consumed).
 */
export function extractCompleteSentences(
  text: string,
  offset: number,
): { sentences: string[]; newOffset: number } {
  const remaining = text.slice(offset);
  const sentences: string[] = [];

  // Match sentences that end with punctuation followed by whitespace or end of text
  // We only emit sentences that are followed by something else (confirming they're complete)
  const regex = /[^.!?]*[.!?]+(?=\s)/g;
  let match: RegExpExecArray | null;
  let lastEnd = 0;

  while ((match = regex.exec(remaining)) !== null) {
    const sentence = match[0].trim();
    if (sentence) {
      sentences.push(sentence);
      lastEnd = match.index + match[0].length;
    }
  }

  return {
    sentences,
    newOffset: offset + lastEnd,
  };
}
