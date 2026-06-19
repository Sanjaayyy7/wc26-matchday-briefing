import { notFound } from "next/navigation";
import { AppChrome } from "@/components/app-chrome";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { sentimentBySlug, biggestSwing, labelCounts } from "@/lib/sentiment-view";
import { SentimentTimeline } from "@/components/sentiment-timeline";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Sentiment — ${slug}` };
}

export default async function SentimentSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = sentimentBySlug(slug);
  if (!data) notFound();

  const counts = labelCounts(data);
  const swing = biggestSwing(data);
  const posP = counts.total ? Math.round(counts.pos / counts.total * 100) : 0;
  const negP = counts.total ? Math.round(counts.neg / counts.total * 100) : 0;

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <AppChrome
      route="sentiment"
      title={title}
      rail={
        <SignalLine
          signals={[
            { label: "Posts", value: counts.total, detail: "scored" },
            { label: "Positive", value: posP, suffix: "%", tone: "up", detail: "of all posts" },
            { label: "Negative", value: negP, suffix: "%", tone: "down", detail: "of all posts" },
            { label: "Biggest swing", value: swing ? Math.round(Math.abs(swing.delta) * 100) / 100 : 0, decimals: 2, detail: swing ? `min ${swing.event.minute} (${swing.event.type})` : "none" },
          ]}
        />
      }
    >
      <RouteStack className="w-full">
        <CanvasSection eyebrow="Sentiment timeline" title={title}>
          <DataPlane>
            <SentimentTimeline
              timeline={data.timeline}
              events={data.events}
            />
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Event shifts" title="Pre vs post-event sentiment delta.">
          <DataPlane>
            <div className="space-y-0">
              {data.shifts.map((s, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 border-b border-[var(--line)] py-4 last:border-0 items-center">
                  <span className={`h-2 w-2 rounded-full ${s.event.type === "goal" ? "bg-[var(--up)]" : s.event.type === "red" ? "bg-[var(--down)]" : "bg-[var(--ink-muted)]"}`} />
                  <div className="min-w-0">
                    <p className="text-title truncate">
                      min {s.event.minute} — {s.event.label}
                    </p>
                    <p className="text-caption">{s.event.type} · {s.nBefore} posts before / {s.nAfter} after</p>
                  </div>
                  <div className="text-right">
                    <p className="text-caption">Before</p>
                    <p className="text-label tabular">{s.before.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-caption">After</p>
                    <p className="text-label tabular">{s.after.toFixed(2)}</p>
                  </div>
                  <div className="text-right min-w-[4rem]">
                    <p className="text-caption">Delta</p>
                    <p className={`text-label tabular ${s.delta < 0 ? "text-[var(--down)]" : "text-[var(--up)]"}`}>
                      {s.delta > 0 ? "+" : ""}{s.delta.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Model info" title="Scoring metadata.">
          <DataPlane>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-label">Model</dt>
                <dd className="text-caption mt-1 font-mono text-xs break-all">{data.model}</dd>
              </div>
              <div>
                <dt className="text-label">Source</dt>
                <dd className="text-caption mt-1">{data.source}</dd>
              </div>
              <div>
                <dt className="text-label">Generated</dt>
                <dd className="text-caption mt-1">{data.generatedAt.slice(0, 10)}</dd>
              </div>
              <div>
                <dt className="text-label">Buckets</dt>
                <dd className="text-caption mt-1">{data.timeline.length} × 5-min windows</dd>
              </div>
            </dl>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </AppChrome>
  );
}
