"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
const storageKey = (slug: string) => `pl-followup:${slug}`;

export function FollowUpChat({
  slug,
  previewText,
}: {
  slug: string;
  previewText: string;
}) {
  const [history, setHistory] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    try {
      const cached = localStorage.getItem(storageKey(slug));
      if (cached) {
        setHistory(JSON.parse(cached));
        return;
      }
    } catch {
      // ignore — fall through to seeding
    }
    const initial: Msg[] = [{ role: "assistant", content: previewText }];
    setHistory(initial);
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify(initial));
    } catch {
      // localStorage unavailable — keep state in memory only
    }
  }, [slug, previewText]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || streaming) return;
    setQuestion("");
    setStreaming(true);
    const pending: Msg[] = [
      ...history,
      { role: "user", content: q },
      { role: "assistant", content: "" },
    ];
    setHistory(pending);

    try {
      const res = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, history, question: q }),
      });
      if (!res.ok || !res.body) throw new Error("bad response");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        setHistory((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: buf };
          return copy;
        });
      }
      setHistory((prev) => {
        try {
          localStorage.setItem(storageKey(slug), JSON.stringify(prev));
        } catch {
          // ignore
        }
        return prev;
      });
    } catch {
      setHistory((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "_Stream failed. Try again._",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function clearThread() {
    try {
      localStorage.removeItem(storageKey(slug));
    } catch {
      // ignore
    }
    setHistory([{ role: "assistant", content: previewText }]);
  }

  // Hide the initial preview-as-assistant turn from the visible thread.
  const visible = history.slice(1);

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Follow-ups
        </h3>
        {visible.length > 0 && (
          <button
            onClick={clearThread}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] transition hover:text-[var(--crimson)]"
          >
            clear thread
          </button>
        )}
      </div>
      <div className="grid gap-3">
        {visible.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4 ${
              m.role === "user"
                ? "border-l-2 border-l-[var(--cyan)]"
                : "border-l-2 border-l-[var(--gold)]"
            }`}
          >
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {m.role === "user" ? "Son" : "Dad's read"}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {m.content || (streaming && i === visible.length - 1 ? "…" : "")}
            </p>
          </div>
        ))}
      </div>
      <form onSubmit={ask} className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          aria-label="Ask a follow-up question"
          placeholder="What about BTTS? Who scores first?"
          disabled={streaming}
          className="flex-1 rounded-md border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-sm focus:border-[var(--gold)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={streaming || !question.trim()}
          className="rounded-md border border-[var(--gold)] px-5 py-3 text-sm text-[var(--gold)] transition hover:bg-[var(--gold)] hover:text-[var(--canvas)] disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </section>
  );
}
