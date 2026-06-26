import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { sentimentSlugs, sentimentBySlug, biggestSwing, labelCounts, type SentimentOutput, type SentimentShift } from "@/lib/sentiment-view";
import Link from "next/link";

export const metadata = { title: "Sentiment — Matchday Briefing" };

interface FixtureSummary {
  slug: string;
  data: SentimentOutput;
  counts: { pos: number; neg: number; neu: number; total: number };
  swing: SentimentShift | null;
}

export default function SentimentPage() {
  const slugs = sentimentSlugs();

  const summaries: FixtureSummary[] = slugs.flatMap((slug) => {
    const data = sentimentBySlug(slug);
    if (!data) return [];
    const counts = labelCounts(data);
    const swing = biggestSwing(data);
    return [{ slug, data, counts, swing }];
  });

  const totalPosts = summaries.reduce((s, x) => s + x.counts.total, 0);
  const maxSwing = summaries.reduce((best, x) => {
    const abs = x.swing ? Math.abs(x.swing.delta) : 0;
    return abs > best ? abs : best;
  }, 0);
  const modelName = summaries[0]?.data.model ?? "none";

  return (
    <WCS26Shell
      route="sentiment"
      title="Sentiment Analysis"
      rail={
        <SignalLine
          signals={[
            { label: "Posts analyzed", value: totalPosts, detail: "across all fixtures" },
            { label: "Fixtures scored", value: slugs.length, detail: "with sentiment data" },
            { label: "Biggest swing", value: Math.round(maxSwing * 100) / 100, decimals: 2, detail: "max |delta| across events" },
          ]}
        />
      }
    >
      <RouteStack className="w-full">
        <CanvasSection
          eyebrow="Fan sentiment"
          title="Post-by-post reaction to match events."
        >
          <DataPlane>
            <p className="text-caption max-w-2xl mb-4">
              Model: <span className="text-[var(--ink)] font-mono text-fine">{modelName}</span>.
              Sentiment scored server-side using a HuggingFace transformer (or deterministic lexicon fallback).
              Shift delta = mean post-event sentiment minus mean pre-event sentiment (window ±10 min).
            </p>
          </DataPlane>
        </CanvasSection>

        {summaries.length === 0 && (
          <CanvasSection eyebrow="No data" title="No scored fixtures yet.">
            <DataPlane>
              <p className="text-caption">
                Run <code className="font-mono text-fine">npm run sentiment:score -- &lt;slug&gt;</code> to generate sentiment data.
              </p>
            </DataPlane>
          </CanvasSection>
        )}

        {summaries.map((s) => {
          const posP = s.counts.total ? Math.round(s.counts.pos / s.counts.total * 100) : 0;
          const negP = s.counts.total ? Math.round(s.counts.neg / s.counts.total * 100) : 0;
          return (
            <CanvasSection key={s.slug} eyebrow={s.slug} title={s.slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}>
              <DataPlane>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-label">Posts</p>
                    <p className="text-stat mt-2">{s.counts.total}</p>
                  </div>
                  <div>
                    <p className="text-label">Positive</p>
                    <p className="text-stat mt-2 text-[var(--up)]">{posP}%</p>
                  </div>
                  <div>
                    <p className="text-label">Negative</p>
                    <p className="text-stat mt-2 text-[var(--down)]">{negP}%</p>
                  </div>
                  <div>
                    <p className="text-label">Biggest swing</p>
                    <p className={`text-stat mt-2 ${s.swing && s.swing.delta < 0 ? "text-[var(--down)]" : "text-[var(--up)]"}`}>
                      {s.swing ? (s.swing.delta > 0 ? "+" : "") + s.swing.delta.toFixed(2) : "—"}
                    </p>
                    {s.swing && (
                      <p className="text-caption mt-1">
                        min {s.swing.event.minute} ({s.swing.event.type})
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-6 border-t border-[var(--line)] pt-5">
                  <Link
                    href={`/sentiment/${s.slug}`}
                    className="inline-flex items-center gap-2 border-b border-[var(--stage-final)] pb-1 text-title transition-colors duration-300 hover:text-[var(--stage-final)]"
                  >
                    View full timeline →
                  </Link>
                </div>
              </DataPlane>
            </CanvasSection>
          );
        })}
      </RouteStack>
    </WCS26Shell>
  );
}
