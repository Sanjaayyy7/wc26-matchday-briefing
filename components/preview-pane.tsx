"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { parsePreview, type ParsedPreview } from "@/lib/preview-parser";
import { ProbabilityBar } from "./probability-bar";
import { ScorelineHeatmap } from "./scoreline-heatmap";
import type { Club } from "@/lib/data";

type Status = "idle" | "loading" | "streaming" | "done" | "error";

export function PreviewPane({
  slug,
  home,
  away,
  onComplete,
}: {
  slug: string;
  home: Club;
  away: Club;
  onComplete: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [slowFirstByte, setSlowFirstByte] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;
    setText("");
    setStatus("loading");
    setSlowFirstByte(false);
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlowFirstByte(true);
    }, 4000);
    const ctl = new AbortController();
    abortRef.current = ctl;

    (async () => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          if (!cancelled) setStatus("error");
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          clearTimeout(slowTimer);
          if (cancelled) return;
          setStatus("streaming");
          setText(buf);
        }
        if (cancelled) return;
        setStatus("done");
        onCompleteRef.current(buf);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      ctl.abort();
    };
  }, [slug]);

  const parsed: ParsedPreview = useMemo(() => parsePreview(text), [text]);
  const errMatch = text.match(/__ERROR__:([^:\n]+):?/);

  if (status === "loading") return <Skeleton slow={slowFirstByte} />;
  if (status === "error") {
    return (
      <ErrorBlock
        message="Network error — could not reach the server."
        onRetry={() => location.reload()}
      />
    );
  }
  if (errMatch) {
    return (
      <ErrorBlock
        message={errMessage(errMatch[1])}
        onRetry={() => location.reload()}
      />
    );
  }
  if (status === "done" && !parsed.ok && parsed.raw.length < 40) {
    return (
      <ErrorBlock
        message="The model returned a short or unstructured reply."
        onRetry={() => location.reload()}
      />
    );
  }

  if (!parsed.ok) {
    return (
      <article className="prose prose-invert mt-8 max-w-none rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6">
        <div className="mb-3 inline-block rounded-full border border-[var(--hairline)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          {status === "streaming" ? "streaming…" : "raw view (structure not detected)"}
        </div>
        <ReactMarkdown>{text}</ReactMarkdown>
      </article>
    );
  }

  return (
    <div className="mt-8 grid gap-6">
      {parsed.quickTake && (
        <Section label="Quick take">
          <p className="font-display text-2xl leading-snug md:text-3xl">
            {parsed.quickTake}
          </p>
        </Section>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Section label="Most likely scoreline">
          <div
            className="font-display leading-none"
            style={{
              fontSize: "clamp(48px, 8vw, 112px)",
              fontFeatureSettings: "'tnum'",
            }}
          >
            {parsed.scoreline!.home}
            <span className="text-[var(--ink-muted)]">–</span>
            {parsed.scoreline!.away}
          </div>
          <div className="mt-2 text-sm text-[var(--ink-muted)]">
            {parsed.scoreline!.favored === "home"
              ? `${home.name} edge`
              : parsed.scoreline!.favored === "away"
              ? `${away.name} edge`
              : "Draw"}
          </div>
        </Section>
        <Section label="Win probability">
          <ProbabilityBar
            probabilities={parsed.probabilities!}
            home={home}
            away={away}
          />
        </Section>
      </div>
      <Section label="Why">
        <ul className="grid gap-3">
          <Bullet tag="Tactical">{parsed.why!.tactical}</Bullet>
          <Bullet tag="Personnel">{parsed.why!.personnel}</Bullet>
          <Bullet tag="Form / context">{parsed.why!.formContext}</Bullet>
        </ul>
      </Section>
      {parsed.flipFactor && (
        <Section label="What would flip it">
          <p className="leading-relaxed">{parsed.flipFactor}</p>
        </Section>
      )}
      <Section label="Scoreline distribution">
        <ScorelineHeatmap
          probabilities={parsed.probabilities!}
          scoreline={parsed.scoreline!}
          home={home}
          away={away}
        />
      </Section>
      {parsed.uncertainties && parsed.uncertainties.length > 0 && (
        <Section label="Things I'm not sure about">
          <ul className="grid gap-2 text-sm text-[var(--ink-muted)]">
            {parsed.uncertainties.map((u, i) => (
              <li key={i}>· {u}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6"
    >
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {label}
      </div>
      {children}
    </motion.section>
  );
}

function Bullet({
  tag,
  children,
}: {
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:gap-4">
      <span className="w-32 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
        {tag}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function Skeleton({ slow }: { slow: boolean }) {
  const labels = [
    "Quick take",
    "Most likely scoreline",
    "Win probability",
    "Why",
    "What would flip it",
    "Things I'm not sure about",
  ];
  return (
    <div className="mt-8 grid gap-4">
      {labels.map((l) => (
        <div
          key={l}
          className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6"
        >
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {l}
          </div>
          <div className="font-mono text-sm text-[var(--ink-muted)] animate-pulse">
            ... ... ...
          </div>
        </div>
      ))}
      {slow && (
        <p className="text-center text-sm text-[var(--ink-muted)]">
          Claude is thinking — usually 2–3 seconds, occasionally longer.
        </p>
      )}
    </div>
  );
}

function errMessage(status: string): string {
  if (status === "401") return "API key rejected. Check app/.env.local and restart.";
  if (status === "429") return "Rate-limited by Anthropic. Try again shortly.";
  return "The stream failed mid-way.";
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-[var(--crimson)] bg-[var(--surface)] p-6">
      <p>{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-full border border-[var(--gold)] px-4 py-2 text-sm text-[var(--gold)] transition hover:bg-[var(--gold)] hover:text-[var(--canvas)]"
      >
        Retry
      </button>
    </div>
  );
}
