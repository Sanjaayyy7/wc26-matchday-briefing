// Compatibility wrapper for existing consumers. Canonical shaping lives in
// match-view so pages/components share one settled/locked/informational model.
import { allMatchViews, buildMatchView, matchViewToRow } from "./match-view";
import type { Fixture } from "./data";
import type { MatchRowData } from "./match-view";

export function buildMatchRow(fixture: Fixture): MatchRowData {
  return matchViewToRow(buildMatchView(fixture));
}

export function allMatchRows(): MatchRowData[] {
  return allMatchViews().map(matchViewToRow);
}

export type { MatchRowData };
