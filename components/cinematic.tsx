import Link from "next/link";
import { ArrowRight, CircleDot, Radio, ShieldCheck } from "lucide-react";
import { Crest } from "./crest";
import { NumberTicker } from "./number-ticker";
import { StageChip } from "./stage-chip";
import { VerdictChip } from "./verdict-chip";
import { formatKickoff } from "@/lib/format-kickoff";
import { kitAccent, kitPairWashStyle, stageVar } from "@/lib/kit-color";
import type { Club, Fixture } from "@/lib/data";
import type { MatchRowData, MatchView } from "@/lib/match-view";

type Tone = "neutral" | "up" | "down" | "warn";

function toneClass(tone: Tone = "neutral") {
  if (tone === "up") return "text-[var(--up)]";
  if (tone === "down") return "text-[var(--down)]";
  if (tone === "warn") return "text-[var(--stage-sf)]";
  return "text-[var(--ink)]";
}

// Restrained accent cycle (constitution: one accent + monochrome, no rainbow).
// Decorative tick marks read as ink with a single jade/gold signal.
const SPECTRAL = [
  "var(--up)",
  "var(--ink-faint)",
  "var(--warn)",
  "var(--ink-faint)",
  "var(--up)",
  "var(--ink-faint)",
] as const;

function spectralColor(index: number) {
  return SPECTRAL[index % SPECTRAL.length];
}

export function RouteStack({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`route-stack space-y-28 md:space-y-40 ${className}`}>{children}</div>;
}

export function CanvasSection({
  eyebrow,
  title,
  visual,
  children,
  className = "",
}: {
  eyebrow: string;
  title?: string;
  visual?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const headingClass = visual
    ? "grid gap-8 lg:grid-cols-[minmax(14rem,0.44fr)_minmax(0,1fr)] lg:items-end"
    : "max-w-4xl";
  return (
    <section className={`route-section animate-rise space-y-8 ${className}`}>
      <div className="section-heading relative border-t border-[var(--line)] pt-8">
        <div className="chroma-rule absolute left-0 top-0 h-px w-36" />
        <div className={headingClass}>
          <div>
            <p className="text-label">{eyebrow}</p>
            {title && <h2 className="text-display mt-3">{title}</h2>}
          </div>
          {visual}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DataPlane({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`data-plane relative border-y border-[var(--line)] py-6 md:py-8 ${className}`} style={style}>
      <div className="chroma-rule absolute left-0 top-0 h-px w-24" />
      {children}
    </div>
  );
}

export function SignalStat({
  label,
  value,
  suffix = "",
  decimals = 0,
  tone = "neutral",
  detail,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  tone?: Tone;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-label">{label}</p>
      <NumberTicker
        value={value}
        suffix={suffix}
        decimals={decimals}
        className={`mt-1 block font-[family-name:var(--font-display)] text-[clamp(1.625rem,2.4vw,2.25rem)] font-bold leading-none tracking-tight tabular ${toneClass(tone)}`}
      />
      {detail && <p className="text-caption mt-1 truncate">{detail}</p>}
    </div>
  );
}

export function SignalLine({
  signals,
}: {
  signals: Array<{
    label: string;
    value: number;
    suffix?: string;
    decimals?: number;
    tone?: Tone;
    detail?: string;
  }>;
}) {
  return (
    <div className="relative flex gap-8 overflow-x-auto border-y border-[var(--line)] py-5">
      <div className="chroma-rule absolute left-0 top-0 h-px w-48" />
      {signals.map((signal, index) => (
        <div key={signal.label} className="min-w-36 border-r border-[var(--line)] pr-8 last:border-0">
          <span className="mb-3 block h-1 w-8" style={{ background: spectralColor(index) }} />
          <SignalStat {...signal} />
        </div>
      ))}
    </div>
  );
}

export function MetricRun({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: Tone }>;
}) {
  return (
    <div className="divide-y divide-[var(--line)]">
      {items.map((item, index) => (
        <div key={item.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 py-3">
          <span className="mt-1 h-5 w-px" style={{ background: spectralColor(index) }} />
          <span className="text-caption truncate">{item.label}</span>
          <span className={`text-label tabular ${toneClass(item.tone)}`}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ArtifactScene({
  title,
  subtitle,
  metrics,
  children,
  tint,
  className = "",
}: {
  title: string;
  subtitle?: string;
  metrics?: React.ReactNode;
  children?: React.ReactNode;
  tint?: string;
  className?: string;
}) {
  return (
    <section
      className={`scanline relative -mx-6 min-h-120 overflow-hidden px-6 py-16 md:py-24 ${className}`}
      style={
        tint
          ? ({ "--artifact-tint": tint } as React.CSSProperties)
          : undefined
      }
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--ink)_5%,transparent),transparent_58%)]" />
      <div className="chroma-rule absolute left-6 top-0 h-px w-64 md:w-96" />
      <div className="absolute inset-x-0 top-1/2 hidden h-px bg-[var(--line)] md:block" />
      <div className="absolute bottom-0 left-0 h-1 w-full bg-[var(--artifact-tint,var(--tint))]" />
      <div className="relative z-10 max-w-5xl">
        <p className="text-label">World Cup 2026</p>
        <h1 className="text-hero mt-5">{title}</h1>
        {subtitle && <p className="text-title mt-4 max-w-2xl text-[var(--ink-muted)]">{subtitle}</p>}
        {metrics && <div className="mt-10 max-w-4xl border-t border-[var(--line)] pt-6">{metrics}</div>}
        {children}
      </div>
    </section>
  );
}

export function HeroScene({
  fixture,
  home,
  away,
  kicker,
  variant = "home",
}: {
  fixture: Fixture;
  home: Club;
  away: Club;
  kicker?: React.ReactNode;
  variant?: "home" | "fixture";
}) {
  return (
    <section
      className="scanline relative -mx-6 min-h-[82vh] overflow-hidden px-6 py-14 md:py-20"
      style={kitPairWashStyle(home.primary, away.primary)}
    >
      <div className="chroma-rule absolute left-6 top-0 h-px w-64 md:w-96" />
      <div className="hero-atmosphere absolute inset-0 opacity-80" />
      <div className="absolute bottom-0 left-0 h-1 w-1/2" style={{ background: "var(--kit-home)" }} />
      <div className="absolute bottom-0 right-0 h-1 w-1/2" style={{ background: "var(--kit-away)" }} />
      <div className="relative z-10 flex min-h-[calc(82vh-5rem)] flex-col justify-between gap-12">
        {variant === "home" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <StageChip stage={fixture.stage} />
                <span className="text-label">{formatKickoff(fixture)} · {fixture.venue}</span>
              </div>
              <span className="text-label">Tournament command center</span>
            </div>

            <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)]">
              <div className="max-w-5xl">
                <p className="text-label">World Cup 2026</p>
                <h1 className="text-hero mt-5">Tournament command.</h1>
                <p className="text-title mt-6 max-w-3xl text-[var(--ink-muted)]">
                  Match rooms, locked probabilities, simulation odds, and a public ledger on one cinematic black desk.
                </p>
                <Link
                  href={`/fixture/${fixture.slug}`}
                  className="mt-9 inline-flex items-center gap-2 border-b border-[var(--stage-final)] pb-1 text-title transition-colors duration-300 hover:text-[var(--stage-final)]"
                >
                  Open featured briefing <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="border-t border-[var(--line)] pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <p className="text-label">Featured fixture</p>
                <div className="mt-6 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Crest short={home.short} primary={home.primary} secondary={home.secondary} name={home.name} size={48} />
                      <span className="text-title truncate">{home.name}</span>
                    </div>
                    <span className="h-px w-12 shrink-0" style={{ background: "var(--kit-home)" }} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Crest short={away.short} primary={away.primary} secondary={away.secondary} name={away.name} size={48} />
                      <span className="text-title truncate">{away.name}</span>
                    </div>
                    <span className="h-px w-12 shrink-0" style={{ background: "var(--kit-away)" }} />
                  </div>
                </div>
                <p className="text-caption mt-6">{fixture.stakes}</p>
                {kicker && <div className="mt-6 border-t border-[var(--line)] pt-5">{kicker}</div>}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <StageChip stage={fixture.stage} />
                <span className="text-label">{formatKickoff(fixture)} · {fixture.venue}</span>
              </div>
              <span className="text-label">Match room</span>
            </div>

            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="mb-5 flex items-center gap-4">
                  <Crest short={home.short} primary={home.primary} secondary={home.secondary} name={home.name} size={56} />
                  <span className="text-label">Home side</span>
                </div>
                <div className="border-l pl-5" style={{ borderColor: "var(--kit-home)" }}>
                  <h1 className="text-hero">{home.name}</h1>
                </div>
              </div>

              <div className="hidden text-center lg:block">
                <div className="text-display chroma-text">VS</div>
                <div className="mx-auto mt-5 h-16 w-px bg-[var(--line)]" />
              </div>

              <div className="min-w-0 lg:text-right">
                <div className="mb-5 flex items-center gap-4 lg:justify-end">
                  <span className="text-label">Away side</span>
                  <Crest short={away.short} primary={away.primary} secondary={away.secondary} name={away.name} size={56} />
                </div>
                <div className="border-l pl-5 lg:border-l-0 lg:border-r lg:pl-0 lg:pr-5" style={{ borderColor: "var(--kit-away)" }}>
                  <h2 className="text-hero">{away.name}</h2>
                </div>
              </div>
            </div>

            <div className="grid gap-8 border-t border-[var(--line)] pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)] lg:items-start">
              <div>
                <p className="text-title max-w-3xl">{fixture.stakes}</p>
                <Link
                  href={`/fixture/${fixture.slug}`}
                  className="mt-7 inline-flex items-center gap-2 border-b border-[var(--stage-final)] pb-1 text-title transition-colors duration-300 hover:text-[var(--stage-final)]"
                >
                  Open briefing <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <span className="text-label inline-flex items-center gap-2">
                    <Radio className="h-4 w-4 text-[var(--up)]" />
                    Local prediction room
                  </span>
                  <CircleDot className="h-4 w-4 text-[var(--stage-sf)]" />
                </div>
                {kicker && <div className="border-t border-[var(--line)] pt-5">{kicker}</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function FixtureLine({
  view,
  density = "comfortable",
}: {
  view: MatchView;
  density?: "compact" | "comfortable" | "scene";
}) {
  const score =
    view.status === "official" || view.status === "informational" ? view.score.replace("-", "–") : null;
  const isCompact = density === "compact";
  return (
    <Link
      href={`/fixture/${view.fixture.slug}`}
      className={`group relative grid gap-4 border-b border-[var(--line)] py-4 pl-4 transition-colors duration-300 hover:bg-[var(--panel)] ${
        isCompact ? "md:grid-cols-[7rem_1fr_auto]" : "md:grid-cols-[9rem_1fr_auto]"
      }`}
    >
      <span
        className="absolute bottom-4 left-0 top-4 w-px"
        style={{
          background: `linear-gradient(180deg, ${kitAccent(view.home.primary, "up")}, ${kitAccent(view.away.primary, "down")})`,
        }}
      />
      <div className="flex items-center gap-2 md:block">
        <span className="text-caption tabular">{view.dateLabel}</span>
        <div className="mt-1">
          <StageChip stage={view.fixture.stage} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: kitAccent(view.home.primary, "up") }} />
          <span className="text-title truncate">{view.home.name}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: kitAccent(view.away.primary, "down") }} />
          <span className="text-title truncate">{view.away.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 md:justify-end">
        {score ? <span className="text-display tabular text-3xl">{score}</span> : null}
        {view.status === "official" ? <VerdictChip verdict={view.verdict} /> : null}
        {view.status === "locked" ? (
          <span className="text-caption tabular">
            {view.lock.split.home}/{view.lock.split.draw}/{view.lock.split.away}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function AgentActivity({
  items,
}: {
  items: Array<{ label: string; detail: string; tone?: Tone }>;
}) {
  return (
    <DataPlane>
      <div className="mb-5 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[var(--up)]" />
        <h2 className="text-label">Agent activity</h2>
      </div>
      <div className="space-y-5">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="grid grid-cols-[auto_1fr] gap-3">
            <span
              className="mt-1 h-8 w-px"
              style={{
                background:
                  item.tone === "warn"
                    ? "var(--stage-sf)"
                    : item.tone === "down"
                      ? "var(--down)"
                      : item.tone === "up"
                        ? "var(--up)"
                        : spectralColor(index),
              }}
            />
            <div>
              <p className="text-title">{item.label}</p>
              <p className="text-caption mt-1">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </DataPlane>
  );
}

export function MatchMarketLine({ row }: { row: MatchRowData }) {
  return (
    <Link
      href={`/fixture/${row.slug}`}
      className="relative grid gap-3 border-b border-[var(--line)] py-3 pl-4 transition-colors duration-300 hover:bg-[var(--panel)] md:grid-cols-[6rem_1fr_8rem_8rem]"
    >
      <span className="absolute bottom-3 left-0 top-3 w-px" style={{ background: stageVar(row.stage) }} />
      <div>
        <p className="text-caption tabular">{row.dateLabel}</p>
        <StageChip stage={row.stage} />
      </div>
      <div className="min-w-0">
        <p className="text-title truncate">{row.homeName}</p>
        <p className="text-title truncate text-[var(--ink-muted)]">{row.awayName}</p>
      </div>
      <div className="tabular">
        <p className="text-caption">Market</p>
        <p className="text-title">
          {row.split ? `${row.split.home}/${row.split.draw}/${row.split.away}` : row.score ?? "pending"}
        </p>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        {row.verdict ? <VerdictChip verdict={row.verdict} /> : null}
        {row.grade ? <span className="text-caption tabular">B {row.grade.brier.toFixed(3)}</span> : null}
      </div>
    </Link>
  );
}
