export type NamedLoadout = {
  readonly name: string;
};

export type ResultScoreInput = {
  readonly score: unknown;
  readonly kills: unknown;
  readonly timeMs: unknown;
};

export type SaneResultScore = {
  readonly score: number;
  readonly kills: number;
  readonly timeMs: number;
};

export function loadoutBlobKey(name: string): string {
  return `loadouts/${encodeURIComponent(name)}.json`;
}

export function selectUniqueByName<T extends NamedLoadout>(
  candidates: readonly T[],
  excludeName: string,
  limit: number,
): readonly T[] {
  const selected: T[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }
    if (candidate.name === excludeName || seen.has(candidate.name)) {
      continue;
    }
    seen.add(candidate.name);
    selected.push(candidate);
  }
  return selected;
}

export function isResultScoreSane(value: ResultScoreInput): value is SaneResultScore {
  return (
    isIntegerInRange(value.score, 0, 1_000_000) &&
    isIntegerInRange(value.kills, 0, 100_000) &&
    isIntegerInRange(value.timeMs, 0, 600_000)
  );
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
