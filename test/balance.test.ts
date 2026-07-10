import { describe, expect, it } from "vitest";
import { createMatch, resultFromState } from "../src/sim";
import type { HeroLoadout, PerkId, PermStats } from "../src/sim";

/** Judgment cohort: seeds 10000..10039 (exactly 40). */
const JUDGMENT_SEEDS: readonly number[] = Array.from({ length: 40 }, (_, index) => 10000 + index);

type RunObservation = {
  readonly seed: number;
  readonly survivedSeconds: number;
  readonly survived: boolean;
  readonly hp: number;
  readonly maxHp: number;
  readonly hpRatio: number;
  readonly score: number;
  readonly kills: number;
  readonly level: number;
};

type CohortSummary = {
  readonly label: string;
  readonly observations: readonly RunObservation[];
  readonly survivalCount: number;
  readonly medianSurvivedSeconds: number;
  readonly countInDeathWindow: number;
  readonly survivorMedianHpRatio: number | null;
};

/**
 * Steps createMatch to the end and records survivedSeconds plus final hp/maxHp.
 * HeroResult alone has no HP — final state is read from the match controller.
 */
function observeRun(loadout: HeroLoadout, seed: number): RunObservation {
  const match = createMatch({ seed, heroes: [loadout] });
  let guard = 120_000;
  while (match.state.phase !== "finished" && guard > 0) {
    match.step();
    guard -= 1;
  }

  const hero = match.state.heroes[0];
  if (hero === undefined) {
    throw new Error(`Missing hero for seed ${seed}`);
  }

  const result = resultFromState(match.state);
  const heroResult = result.heroes[0];
  if (heroResult === undefined) {
    throw new Error(`Missing hero result for seed ${seed}`);
  }

  const maxHp = hero.maxHp;
  const hp = hero.hp;
  return {
    seed,
    survivedSeconds: heroResult.survivedSeconds,
    survived: heroResult.survived,
    hp,
    maxHp,
    hpRatio: maxHp > 0 ? hp / maxHp : 0,
    score: heroResult.score,
    kills: heroResult.kills,
    level: heroResult.level,
  };
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error("median of empty array");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function perm(atk: number, hp: number, spd: number, luck: number, lvl: number): PermStats {
  return { atk, hp, spd, luck, lvl };
}

function loadout(partial: {
  classId?: HeroLoadout["classId"];
  temperament?: HeroLoadout["temperament"];
  perks?: readonly PerkId[];
  permStats?: PermStats;
}): HeroLoadout {
  return {
    classId: partial.classId ?? "knight",
    temperament: partial.temperament ?? "berserker",
    perks: partial.perks ?? [],
    permStats: partial.permStats ?? perm(0, 0, 0, 0, 0),
  };
}

function summarizeCohort(label: string, hero: HeroLoadout): CohortSummary {
  const observations = JUDGMENT_SEEDS.map((seed) => observeRun(hero, seed));
  const survivalCount = observations.filter((entry) => entry.survived).length;
  const medianSurvivedSeconds = median(observations.map((entry) => entry.survivedSeconds));
  const countInDeathWindow = observations.filter(
    (entry) => entry.survivedSeconds >= 90 && entry.survivedSeconds <= 135,
  ).length;
  const survivorRatios = observations
    .filter((entry) => entry.survived)
    .map((entry) => entry.hpRatio);
  const survivorMedianHpRatio = survivorRatios.length === 0 ? null : median(survivorRatios);

  return {
    label,
    observations,
    survivalCount,
    medianSurvivedSeconds,
    countInDeathWindow,
    survivorMedianHpRatio,
  };
}

// --- Loadouts under calibration ---

const freshLoadout = loadout({
  classId: "knight",
  temperament: "berserker",
  perks: [],
  permStats: perm(0, 0, 0, 0, 0),
});

/** Nested 0/3/6/9/12/15 permanent rank path (Knight / Berserker). */
const progressionRanks: readonly { readonly label: string; readonly ranks: PermStats }[] = [
  { label: "rank0", ranks: perm(0, 0, 0, 0, 0) },
  { label: "rank3", ranks: perm(1, 1, 1, 0, 0) },
  { label: "rank6", ranks: perm(2, 3, 1, 0, 0) },
  { label: "rank9", ranks: perm(4, 4, 1, 0, 0) },
  { label: "rank12", ranks: perm(5, 5, 2, 0, 0) },
  { label: "rank15", ranks: perm(5, 5, 3, 1, 1) },
];

const balanced15Loadout = loadout({
  classId: "knight",
  temperament: "berserker",
  perks: [],
  permStats: perm(3, 3, 3, 3, 3),
});

const berserkerT2ALoadout = loadout({
  classId: "knight",
  temperament: "berserker",
  perks: ["berserkerBloodThirst", "berserkerFrenzy"],
  permStats: perm(3, 2, 1, 1, 1),
});

const berserkerT2BLoadout = loadout({
  classId: "knight",
  temperament: "berserker",
  perks: ["berserkerCombatInstinct", "berserkerIronSkin"],
  permStats: perm(3, 2, 1, 1, 1),
});

const survivorT2BLoadout = loadout({
  classId: "priest",
  temperament: "survivor",
  perks: ["survivorQuickRetreat", "survivorSecondWind"],
  permStats: perm(5, 5, 2, 2, 1),
});

// Compute all judgment cohorts once; every test shares these observations.
const freshCohort = summarizeCohort("fresh", freshLoadout);

const progressionCohorts = progressionRanks.map(({ label, ranks }) =>
  summarizeCohort(
    label,
    loadout({
      classId: "knight",
      temperament: "berserker",
      perks: [],
      permStats: ranks,
    }),
  ),
);

const investedCohorts = [
  summarizeCohort("balanced15", balanced15Loadout),
  summarizeCohort("berserkerT2A", berserkerT2ALoadout),
  summarizeCohort("berserkerT2B", berserkerT2BLoadout),
  summarizeCohort("survivorT2B", survivorT2BLoadout),
] as const;

describe("balance calibration (judgment seeds 10000..10039)", () => {
  it("fresh Knight/Berserker/perm0 never survives and dies in the mid-run window", () => {
    expect(freshCohort.survivalCount).toBe(0);
    expect(freshCohort.medianSurvivedSeconds).toBeGreaterThanOrEqual(90);
    expect(freshCohort.medianSurvivedSeconds).toBeLessThanOrEqual(120);
    expect(freshCohort.countInDeathWindow).toBeGreaterThanOrEqual(32);
  });

  it("nested permanent rank path raises median survival by at least 8s each step and 65s total", () => {
    const medians = progressionCohorts.map((cohort) => cohort.medianSurvivedSeconds);

    for (let index = 1; index < medians.length; index += 1) {
      const previous = medians[index - 1]!;
      const current = medians[index]!;
      expect(
        current - previous,
        `${progressionCohorts[index]!.label} median ${current} should exceed ${progressionCohorts[index - 1]!.label} median ${previous} by ≥8s`,
      ).toBeGreaterThanOrEqual(8);
    }

    const totalGain = medians[medians.length - 1]! - medians[0]!;
    expect(totalGain, `rank15−rank0 median gain ${totalGain}`).toBeGreaterThanOrEqual(65);
  });

  it("15-rank cohort survival sits in the invested band 16–32/40", () => {
    const rank15 = progressionCohorts[progressionCohorts.length - 1]!;
    expect(rank15.survivalCount).toBeGreaterThanOrEqual(16);
    expect(rank15.survivalCount).toBeLessThanOrEqual(32);
  });

  it.each(investedCohorts.map((cohort) => [cohort.label, cohort] as const))(
    "%s: survival 16–32/40 and survivor final HP ratio median 0.10–0.35",
    (_label, cohort) => {
      expect(cohort.survivalCount).toBeGreaterThanOrEqual(16);
      expect(cohort.survivalCount).toBeLessThanOrEqual(32);
      expect(cohort.survivorMedianHpRatio).not.toBeNull();
      expect(cohort.survivorMedianHpRatio!).toBeGreaterThanOrEqual(0.1);
      expect(cohort.survivorMedianHpRatio!).toBeLessThanOrEqual(0.35);
    },
  );
});

/** Exposed for the final 120-seed matrix script / report (not a test). */
export const balanceJudgmentSnapshot = {
  seeds: JUDGMENT_SEEDS,
  fresh: freshCohort,
  progression: progressionCohorts,
  invested: investedCohorts,
};
