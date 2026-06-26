import { CanvasSection, DataPlane } from "@/components/cinematic";
import { Surface } from "@/components/ui/surface";
import { SettlementTable, type SettlementTableRow } from "@/components/settlement-table";
import { fixtureBySlug, clubById } from "@/lib/data";
import type { OfficialRow } from "@/lib/accountability";
import type { LockedEntry } from "@/lib/predictions-ledger";

function matchLabel(slug: string): string {
  const f = fixtureBySlug(slug);
  if (!f) return slug;
  return `${clubById(f.homeId).short} vs ${clubById(f.awayId).short}`;
}

type Props = {
  officialRows: OfficialRow[];
  caveats: string[];
  openEntries: LockedEntry[];
};

export function LedgerRecordSections({ officialRows, caveats, openEntries }: Props) {
  // Settlement table rows — verdict comes from canonical row.verdict, never remapped.
  const settlementRows: SettlementTableRow[] = officialRows.map((row) => {
    const f = fixtureBySlug(row.slug);
    const stage = f?.group ? `Group ${f.group}` : (f?.stage ?? "Tournament");
    const date = f
      ? new Date(f.kickoffISO).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—";
    return {
      slug: row.slug,
      matchName: matchLabel(row.slug),
      context: `${stage} · ${date} · ${row.locked.home} / ${row.locked.draw} / ${row.locked.away}`,
      result: row.actual,
      brier: row.grades.modelBrier,
      rps: row.grades.modelRps,
      verdict: row.verdict,
      kickoffMs: f ? new Date(f.kickoffISO).getTime() : 0,
    };
  });

  // Per-team stats: teams in ≥2 graded matches, ranked by avg Brier descending.
  type TeamStats = { hits: number; total: number; brierSum: number };
  const teamStats = new Map<string, TeamStats>();
  for (const row of officialRows) {
    const f = fixtureBySlug(row.slug);
    if (!f) continue;
    for (const label of [clubById(f.homeId).short, clubById(f.awayId).short]) {
      const prev = teamStats.get(label) ?? { hits: 0, total: 0, brierSum: 0 };
      teamStats.set(label, {
        hits: prev.hits + (row.grades.correctPick ? 1 : 0),
        total: prev.total + 1,
        brierSum: prev.brierSum + row.grades.modelBrier,
      });
    }
  }
  const teamRows = [...teamStats.entries()]
    .filter(([, s]) => s.total >= 2)
    .map(([team, s]) => ({ team, ...s, avgBrier: s.brierSum / s.total }))
    .sort((a, b) => b.avgBrier - a.avgBrier)
    .slice(0, 10);

  return (
    <>
      {/* ── SETTLEMENT TABLE (sortable) ── */}
      {officialRows.length > 0 && (
        <CanvasSection
          eyebrow={`Settlement record · ${officialRows.length} graded calls`}
          title="Locked split, official result, and grade."
        >
          <DataPlane>
            <SettlementTable rows={settlementRows} />
            <p className="text-caption mt-3">
              Sorted by date. Click the Brier header to sort by score.
            </p>
          </DataPlane>
        </CanvasSection>
      )}

      {/* ── TEAM BREAKDOWN ── */}
      {officialRows.length >= 3 && teamRows.length > 0 && (
        <CanvasSection eyebrow="Team breakdown" title="Per-team forecasting performance.">
          <Surface className="p-4">
            <div>
              {teamRows.map((r) => (
                <div
                  key={r.team}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-[var(--line)] py-3 last:border-0"
                >
                  <span className="text-title">{r.team}</span>
                  <span className="text-caption tabular text-right">
                    {r.hits}/{r.total} picks
                  </span>
                  <span className="text-caption tabular text-right">
                    Brier {r.avgBrier.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-caption mt-3">
              Sorted by avg Brier (highest = hardest to forecast). n ≥ 2 appearances only.
            </p>
          </Surface>
        </CanvasSection>
      )}

      {/* ── OPEN CALLS ── */}
      <CanvasSection
        eyebrow={`Open calls (${openEntries.length})`}
        title="Frozen probabilities waiting for results."
      >
        <DataPlane>
          <div>
            {openEntries.slice(0, 20).map((e) => (
              <div
                key={e.slug}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--line)] py-4 last:border-0"
              >
                <span className="text-title truncate">{matchLabel(e.slug)}</span>
                <span className="text-caption tabular">
                  <span className="text-[var(--up)]">{e.split.home}</span> / {e.split.draw} /{" "}
                  <span className="text-[var(--down)]">{e.split.away}</span>
                  {e.market ? " · market locked" : ""}
                </span>
              </div>
            ))}
            {openEntries.length > 20 && (
              <p className="text-caption pt-4">…and {openEntries.length - 20} more, all locked.</p>
            )}
          </div>
        </DataPlane>
      </CanvasSection>

      {/* ── CAVEATS ── */}
      <CanvasSection eyebrow="Caveats" title="What this ledger can and cannot claim.">
        <Surface className="p-6">
          <ul className="text-caption max-w-2xl list-disc space-y-1 pl-5">
            {caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          <p className="text-caption mt-4 max-w-3xl">
            Methodology: Elo + Dixon-Coles, trained on ~49k internationals — see the project README
            and audit ledger. RPS = ranked probability score over the ordered win/draw/loss outcome.
          </p>
        </Surface>
      </CanvasSection>
    </>
  );
}
