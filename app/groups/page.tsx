import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Crest } from "@/components/crest";
import { NumberTicker } from "@/components/number-ticker";
import { allClubs, fixturesByGroup, type Club } from "@/lib/data";
import { groupStandings } from "@/lib/standings";
import { kitAccent } from "@/lib/kit-color";
import simulation from "@/data/simulation.json";

export const metadata = { title: "Groups — Matchday Briefing" };

const GROUPS = "ABCDEFGHIJKL".split("");

function GroupBand({ letter, clubs, index }: { letter: string; clubs: Club[]; index: number }) {
  const members = clubs.filter((c) => c.group === letter);
  const rows = groupStandings(
    members.map((c) => c.id),
    fixturesByGroup(letter),
  );
  const byId = new Map(members.map((c) => [c.id, c]));
  const sim = (simulation as { teams: Record<string, { advanceGroup: number }> }).teams;
  const signal = `var(--signal-${(index % 7) + 1})`;
  const maxAdv = Math.max(
    ...rows.map((row) => {
      const club = byId.get(row.teamId)!;
      return sim[club.datasetName ?? club.name]?.advanceGroup ?? 0;
    }),
    0.01,
  );
  return (
    <section
      className="relative grid gap-6 border-b border-[var(--line)] py-9 last:border-0 lg:grid-cols-[9rem_minmax(0,1fr)]"
      style={{ "--group-signal": signal } as CSSProperties}
    >
      <div>
        <div className="text-hero chroma-text leading-none">{letter}</div>
        <div className="mt-4 h-px w-20" style={{ background: "var(--group-signal)" }} />
        <p className="text-label mt-4">Group {letter}</p>
        <p className="text-caption mt-1 max-w-28">Top two advance</p>
      </div>

      <div className="min-w-0">
        <div className="hidden grid-cols-[minmax(12rem,1fr)_4rem_4rem_4rem_minmax(9rem,0.72fr)] gap-4 border-b border-[var(--line)] pb-3 md:grid">
          <span className="text-caption">Team</span>
          <span className="text-caption text-right">P</span>
          <span className="text-caption text-right">GD</span>
          <span className="text-caption text-right">Pts</span>
          <span className="text-caption text-right">Advance</span>
        </div>

        <div>
          {rows.map((r, rowIndex) => {
            const club = byId.get(r.teamId)!;
            const adv = sim[club.datasetName ?? club.name]?.advanceGroup ?? 0;
            const goalDiff = r.gf - r.ga;
            const inCut = rowIndex < 2;
            return (
              <Link
                key={r.teamId}
                href={`/team/${club.id}`}
                className={`group grid gap-3 border-b border-[var(--line)] py-4 last:border-0 md:grid-cols-[minmax(12rem,1fr)_4rem_4rem_4rem_minmax(9rem,0.72fr)] md:items-center ${
                  inCut ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-caption tabular w-5">{rowIndex + 1}</span>
                  <Crest
                    short={club.short}
                    primary={club.primary}
                    secondary={club.secondary}
                    name={club.name}
                    size={30}
                  />
                  <span className="text-title truncate transition-colors duration-300 group-hover:text-[var(--ink)]">
                    {club.name}
                  </span>
                  {inCut && (
                    <span className="h-px w-8 shrink-0" style={{ background: "var(--group-signal)" }} />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 md:contents">
                  <div className="md:text-right">
                    <span className="text-caption md:hidden">P </span>
                    <span className="text-label tabular">{r.played}</span>
                  </div>
                  <div className="md:text-right">
                    <span className="text-caption md:hidden">GD </span>
                    <span className="text-label tabular">
                      {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                    </span>
                  </div>
                  <div className="md:text-right">
                    <span className="text-caption md:hidden">Pts </span>
                    <span className="text-display tabular text-2xl">{r.pts}</span>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-3 md:justify-end">
                    <span className="text-caption md:hidden">Advance</span>
                    <span className="text-label tabular">
                      <NumberTicker value={adv * 100} suffix="%" decimals={1} />
                    </span>
                  </div>
                  <div className="h-1 bg-[var(--neutral-fill)]">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max((adv / maxAdv) * 100, 2)}%`,
                        background: `linear-gradient(90deg, ${kitAccent(club.primary, "up")}, var(--group-signal))`,
                      }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GroupsBoard({ clubs }: { clubs: Club[] }) {
  return (
    <DataPlane className="overflow-hidden">
      <div className="grid gap-8 border-b border-[var(--line)] pb-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div>
          <p className="text-label">Qualification matrix</p>
          <h2 className="text-display mt-3">Twelve groups. One knockout gate.</h2>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div>
            <p className="text-caption">Groups</p>
            <p className="text-display tabular text-3xl">{GROUPS.length}</p>
          </div>
          <div>
            <p className="text-caption">Teams</p>
            <p className="text-display tabular text-3xl">{clubs.length}</p>
          </div>
          <div>
            <p className="text-caption">Advance</p>
            <p className="text-display tabular text-3xl">24</p>
          </div>
        </div>
      </div>

      <div>
        {GROUPS.map((g, index) => (
          <GroupBand key={g} letter={g} clubs={clubs} index={index} />
        ))}
      </div>
    </DataPlane>
  );
}

export default function GroupsPage() {
  const clubs = allClubs();
  const runs = (simulation as { runMeta: { runs: number } }).runMeta.runs;
  return (
    <WCS26Shell
      route="groups"
      title="Group Tables"
      rail={
        <SignalLine
          signals={[
            { label: "Groups", value: GROUPS.length, detail: "four-team pools" },
            { label: "Teams", value: clubs.length, detail: "qualified field" },
            { label: "Runs", value: runs, detail: "advance probability" },
          ]}
        />
      }
    >
      <RouteStack>
        <CanvasSection eyebrow="Standings" title="Executive group matrix.">
          <GroupsBoard clubs={clubs} />
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
