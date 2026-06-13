"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { parseFollowUp, type ParsedFollowUp } from "@/lib/followup-parser";
import { NumberTicker } from "./number-ticker";

const BTTS_QUESTION =
  "Both teams to score — what's the chance for this fixture? Give me your read.";

export function BttsCard({ slug }: { slug: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"loading" | "streaming" | "done" | "error">(
    "loading",
  );
  useEffect(() => {
    // Local model call — free and idempotent, so StrictMode re-runs are fine.
    const ctl = new AbortController();
    (async () => {
      try {
        setStatus("loading");
        setText("");
        const res = await fetch("/api/follow-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, question: BTTS_QUESTION }),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          setStatus("error");
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          setStatus("streaming");
          setText(buf);
        }
        setStatus("done");
      } catch {
        if (!ctl.signal.aborted) setStatus("error");
      }
    })();
    return () => ctl.abort();
  }, [slug]);

  if (status === "loading") return <Skeleton />;
  if (status === "error") {
    return (
      <Shell>
        <p className="text-caption">
          Could not fetch the BTTS read. Refresh to retry.
        </p>
      </Shell>
    );
  }

  const errMatch = text.match(/__ERROR__:([^:\n]+):?/);
  if (errMatch) {
    return (
      <Shell>
        <p className="text-caption">
          BTTS read failed: status {errMatch[1]}.
        </p>
      </Shell>
    );
  }

  const parsed: ParsedFollowUp = parseFollowUp(text);

  if (!parsed.ok) {
    return (
      <Shell>
        <article className="prose prose-invert max-w-none text-sm">
          <ReactMarkdown>{text || "_streaming…_"}</ReactMarkdown>
        </article>
      </Shell>
    );
  }

  const pctMatch = parsed.number?.match(/(\d+)\s*%/);

  return (
    <Shell>
      <div className="space-y-4">
        {pctMatch && (
          <div className="flex items-baseline gap-3">
            <NumberTicker
              value={Number(pctMatch[1])}
              suffix="%"
              className="text-display text-3xl"
            />
            <span className="text-caption">{parsed.number}</span>
          </div>
        )}
        {parsed.shortAnswer && <Row tag="Short answer">{parsed.shortAnswer}</Row>}
        {parsed.mechanism && <Row tag="Mechanism">{parsed.mechanism}</Row>}
        {!pctMatch && parsed.number && (
          <Row tag="The number">{parsed.number}</Row>
        )}
        {parsed.caveat && <Row tag="Caveat">{parsed.caveat}</Row>}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-12 rounded-2xl bg-[var(--surface)] p-6 dark:border dark:border-[var(--hairline)]"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-label">Both teams to score?</h2>
        <span className="text-caption rounded-full bg-[var(--neutral-fill)] px-2.5 py-0.5">
          Auto
        </span>
      </div>
      {children}
    </motion.section>
  );
}

function Row({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-6">
      <span className="text-label w-32 shrink-0 pt-0.5">{tag}</span>
      <span>{children}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <Shell>
      <div className="space-y-3" aria-busy>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-[var(--neutral-fill)]" />
        <div className="h-4 w-full animate-pulse rounded-full bg-[var(--neutral-fill)]" />
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-[var(--neutral-fill)]" />
      </div>
    </Shell>
  );
}
