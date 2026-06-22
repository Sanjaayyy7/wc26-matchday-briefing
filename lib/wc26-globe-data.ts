/**
 * Globe data layer: joins the 48 WC26 nations to their geographic coordinates
 * and to the public ledger, so the 3D globe can colour each nation by verdict.
 *
 * Reads the JSON datasets directly (not via the server-only `lib/data`) so this
 * module is safe to unit-test and to import from the server page that feeds the
 * client globe its serialisable props.
 */

import clubsJson from "@/data/clubs.json";
import fixturesJson from "@/data/fixtures.json";
import predictionsJson from "@/data/predictions.json";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";

export type GlobeVerdict = "hit" | "close" | "miss" | "locked";

export type GlobeNation = {
  id: string;
  short: string;
  name: string;
  lat: number;
  lon: number;
  verdict: GlobeVerdict;
  host: boolean;
  leadingEdge: boolean;
  /** Marker size tier: 3 = host, 2 = top seed, 1 = other. */
  weight: number;
  /** Click-through target in the ledger, when one exists. */
  slug?: string;
  /** Hover line: settled scoreline, or the next locked tie. */
  record: string;
};

const HOSTS = new Set(["usa", "can", "mex"]);
/** Top-seeded contenders get a slightly larger marker than the field. */
const TOP_SEEDS = new Set(["bra", "arg", "fra", "esp", "eng", "ger", "por", "ned"]);

/** Country centroids (approximate) for every confirmed/projected 2026 nation. */
const NATION_COORDS: Record<string, [number, number]> = {
  alg: [28, 3], arg: [-38, -63], aus: [-25, 134], aut: [47.6, 14.2],
  bel: [50.6, 4.5], bih: [44, 18], bra: [-10, -52], can: [56, -106],
  civ: [7.5, -5.5], cod: [-2.5, 23], col: [4, -73], cpv: [16, -24],
  cro: [45.1, 15.2], cur: [12.2, -69], cze: [49.8, 15.5], ecu: [-1.5, -78],
  egy: [26.8, 30], eng: [52.5, -1.5], esp: [40, -3.7], fra: [46.6, 2.2],
  ger: [51.2, 10.4], gha: [7.9, -1], hai: [19, -72.3], irn: [32, 53],
  irq: [33, 44], jor: [31, 36], jpn: [36, 138], kor: [36.5, 127.8],
  ksa: [24, 45], mar: [32, -6], mex: [23, -102], ned: [52.1, 5.3],
  nor: [61, 9], nzl: [-41, 174], pan: [8.5, -80], par: [-23.4, -58],
  por: [39.5, -8], qat: [25.3, 51.2], rsa: [-29, 24], sco: [56.5, -4],
  sen: [14.5, -14.5], sui: [46.8, 8.2], swe: [62, 15], tun: [34, 9],
  tur: [39, 35], uru: [-33, -56], usa: [39.8, -98.6], uzb: [41.4, 64.6],
};

type ClubLite = { id: string; short: string; name: string; group?: string };
type FixtureLite = { slug: string; homeId: string; awayId: string; kickoffISO: string };
type EntryLite = { slug: string; result?: string };
type RowLite = { slug: string; verdict: GlobeVerdict };

const clubs = clubsJson as ClubLite[];
const fixtures = fixturesJson as FixtureLite[];
const entries = (predictionsJson as { entries: EntryLite[] }).entries;
const rows = (accountabilityJson as { official: { rows: RowLite[] } }).official.rows;

/** Build the per-nation globe markers for a given reference time. */
export function buildGlobeNations(now: Date = new Date()): GlobeNation[] {
  const shortById = new Map(clubs.map((c) => [c.id, c.short]));
  const verdictBySlug = new Map(rows.map((r) => [r.slug, r.verdict] as const));
  const resultBySlug = new Map(entries.map((e) => [e.slug, e.result] as const));

  // The leading edge: earliest unsettled fixture still ahead of `now`.
  const leadingFixture = fixtures
    .filter((f) => !verdictBySlug.has(f.slug) && new Date(f.kickoffISO).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime())[0];
  const leadingIds = new Set(
    leadingFixture ? [leadingFixture.homeId, leadingFixture.awayId] : [],
  );

  const score = (f: FixtureLite) => {
    const r = resultBySlug.get(f.slug);
    const h = shortById.get(f.homeId) ?? "?";
    const a = shortById.get(f.awayId) ?? "?";
    return r ? `${h} ${r.replace("-", "–")} ${a}` : `${h} vs ${a}`;
  };

  return clubs
    .filter((c) => c.group && NATION_COORDS[c.id])
    .map((c) => {
      const [lat, lon] = NATION_COORDS[c.id];
      const mine = fixtures.filter((f) => f.homeId === c.id || f.awayId === c.id);
      const settled = mine
        .filter((f) => verdictBySlug.has(f.slug))
        .sort((a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime());

      let verdict: GlobeVerdict = "locked";
      let slug: string | undefined;
      let record: string;

      if (settled.length > 0) {
        const latest = settled[0];
        verdict = verdictBySlug.get(latest.slug) ?? "locked";
        slug = latest.slug;
        record = score(latest);
      } else {
        const next = mine
          .filter((f) => new Date(f.kickoffISO).getTime() >= now.getTime())
          .sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime())[0];
        const ref = next ?? mine[0];
        slug = ref?.slug;
        record = ref ? `Locked · ${score(ref)}` : "Awaiting fixture";
      }

      return {
        id: c.id,
        short: c.short,
        name: c.name,
        lat,
        lon,
        verdict,
        host: HOSTS.has(c.id),
        leadingEdge: leadingIds.has(c.id),
        weight: HOSTS.has(c.id) ? 3 : TOP_SEEDS.has(c.id) ? 2 : 1,
        slug,
        record,
      };
    });
}
