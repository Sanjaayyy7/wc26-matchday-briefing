"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { parseFollowUp, type ParsedFollowUp } from "@/lib/followup-parser";

const BTTS_QUESTION =
  "Both teams to score — what's the chance for this fixture? Give me your read.";

export function BttsCard({
  slug,
  previewText,
}: {
  slug: string;
  previewText: string;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"loading" | "streaming" | "done" | "error">(
    "loading",
  );
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    // Guard against StrictMode double-invoke and re-mounts for the same fixture.
    if (firedRef.current === slug) return;
    firedRef.current = slug;

    const ctl = new AbortController();
    (async () => {
      try {
        setStatus("loading");
        setText("");
        const res = await fetch("/api/follow-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            history: [{ role: "assistant", content: previewText }],
            question: BTTS_QUESTION,
          }),
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
        setStatus("error");
      }
    })();
    return () => ctl.abort();
  }, [slug, previewText]);

  if (status === "loading") return <Skeleton />;
  if (status === "error") {
    return (
      <Shell>
        <p className="text-sm text-[var(--ink-muted)]">
          Couldn't fetch the BTTS read. Refresh to retry.
        </p>
      </Shell>
    );
  }

  const errMatch = text.match(/__ERROR__:([^:\n]+):?/);
  if (errMatch) {
    return (
      <Shell>
        <p className="text-sm text-[var(--ink-muted)]">
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

  return (
    <Shell>
      <div className="grid gap-4">
        {parsed.shortAnswer && (
          <Row tag="Short answer">{parsed.shortAnswer}</Row>
        )}
        {parsed.mechanism && <Row tag="Mechanism">{parsed.mechanism}</Row>}
        {parsed.number && (
          <Row tag="The number">
            <span className="font-mono">{parsed.number}</span>
          </Row>
        )}
        {parsed.caveat && <Row tag="Caveat">{parsed.caveat}</Row>}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-6 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Both teams to score
        </div>
        <span className="rounded-full border border-[var(--hairline)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gold)]">
          auto
        </span>
      </div>
      {children}
    </motion.section>
  );
}

function Row({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
      <span className="w-32 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
        {tag}
      </span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <Shell>
      <div className="font-mono text-sm text-[var(--ink-muted)] animate-pulse">
        ... ... ...
      </div>
    </Shell>
  );
}
