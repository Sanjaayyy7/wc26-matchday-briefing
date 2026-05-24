export type ParsedFollowUp = {
  shortAnswer: string | null;
  mechanism: string | null;
  number: string | null;
  caveat: string | null;
  raw: string;
  ok: boolean;
};

function extract(text: string, header: RegExp): string | null {
  const m = text.match(header);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const tail = text.slice(start);
  const next = tail.match(/\n\s*\*\*[A-Z]/);
  const slice = next && next.index !== undefined ? tail.slice(0, next.index) : tail;
  return slice.trim();
}

export function parseFollowUp(text: string): ParsedFollowUp {
  const shortAnswer = extract(text, /\*\*\s*Short answer[^*]*\*\*[:\s]*/i);
  const mechanism = extract(text, /\*\*\s*(?:The\s+)?mechanism[^*]*\*\*[:\s]*/i);
  const number = extract(text, /\*\*\s*(?:The\s+)?number[^*]*\*\*[:\s]*/i);
  const caveat = extract(text, /\*\*\s*Caveat[^*]*\*\*[:\s]*/i);
  const ok = !!(shortAnswer && mechanism && number);
  return { shortAnswer, mechanism, number, caveat, raw: text, ok };
}
