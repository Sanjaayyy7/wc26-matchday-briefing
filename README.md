# Matchday Briefing

A local Next.js 16 app that wraps the PL Analyst system prompt (one directory up) and delivers a streamed, kitchen-table briefing for every Premier League MD-38 fixture (24 May 2026), with a probability bar, a 6×6 scoreline heatmap, and a threaded follow-up chat that anchors on the original preview.

## Setup

```bash
cp .env.example .env.local
# Paste your Anthropic key into .env.local (must have access to claude-opus-4-7)
npm install
npm run dev
```

Open <http://localhost:3000>.

## Tests

```bash
npm test
```

Unit suites cover the prompt loader, the first-turn template builder, the Output Contract parser (including the degraded-stream fallback), and the joint-Poisson heatmap derivation. There are no UI snapshot tests — the visual layer is verified by walking the dev server in a browser.

## Layout

- `data/` — `clubs.json` and `fixtures.json`. **Edit these before the demo if 2025/26 promotion/relegation differs from the seed.** The 20-club list and 10 final-day fixtures are best-effort and should be eyeballed by a human who knows the table.
- `lib/` — server-only prompt loader, fixture template, Anthropic streaming helper, Output Contract parser, heatmap math.
- `app/api/preview` — streams the first-turn reply.
- `app/api/follow-up` — streams sub-question replies anchored on the preview + conversation history.
- `components/` — UI: monogram crests, hero, fixture grid, preview pane, probability bar, scoreline heatmap, follow-up chat, scaffold panel.

The system prompt itself lives at `../pl-analyst-system-prompt.md` and is read only on the server. It is never sent to the client — verify in DevTools → Network.

## Architecture Notes

- Streaming uses native Web Streams (`ReadableStream`) from the route handler. The client reads via `response.body.getReader()` and re-parses on every chunk so sections light up in order as the model writes them.
- The follow-up chat is stateless on the server: the client sends the full conversation history (seeded with the initial preview as the first assistant turn) on every request, and persists the thread in `localStorage` keyed by fixture slug.
- The 6×6 heatmap is computed deterministically client-side via a constrained joint-Poisson grid search over `λ_home, λ_away` — no extra LLM call.
- If the model's reply doesn't honor the six-section Output Contract, the preview pane degrades to a raw markdown render rather than blanking out.
