"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
const storageKey = (slug: string) => `pl-followup:${slug}`;

function loadOrSeed(slug: string, previewText: string): Msg[] {
  try {
    const cached = localStorage.getItem(storageKey(slug));
    if (cached) return JSON.parse(cached);
  } catch {
    // localStorage unavailable — seed in memory
  }
  const initial: Msg[] = [{ role: "assistant", content: previewText }];
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(initial));
  } catch {
    // ignore
  }
  return initial;
}

export function FollowUpChat({
  slug,
  previewText,
}: {
  slug: string;
  previewText: string;
}) {
  // Client-only component (mounted after streaming completes), so the lazy
  // initializer can touch localStorage safely — no seeding effect needed.
  const [history, setHistory] = useState<Msg[]>(() =>
    loadOrSeed(slug, previewText),
  );
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);

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
    <section className="mt-12">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-label">Follow-ups</h2>
        {visible.length > 0 && (
          <button
            onClick={clearThread}
            className="text-caption transition-colors duration-300 hover:text-[var(--down)]"
          >
            Clear thread
          </button>
        )}
      </div>
      <div className="space-y-3">
        {visible.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-sm rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-foreground)] sm:max-w-md">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex">
              <p className="max-w-sm whitespace-pre-wrap rounded-2xl rounded-bl-md bg-[var(--surface)] px-4 py-2.5 dark:border dark:border-[var(--hairline)] sm:max-w-md">
                {m.content || (streaming && i === visible.length - 1 ? "…" : "")}
              </p>
            </div>
          ),
        )}
      </div>
      <form onSubmit={ask} className="mt-5 flex items-center gap-2 rounded-full bg-[var(--surface)] py-1.5 pl-5 pr-1.5 dark:border dark:border-[var(--hairline)]">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          aria-label="Ask a follow-up question"
          placeholder="What about BTTS? Who scores first?"
          disabled={streaming}
          className="h-9 flex-1 bg-transparent outline-none placeholder:text-[var(--ink-faint)]"
        />
        <button
          type="submit"
          aria-label="Send question"
          disabled={streaming || !question.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] transition-transform duration-300 hover:scale-105 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
