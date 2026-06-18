/**
 * Data provenance — enforces the repo's "fetch-don't-recall" invariant.
 *
 * Every row written to a generated data file must carry a `_prov` object so
 * its origin is auditable: `verified` (pulled live from a cited URL this run),
 * `derived` (computed from verified rows — cite the inputs), or `seeded`
 * (a low-confidence demo placeholder that the UI must label, never present as
 * real). Build steps call `assertProvenance` on every row before writing;
 * a missing or invalid provenance fails the build.
 */
export type OriginType = "verified" | "derived" | "seeded";

export interface Provenance {
  /** URL for verified/derived rows; "seed:<note>" for seeded rows. */
  source: string;
  /** 0..1 confidence in the value. Seeded rows are capped at 0.3. */
  confidence: number;
  /** ISO date the source was fetched or checked. */
  verificationDate: string;
  originType: OriginType;
}

export interface Provenanced {
  _prov?: Provenance;
}

export function assertProvenance(row: Provenanced): void {
  if (!row._prov) {
    throw new Error("provenance missing — fetch-don't-recall violation");
  }
  if (row._prov.originType === "seeded" && row._prov.confidence > 0.3) {
    throw new Error("seeded rows must have confidence <= 0.3");
  }
}
