import { MatchMarketLine } from "./cinematic";
import type { MatchRowData } from "@/lib/match-view";

export function MatchRow({ m }: { m: MatchRowData }) {
  return <MatchMarketLine row={m} />;
}
