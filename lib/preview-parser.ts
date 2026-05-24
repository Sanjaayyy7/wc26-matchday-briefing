export type ParsedPreview = {
  quickTake: string | null;
  scoreline: { home: number; away: number; favored: "home" | "draw" | "away" } | null;
  probabilities: { home: number; draw: number; away: number; confidence: string } | null;
  why: { tactical: string; personnel: string; formContext: string } | null;
  flipFactor: string | null;
  uncertainties: string[] | null;
  raw: string;
  ok: boolean;
};

function extract(text: string, header: RegExp): string | null {
  const m = text.match(header);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const tail = text.slice(start);
  // Stop at the next bolded heading on its own line, or end of string.
  const nextHeader = tail.match(/\n\s*\*\*[A-Z]/);
  const slice = nextHeader && nextHeader.index !== undefined
    ? tail.slice(0, nextHeader.index)
    : tail;
  return slice.trim();
}

export function parsePreview(text: string): ParsedPreview {
  const raw = text;

  const quickTake = extract(raw, /\*\*\s*Quick take[^*]*\*\*[:\s]*/i);

  const scorelineText = extract(raw, /\*\*\s*Most likely scoreline[^*]*\*\*[:\s]*/i);
  let scoreline: ParsedPreview["scoreline"] = null;
  if (scorelineText) {
    const m = scorelineText.match(/(\d+)\s*[–—-]\s*(\d+)/);
    if (m) {
      const h = parseInt(m[1], 10);
      const a = parseInt(m[2], 10);
      scoreline = {
        home: h,
        away: a,
        favored: h > a ? "home" : h < a ? "away" : "draw",
      };
    }
  }

  const probsText = extract(raw, /\*\*\s*Win probability split[^*]*\*\*[:\s]*/i);
  let probabilities: ParsedPreview["probabilities"] = null;
  if (probsText) {
    const m = probsText.match(
      /Home\s+(\d+)%\s*\/\s*Draw\s+(\d+)%\s*\/\s*Away\s+(\d+)%/i,
    );
    if (m && m.index !== undefined) {
      const tail = probsText
        .slice(m.index + m[0].length)
        .replace(/^[.\s]+/, "")
        .trim();
      probabilities = {
        home: parseInt(m[1], 10),
        draw: parseInt(m[2], 10),
        away: parseInt(m[3], 10),
        confidence: tail,
      };
    }
  }

  const whyText = extract(raw, /\*\*\s*Why[^*]*\*\*[:\s]*/i);
  let why: ParsedPreview["why"] = null;
  if (whyText) {
    const t = whyText.match(/\*Tactical:\*\s*([^\n]+)/i)?.[1]?.trim();
    const p = whyText.match(/\*Personnel:\*\s*([^\n]+)/i)?.[1]?.trim();
    const f = whyText.match(/\*Form\s*\/\s*context:\*\s*([^\n]+)/i)?.[1]?.trim();
    if (t && p && f) why = { tactical: t, personnel: p, formContext: f };
  }

  const flipFactor = extract(raw, /\*\*\s*What would flip it[^*]*\*\*[:\s]*/i);

  const uncText = extract(raw, /\*\*\s*Things I[’']?m not sure about[^*]*\*\*[:\s]*/i);
  const uncertainties = uncText
    ? uncText
        .split(/\n/)
        .map((l) => l.replace(/^[-•\s]+/, "").trim())
        .filter(Boolean)
    : null;

  const ok = !!(scoreline && probabilities && why);

  return {
    quickTake,
    scoreline,
    probabilities,
    why,
    flipFactor,
    uncertainties,
    raw,
    ok,
  };
}
