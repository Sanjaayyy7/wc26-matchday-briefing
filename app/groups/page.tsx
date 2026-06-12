import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { allClubs, fixturesByGroup, type Club } from "@/lib/data";
import { groupStandings } from "@/lib/standings";
import simulation from "@/data/simulation.json";

export const metadata = { title: "Groups — Matchday Briefing" };

const GROUPS = "ABCDEFGHIJKL".split("");

function GroupCard({ letter, clubs }: { letter: string; clubs: Club[] }) {
  const members = clubs.filter((c) => c.group === letter);
  const rows = groupStandings(
    members.map((c) => c.id),
    fixturesByGroup(letter),
  );
  const byId = new Map(members.map((c) => [c.id, c]));
  const sim = (simulation as { teams: Record<string, { advanceGroup: number }> }).teams;
  return (
    <section className="rounded-2xl bg-[var(--surface)] p-5 dark:border dark:border-[var(--hairline)]">
      <h2 className="text-label mb-4">Group {letter}</h2>
      <table className="w-full text-[14px]">
        <thead>
          <tr className="text-caption text-left">
            <th className="pb-2 font-normal">Team</th>
            <th className="pb-2 text-center font-normal">P</th>
            <th className="pb-2 text-center font-normal">GD</th>
            <th className="pb-2 text-center font-normal">Pts</th>
            <th className="pb-2 text-right font-normal">Adv %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const club = byId.get(r.teamId)!;
            const adv = sim[club.datasetName ?? club.name]?.advanceGroup;
            return (
              <tr
                key={r.teamId}
                className={i < 2 ? "" : "text-[var(--ink-muted)]"}
              >
                <td className="py-1.5">
                  <Link
                    href={`/team/${club.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: club.primary }}
                      aria-hidden
                    />
                    {club.name}
                  </Link>
                </td>
                <td className="tabular py-1.5 text-center">{r.played}</td>
                <td className="tabular py-1.5 text-center">
                  {r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}
                </td>
                <td className="tabular py-1.5 text-center font-semibold">{r.pts}</td>
                <td className="tabular py-1.5 text-right">
                  {adv !== undefined ? `${Math.round(adv * 100)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default function GroupsPage() {
  const clubs = allClubs();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-6 py-12">
        <div>
          <h1 className="text-title text-2xl">Groups</h1>
          <p className="text-caption mt-1">
            Live standings (FIFA tiebreak order) · advance probability from{" "}
            {(simulation as { runMeta: { runs: number } }).runMeta.runs.toLocaleString()}{" "}
            simulated tournaments
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <GroupCard key={g} letter={g} clubs={clubs} />
          ))}
        </div>
      </main>
    </>
  );
}
