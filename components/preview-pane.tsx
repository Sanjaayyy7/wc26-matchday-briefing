"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { parsePreview, type ParsedPreview } from "@/lib/preview-parser";
import { ProbabilityBar } from "./probability-bar";
import { ScorelineHeatmap } from "./scoreline-heatmap";
import type { Club } from "@/lib/data";

type Status = "loading" | "streaming" | "done" | "error";

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
  const [status, setStatus] = useState<Status>("loading");
  const [slowFirstByte, setSlowFirstByte] = useState(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlowFirstByte(true);
    }, 4000);
    const ctl = new AbortController();

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
      <article className="prose prose-invert mt-12 max-w-none rounded-2xl bg-[var(--surface)] p-6 dark:border dark:border-[var(--hairline)]">
        <div className="text-caption mb-3">
          {status === "streaming" ? "Streaming…" : "Raw view — structure not detected"}
        </div>
        <ReactMarkdown>{text}</ReactMarkdown>
      </article>
    );
  }

  return (
    <div className="mt-12 space-y-12">
      {/* Numbers first: the probability split is the page's hero. */}
      <Reveal>
        <h2 className="text-label mb-5">Win probability</h2>
        <ProbabilityBar
          probabilities={parsed.probabilities!}
          home={home}
          away={away}
          hero
        />
      </Reveal>

      <Reveal>
        <h2 className="text-label mb-3">Most likely scoreline</h2>
        <div className="flex items-baseline gap-5">
          <span
            className="text-display tabular"
            style={{ fontSize: "clamp(56px, 9vw, 96px)" }}
          >
            {parsed.scoreline!.home}
            <span className="text-[var(--ink-faint)]">–</span>
            {parsed.scoreline!.away}
          </span>
          <span className="text-[15px] text-[var(--ink-muted)]">
            {parsed.scoreline!.favored === "home"
              ? `${home.name} edge`
              : parsed.scoreline!.favored === "away"
              ? `${away.name} edge`
              : "Draw"}
          </span>
        </div>
      </Reveal>

      {parsed.quickTake && (
        <Reveal>
          <h2 className="text-label mb-3">Quick take</h2>
          <p className="text-title text-2xl leading-snug md:text-[28px]">
            {parsed.quickTake}
          </p>
        </Reveal>
      )}

      <Reveal>
        <h2 className="text-label mb-5">Why</h2>
        <ul className="space-y-5">
          <Bullet tag="Tactical">{parsed.why!.tactical}</Bullet>
          <Bullet tag="Personnel">{parsed.why!.personnel}</Bullet>
          <Bullet tag="Form & context">{parsed.why!.formContext}</Bullet>
        </ul>
      </Reveal>

      {parsed.flipFactor && (
        <Reveal>
          <div className="rounded-2xl border-l-[3px] border-[var(--accent)] bg-[var(--surface)] p-6 dark:border dark:border-l-[3px] dark:border-[var(--hairline)] dark:border-l-[var(--accent)]">
            <h2 className="text-label mb-2">What would flip it</h2>
            <p className="leading-relaxed">{parsed.flipFactor}</p>
          </div>
        </Reveal>
      )}

      <Reveal>
        <h2 className="text-label mb-5">Scoreline distribution</h2>
        <ScorelineHeatmap
          probabilities={parsed.probabilities!}
          scoreline={parsed.scoreline!}
          home={home}
          away={away}
        />
      </Reveal>

      {parsed.uncertainties && parsed.uncertainties.length > 0 && (
        <Reveal>
          <h2 className="text-label mb-3">Things I&rsquo;m not sure about</h2>
          <ul className="space-y-2 text-[15px] text-[var(--ink-muted)]">
            {parsed.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
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
    <li className="flex flex-col gap-1.5 sm:flex-row sm:gap-6">
      <span className="text-label w-32 shrink-0 pt-0.5">{tag}</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function Skeleton({ slow }: { slow: boolean }) {
  return (
    <div className="mt-12 space-y-12" aria-busy>
      <div>
        <div className="mb-5 h-3 w-28 animate-pulse rounded-full bg-[var(--neutral-fill)]" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-12 animate-pulse rounded-full bg-[var(--neutral-fill)]" />
              <div className="h-8 w-20 animate-pulse rounded-lg bg-[var(--neutral-fill)]" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-[var(--neutral-fill)]" />
      </div>
      <div>
        <div className="mb-3 h-3 w-36 animate-pulse rounded-full bg-[var(--neutral-fill)]" />
        <div className="h-20 w-44 animate-pulse rounded-2xl bg-[var(--neutral-fill)]" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--neutral-fill)]" />
        <div className="h-4 w-full animate-pulse rounded-full bg-[var(--neutral-fill)]" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-[var(--neutral-fill)]" />
      </div>
      {slow && (
        <p className="text-caption text-center">
          Claude is thinking — usually 2–3 seconds, occasionally longer.
        </p>
      )}
    </div>
  );
}

function errMessage(status: string): string {
  if (status === "401") return "API key rejected. Check app/.env.local and restart.";
  if (status === "429") return "Rate-limited by Anthropic. Try again shortly.";
  if (status === "400") return "The API refused the request — check your key's credit balance.";
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
    <div className="mt-12 rounded-2xl bg-[var(--surface)] p-6 dark:border dark:border-[var(--hairline)]">
      <p className="text-[15px]">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--down)]" aria-hidden />
        {message}
      </p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-foreground)] transition-transform duration-300 hover:scale-[1.03]"
      >
        Retry
      </button>
    </div>
  );
}
