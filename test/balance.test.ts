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
    // Temperament is ignored by createMatch (class-derived); kept for HeroLoadout shape.
    temperament: partial.temperament ?? "guardian",
    perks: partial.perks ?? [],
    permStats: partial.permStats ?? perm(0, 0, 0, 0, 0),
  };
}

function summarizeCohort(label: string, hero: HeroLoadout): CohortSummary {
  const observations = JUDGMENT_SEEDS.map((seed) => observeRun(hero, seed));
  const survivalCount = observations.filter((entry) => entry.survived).length;
  const medianSurvivedSeconds = median(observations.map((entry) => entry.survivedSeconds));
  // Mid-run death band retained as a coarse mortality distribution signal.
  const countInDeathWindow = observations.filter(
    (entry) => entry.survivedSeconds >= 45 && entry.survivedSeconds <= 120,
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

// --- Loadouts under calibration (Traits v3 class-valid perks) ---

const freshLoadout = loadout({
  classId: "knight",
  temperament: "guardian",
  perks: [],
  permStats: perm(0, 0, 0, 0, 0),
});

/** Nested 0/3/6/9/12/15 permanent rank path (Knight / Guardian). */
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
  temperament: "guardian",
  perks: [],
  permStats: perm(3, 3, 3, 3, 3),
});

/** Knight T2 aggressive branch: Charge Instinct + Frenzy. */
const knightT2ALoadout = loadout({
  classId: "knight",
  temperament: "guardian",
  perks: ["knightChargeInstinct", "knightFrenzy"],
  permStats: perm(3, 2, 1, 1, 1),
});

/** Knight T2 defensive branch: Bulwark + Shield Stance. */
const knightT2BLoadout = loadout({
  classId: "knight",
  temperament: "guardian",
  perks: ["knightBulwark", "knightShieldStance"],
  permStats: perm(3, 2, 1, 1, 1),
});

/** Priest T2 retreat branch: Quick Retreat + Fortify Retreat. */
const priestT2BLoadout = loadout({
  classId: "priest",
  temperament: "survivor",
  perks: ["priestQuickRetreat", "priestFortifyRetreat"],
  permStats: perm(5, 5, 2, 2, 1),
});

// Compute all judgment cohorts once; every test shares these observations.
const freshCohort = summarizeCohort("fresh", freshLoadout);

const progressionCohorts = progressionRanks.map(({ label, ranks }) =>
  summarizeCohort(
    label,
    loadout({
      classId: "knight",
      temperament: "guardian",
      perks: [],
      permStats: ranks,
    }),
  ),
);

const knightInvestedCohorts = [
  summarizeCohort("balanced15", balanced15Loadout),
  summarizeCohort("knightT2A", knightT2ALoadout),
  summarizeCohort("knightT2B", knightT2BLoadout),
] as const;

const priestInvestedCohort = summarizeCohort("priestT2B", priestT2BLoadout);

describe("balance calibration (judgment seeds 10000..10039)", () => {
  it("fresh Knight/Guardian/perm0 remains mortal but reaches the mid-run", () => {
    // W1/W2 movement restores the pre-weapon-split progression target: a fresh
    // player sees the mid-run, but still cannot clear the arena without investment.
    expect(freshCohort.survivalCount).toBe(0);
    expect(freshCohort.medianSurvivedSeconds).toBeGreaterThanOrEqual(90);
    expect(freshCohort.medianSurvivedSeconds).toBeLessThanOrEqual(125);
    expect(freshCohort.countInDeathWindow).toBeGreaterThanOrEqual(28);
  });

  it("nested permanent ranks avoid material regressions and gain ≥60s in total", () => {
    // Guardian pathing is deterministic but nonlinear: a speed rank can alter encounters enough
    // to move one 40-seed median slightly backward. Keep a bounded local dip plus total-gain gate.
    const medians = progressionCohorts.map((cohort) => cohort.medianSurvivedSeconds);
    let nonDecreasingSteps = 0;

    for (let index = 1; index < medians.length; index += 1) {
      const previous = medians[index - 1]!;
      const current = medians[index]!;
      if (current >= previous) {
        nonDecreasingSteps += 1;
      }
      expect(
        current,
        `${progressionCohorts[index]!.label} median ${current} should stay within 15s of ${progressionCohorts[index - 1]!.label} median ${previous}`,
      ).toBeGreaterThanOrEqual(previous - 15);
    }

    expect(nonDecreasingSteps).toBeGreaterThanOrEqual(4);
    const totalGain = medians[medians.length - 1]! - medians[0]!;
    expect(totalGain, `rank15−rank0 median gain ${totalGain}`).toBeGreaterThanOrEqual(60);
  });

  it("15-rank guardian knight usually clears without becoming guaranteed", () => {
    const rank15 = progressionCohorts[progressionCohorts.length - 1]!;
    expect(rank15.survivalCount).toBeGreaterThanOrEqual(24);
    expect(rank15.survivalCount).toBeLessThanOrEqual(39);
    expect(rank15.medianSurvivedSeconds).toBeGreaterThanOrEqual(170);
  });

  it.each(knightInvestedCohorts.map((cohort) => [cohort.label, cohort] as const))(
    "%s: knight invested build stays viable without a guaranteed clear",
    (_label, cohort) => {
      expect(cohort.survivalCount).toBeGreaterThanOrEqual(5);
      expect(cohort.survivalCount).toBeLessThanOrEqual(39);
      expect(cohort.medianSurvivedSeconds).toBeGreaterThanOrEqual(120);
      expect(cohort.medianSurvivedSeconds).toBeLessThanOrEqual(180);
    },
  );

  it("priestT2B: survivor identity remains the durable invested class", () => {
    // Priest keeps survivor temperament; still the strongest invested survivor among these cohorts.
    expect(priestInvestedCohort.survivalCount).toBeGreaterThanOrEqual(15);
    expect(priestInvestedCohort.survivalCount).toBeLessThanOrEqual(35);
    expect(priestInvestedCohort.medianSurvivedSeconds).toBeGreaterThanOrEqual(160);
    expect(priestInvestedCohort.survivorMedianHpRatio).not.toBeNull();
    expect(priestInvestedCohort.survivorMedianHpRatio!).toBeGreaterThanOrEqual(0.05);
    expect(priestInvestedCohort.survivorMedianHpRatio!).toBeLessThanOrEqual(0.9);
  });
});

/** Exposed for the final 120-seed matrix script / report (not a test). */
export const balanceJudgmentSnapshot = {
  seeds: JUDGMENT_SEEDS,
  fresh: freshCohort,
  progression: progressionCohorts,
  invested: [...knightInvestedCohorts, priestInvestedCohort],
};
