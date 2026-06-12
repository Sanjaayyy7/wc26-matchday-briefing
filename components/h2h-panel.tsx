export type H2HRecord = {
  teamA: string;
  teamB: string;
  played: number;
  aWins: number;
  bWins: number;
  draws: number;
  lastDate: string;
  lastScore: string;
  lastHome: string;
};

export function H2HPanel({
  record,
  homeName,
  awayName,
}: {
  record: H2HRecord | null;
  homeName: string;
  awayName: string;
}) {
  if (!record) {
    return (
      <p className="text-[15px] text-[var(--ink-muted)]">
        These two have never met in the dataset (1872 → today). First time for
        everything.
      </p>
    );
  }
  // Express wins from the fixture's home-team perspective.
  const homeIsA = record.teamA === homeName || record.teamA.includes(homeName);
  const homeWins = homeIsA ? record.aWins : record.bWins;
  const awayWins = homeIsA ? record.bWins : record.aWins;
  const total = record.played;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 text-center">
        <div>
          <div className="tabular text-[24px] font-bold">{homeWins}</div>
          <div className="text-caption">{homeName} wins</div>
        </div>
        <div>
          <div className="tabular text-[24px] font-bold text-[var(--ink-muted)]">
            {record.draws}
          </div>
          <div className="text-caption">draws</div>
        </div>
        <div>
          <div className="tabular text-[24px] font-bold">{awayWins}</div>
          <div className="text-caption">{awayName} wins</div>
        </div>
      </div>
      <div className="flex h-2 w-full gap-px overflow-hidden rounded-full">
        <div style={{ width: seg(homeWins), background: "var(--up)" }} />
        <div style={{ width: seg(record.draws), background: "var(--neutral-fill)" }} />
        <div style={{ width: seg(awayWins), background: "var(--down)" }} />
      </div>
      <p className="text-caption">
        {total} meetings since records began · last: {record.lastScore} (
        {record.lastHome} at home, {record.lastDate})
      </p>
    </div>
  );
}
