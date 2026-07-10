import { heroClassIds } from "./data";
import { assertNever } from "./math";
import type { HeroClassId, PerkChoice, PerkEffect, PerkId, PerkTier } from "./types";

export type PerkDefinition = {
  readonly id: PerkId;
  readonly tier: PerkTier;
  readonly choice: PerkChoice;
  readonly name: string;
  /** Human-readable card text for UI. */
  readonly effect: string;
  /** Structured effects — pure data over the standardized schema. */
  readonly effects: readonly PerkEffect[];
  /** True when the node changes AI / decision / movement rules, not only numeric stats. */
  readonly changesBehavior: boolean;
};

/** Roster v3 unlock costs per tier (per class). */
export const perkCosts: Record<PerkTier, number> = {
  1: 150,
  2: 350,
  3: 600,
  4: 900,
  5: 1300,
};

/**
 * Roster v3 specialization trees: 5 tiers × pick-1-of-2 × 11 classes = 110 nodes.
 * Each tier: sharpen (a, maximize strength) vs round (b, partial weakness offset, capped).
 * At least one changesBehavior node per tier (behaviorRule or behavior-affecting trigger).
 */
export const perkDefinitions: Record<HeroClassId, readonly PerkDefinition[]> = {
  fighter: [
    {
      id: "fighterSteelForm",
      tier: 1,
      choice: "a",
      name: "Steel Form",
      effect: "Weapon damage +10%.",
      changesBehavior: false,
      effects: [
          { kind: "statMod", stat: "atk", pct: 0.1 },
      ],
    },
    {
      id: "fighterGuardDrill",
      tier: 1,
      choice: "b",
      name: "Guard Drill",
      effect: "Max HP +8% (caps soft edge).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
          { kind: "statMod", stat: "hp", pct: 0.08 },
      ],
    },
    {
      id: "fighterPress",
      tier: 2,
      choice: "a",
      name: "Press the Line",
      effect: "Combat-lock: ignore loot within 200px of enemies.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock" },
      ],
    },
    {
      id: "fighterHold",
      tier: 2,
      choice: "b",
      name: "Hold Ground",
      effect: "Late flee / hold ground (guardian graft).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
      ],
    },
    {
      id: "fighterSweepMastery",
      tier: 3,
      choice: "a",
      name: "Sweep Mastery",
      effect: "Sword Sweep damage +18%.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "swordSweep", dmgPct: 0.18 },
      ],
    },
    {
      id: "fighterTempo",
      tier: 3,
      choice: "b",
      name: "Field Dressing",
      effect: "Max HP +6 flat and earlier retreat (small no-tricks round).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", flat: 6 },
      ],
    },
    {
      id: "fighterBloodPrice",
      tier: 4,
      choice: "a",
      name: "Blood Price",
      effect: "Below 35% HP: damage +20%.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "hpBelow", threshold: 0.35, effect: { kind: "statMod", stat: "atk", pct: 0.2 } },
      ],
    },
    {
      id: "fighterSecondWind",
      tier: 4,
      choice: "b",
      name: "Second Wind",
      effect: "On level-up: temporary max HP +10%.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "trigger", when: "onLevelUp", effect: { kind: "statMod", stat: "hp", pct: 0.1 } },
      ],
    },
    {
      id: "fighterWarMaster",
      tier: 5,
      choice: "a",
      name: "War Master",
      effect: "All weapons +12% damage (peak reliability).",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "all", dmgPct: 0.12 },
      ],
    },
    {
      id: "fighterIronReserves",
      tier: 5,
      choice: "b",
      name: "Iron Reserves",
      effect: "Max HP +12% (round, still no tricks).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", pct: 0.12 },
      ],
    },
  ],
  knight: [
    {
      id: "knightBulwark",
      tier: 1,
      choice: "a",
      name: "Bulwark",
      effect: "Contact damage taken −12.5%.",
      changesBehavior: false,
      effects: [
          { kind: "statMod", stat: "hp", pct: 0.08 },
      ],
    },
    {
      id: "knightChargeInstinct",
      tier: 1,
      choice: "b",
      name: "Weapon Drill",
      effect: "All weapons +4% with soft combat focus (small low-ATK round).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock", params: { soft: 1 } },
          { kind: "weaponMod", weapon: "all", dmgPct: 0.04 },
      ],
    },
    {
      id: "knightFrenzy",
      tier: 2,
      choice: "a",
      name: "Frenzy",
      effect: "Damage +25% below 35% HP.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "hpBelow", threshold: 0.35, effect: { kind: "statMod", stat: "atk", pct: 0.25 } },
      ],
    },
    {
      id: "knightShieldStance",
      tier: 2,
      choice: "b",
      name: "Hasty Stance",
      effect: "Speed +4% and earlier retreat (small slow-foot round).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "spd", pct: 0.04 },
      ],
    },
    {
      id: "knightSlaughterer",
      tier: 3,
      choice: "a",
      name: "Slaughterer",
      effect: "Elite kills reset all weapon cooldowns.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "onEliteKill", effect: { kind: "weaponMod", weapon: "all", cdPct: -1 } },
      ],
    },
    {
      id: "knightHoldTheLine",
      tier: 3,
      choice: "b",
      name: "Riposte Drill",
      effect: "All weapons +8% with combat focus (round low ATK, still weakest tier).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock", params: { soft: 1 } },
          { kind: "weaponMod", weapon: "all", dmgPct: 0.08 },
      ],
    },
    {
      id: "knightAegis",
      tier: 4,
      choice: "a",
      name: "Aegis Pulse",
      effect: "Below 40% HP: max HP effective +10%.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "hpBelow", threshold: 0.4, effect: { kind: "statMod", stat: "hp", pct: 0.1 } },
      ],
    },
    {
      id: "knightMeasuredSwing",
      tier: 4,
      choice: "b",
      name: "Measured Swing",
      effect: "Sword Sweep / Shield Bash +12% dmg (soft ATK round).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
          { kind: "weaponMod", weapon: "swordSweep", dmgPct: 0.12 },
          { kind: "weaponMod", weapon: "shieldBash", dmgPct: 0.12 },
      ],
    },
    {
      id: "knightImmovable",
      tier: 5,
      choice: "a",
      name: "Immovable",
      effect: "Max HP +15%, signature bulwark amplified.",
      changesBehavior: false,
      effects: [
          { kind: "statMod", stat: "hp", pct: 0.15 },
          { kind: "signatureMod", pct: 0.2 },
      ],
    },
    {
      id: "knightCounterweight",
      tier: 5,
      choice: "b",
      name: "Counterweight",
      effect: "ATK +10% (round of lowest-ATK, capped).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "atk", pct: 0.1 },
      ],
    },
  ],
  berserker: [
    {
      id: "berserkerBloodThirst",
      tier: 1,
      choice: "a",
      name: "Blood Thirst",
      effect: "Kill healing +0.1 before fatigue, +0.2 after.",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.15 },
      ],
    },
    {
      id: "berserkerClosingIn",
      tier: 1,
      choice: "b",
      name: "Scarred Instinct",
      effect: "Max HP +6% and earlier retreat (small glass-jaw round).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", pct: 0.06 },
      ],
    },
    {
      id: "berserkerFrenzy",
      tier: 2,
      choice: "a",
      name: "Frenzy",
      effect: "Damage +25% below 35% HP.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "hpBelow", threshold: 0.35, effect: { kind: "statMod", stat: "atk", pct: 0.25 } },
      ],
    },
    {
      id: "berserkerDesperateCharge",
      tier: 2,
      choice: "b",
      name: "Reckless Guard",
      effect: "Max HP +8% and earlier retreat (round, never Survivor-grade).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", pct: 0.08 },
      ],
    },
    {
      id: "berserkerSlaughterer",
      tier: 3,
      choice: "a",
      name: "Slaughterer",
      effect: "Elite kills reset weapon cooldowns.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "onEliteKill", effect: { kind: "weaponMod", weapon: "all", cdPct: -1 } },
      ],
    },
    {
      id: "berserkerUndyingRage",
      tier: 3,
      choice: "b",
      name: "Undying Rage",
      effect: "Survive one lethal blow at 1 HP.",
      changesBehavior: true,
      effects: [
          { kind: "signatureMod", pct: 0 },
      ],
    },
    {
      id: "berserkerWhirl",
      tier: 4,
      choice: "a",
      name: "Whirl Focus",
      effect: "Whirlwind Axe / Sword Sweep +15% dmg.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "whirlwindAxe", dmgPct: 0.15 },
          { kind: "weaponMod", weapon: "swordSweep", dmgPct: 0.15 },
      ],
    },
    {
      id: "berserkerCaution",
      tier: 4,
      choice: "b",
      name: "Blood Caution",
      effect: "Early flee graft at 50% (round, never survivor-grade).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
      ],
    },
    {
      id: "berserkerBloodhowl",
      tier: 5,
      choice: "a",
      name: "Bloodhowl",
      effect: "Signature kill-heal +25%.",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.25 },
      ],
    },
    {
      id: "berserkerThickHide",
      tier: 5,
      choice: "b",
      name: "Thick Hide",
      effect: "Max HP +12% (round glass jaw, capped).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", pct: 0.12 },
      ],
    },
  ],
  dwarf: [
    {
      id: "dwarfStout",
      tier: 1,
      choice: "a",
      name: "Stout Frame",
      effect: "Max HP +10%.",
      changesBehavior: false,
      effects: [
          { kind: "statMod", stat: "hp", pct: 0.1 },
      ],
    },
    {
      id: "dwarfQuickHands",
      tier: 1,
      choice: "b",
      name: "Quick Hands",
      effect: "All weapon cooldowns −8%.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
          { kind: "weaponMod", weapon: "all", cdPct: -0.08 },
      ],
    },
    {
      id: "dwarfTunnelVision",
      tier: 2,
      choice: "a",
      name: "Tunnel Vision",
      effect: "Combat-lock near enemies.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock" },
      ],
    },
    {
      id: "dwarfBrace",
      tier: 2,
      choice: "b",
      name: "Brace",
      effect: "Hold ground (late flee).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
      ],
    },
    {
      id: "dwarfQuake",
      tier: 3,
      choice: "a",
      name: "Quake Craft",
      effect: "Earth Shatter damage +20%.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "earthShatter", dmgPct: 0.2 },
      ],
    },
    {
      id: "dwarfReach",
      tier: 3,
      choice: "b",
      name: "Thrown Reach",
      effect: "Throwing Axe range fantasy: +12% dmg (round short reach).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "kiteBand" },
          { kind: "weaponMod", weapon: "throwingAxe", dmgPct: 0.12 },
      ],
    },
    {
      id: "dwarfOnKillTempo",
      tier: 4,
      choice: "a",
      name: "On-Kill Tempo",
      effect: "On kill: weapon CD −5% effective.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "onKill", effect: { kind: "weaponMod", weapon: "all", cdPct: -0.05 } },
      ],
    },
    {
      id: "dwarfStoneSkin",
      tier: 4,
      choice: "b",
      name: "Stone Skin",
      effect: "Below 40% HP: +10% HP pool feel.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
          { kind: "trigger", when: "hpBelow", threshold: 0.4, effect: { kind: "statMod", stat: "hp", pct: 0.1 } },
      ],
    },
    {
      id: "dwarfBedrock",
      tier: 5,
      choice: "a",
      name: "Bedrock",
      effect: "Signature small-hitbox fantasy amp + signatureMod.",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.25 },
          { kind: "statMod", stat: "hp", pct: 0.08 },
      ],
    },
    {
      id: "dwarfLongArm",
      tier: 5,
      choice: "b",
      name: "Long Arm",
      effect: "Crossbow/Throwing +15% (round, still not a ranger).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "kiteBand" },
          { kind: "weaponMod", weapon: "crossbowBolt", dmgPct: 0.15 },
          { kind: "weaponMod", weapon: "throwingAxe", dmgPct: 0.15 },
      ],
    },
  ],
  paladin: [
    {
      id: "paladinZeal",
      tier: 1,
      choice: "a",
      name: "Zeal",
      effect: "Holy Smash / Sword damage +10%.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "holySmash", dmgPct: 0.1 },
          { kind: "weaponMod", weapon: "swordSweep", dmgPct: 0.1 },
      ],
    },
    {
      id: "paladinWard",
      tier: 1,
      choice: "b",
      name: "Sacred Ward",
      effect: "Max HP +8%.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
          { kind: "statMod", stat: "hp", pct: 0.08 },
      ],
    },
    {
      id: "paladinJudgment",
      tier: 2,
      choice: "a",
      name: "Judgment",
      effect: "Graft combat-lock.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock" },
      ],
    },
    {
      id: "paladinVigil",
      tier: 2,
      choice: "b",
      name: "Vigil",
      effect: "Early-flee heal-bias pathing.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
      ],
    },
    {
      id: "paladinSmite",
      tier: 3,
      choice: "a",
      name: "Smite Craft",
      effect: "Holy Smash +18%, self-heal amp via signature.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "holySmash", dmgPct: 0.18 },
          { kind: "signatureMod", pct: 0.1 },
      ],
    },
    {
      id: "paladinMercy",
      tier: 3,
      choice: "b",
      name: "Mercy",
      effect: "Weak heal pulse strength +40% (still < Priest).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "signatureMod", pct: 0.4 },
      ],
    },
    {
      id: "paladinCrusade",
      tier: 4,
      choice: "a",
      name: "Crusade Trigger",
      effect: "On elite kill: all weapons + transient power.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "onEliteKill", effect: { kind: "statMod", stat: "atk", pct: 0.15 } },
      ],
    },
    {
      id: "paladinBastion",
      tier: 4,
      choice: "b",
      name: "Bastion",
      effect: "Below 40% HP: HP pool +12%.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
          { kind: "trigger", when: "hpBelow", threshold: 0.4, effect: { kind: "statMod", stat: "hp", pct: 0.12 } },
      ],
    },
    {
      id: "paladinCrusader",
      tier: 5,
      choice: "a",
      name: "Crusader",
      effect: "Holy burst on elite kill (signature capstone).",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "onEliteKill", effect: { kind: "weaponMod", weapon: "all", dmgPct: 0.2 } },
          { kind: "signatureMod", pct: 0.2 },
      ],
    },
    {
      id: "paladinSaint",
      tier: 5,
      choice: "b",
      name: "Saint",
      effect: "Heal pulse becomes stronger aura (+radius fantasy).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "signatureMod", pct: 0.35 },
          { kind: "statMod", stat: "magnet", flat: 20 },
      ],
    },
  ],
  mage: [
    {
      id: "mageEdgeStudy",
      tier: 1,
      choice: "a",
      name: "Edge Study",
      effect: "Owned weapon upgrade utility increases.",
      changesBehavior: false,
      effects: [
          { kind: "statMod", stat: "atk", pct: 0.08 },
      ],
    },
    {
      id: "mageMeasuredSteps",
      tier: 1,
      choice: "b",
      name: "Arcane Footing",
      effect: "Max HP +8 flat and earlier retreat (round, still lowest HP).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", flat: 8 },
      ],
    },
    {
      id: "mageSingleEdge",
      tier: 2,
      choice: "a",
      name: "Single Edge",
      effect: "Highest-level weapon damage +10%.",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.1 },
      ],
    },
    {
      id: "magePerfectDistance",
      tier: 2,
      choice: "b",
      name: "Ward Distance",
      effect: "Max HP +10 flat and earlier retreat (round fragility).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", flat: 10 },
      ],
    },
    {
      id: "mageExecutionForm",
      tier: 3,
      choice: "a",
      name: "Execution Form",
      effect: "Highest-level weapon cooldowns −12%.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "all", cdPct: -0.12 },
      ],
    },
    {
      id: "mageMastersChoice",
      tier: 3,
      choice: "b",
      name: "Split Study",
      effect: "Max HP +12 flat and earlier retreat (round fragility).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", flat: 12 },
      ],
    },
    {
      id: "mageMeteorCraft",
      tier: 4,
      choice: "a",
      name: "Meteor Craft",
      effect: "Meteor + Fire Bolt +15% dmg.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "meteor", dmgPct: 0.15 },
          { kind: "weaponMod", weapon: "fireBolt", dmgPct: 0.15 },
      ],
    },
    {
      id: "mageArcaneWard",
      tier: 4,
      choice: "b",
      name: "Arcane Ward",
      effect: "Max HP +18 flat (~40% soft-body round).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "kiteBand" },
          { kind: "statMod", stat: "hp", flat: 18 },
      ],
    },
    {
      id: "mageArchon",
      tier: 5,
      choice: "a",
      name: "Archon",
      effect: "Fire Bolt / Meteor +20% (peak artillery).",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "fireBolt", dmgPct: 0.2 },
          { kind: "weaponMod", weapon: "meteor", dmgPct: 0.2 },
          { kind: "signatureMod", pct: 0.15 },
      ],
    },
    {
      id: "mageGlassShield",
      tier: 5,
      choice: "b",
      name: "Glass Shield",
      effect: "Max HP +20 flat (round, still softest tier).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", flat: 20 },
      ],
    },
  ],
  priest: [
    {
      id: "priestWideEyes",
      tier: 1,
      choice: "a",
      name: "Wide Eyes",
      effect: "Danger detection radius gains another +0.25x.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
      ],
    },
    {
      id: "priestQuickRetreat",
      tier: 1,
      choice: "b",
      name: "Guided Bolt",
      effect: "Holy Bolt +4% and combat focus (small weak-weapon round).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock", params: { soft: 1 } },
          { kind: "weaponMod", weapon: "holyBolt", dmgPct: 0.04 },
      ],
    },
    {
      id: "priestLastLine",
      tier: 2,
      choice: "a",
      name: "Last Line",
      effect: "Contact damage −30% while HP below 50%.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "hpBelow", threshold: 0.5, effect: { kind: "statMod", stat: "hp", pct: 0.1 } },
      ],
    },
    {
      id: "priestFortifyRetreat",
      tier: 2,
      choice: "b",
      name: "Martial Prayer",
      effect: "All weapons +6% and soft combat focus (round weak damage).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock", params: { soft: 1 } },
          { kind: "weaponMod", weapon: "all", dmgPct: 0.06 },
      ],
    },
    {
      id: "priestOutlast",
      tier: 3,
      choice: "a",
      name: "Outlast",
      effect: "Survival-time score value gains another +0.2x.",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.2 },
      ],
    },
    {
      id: "priestSanctuary",
      tier: 3,
      choice: "b",
      name: "Consecrated Aim",
      effect: "All weapons +8% with a kite band (round weak damage).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock", params: { radius: 160 } },
      ],
    },
    {
      id: "priestRadiance",
      tier: 4,
      choice: "a",
      name: "Radiance",
      effect: "Radiant Burst / Holy Bolt +15%.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "radiantBurst", dmgPct: 0.15 },
          { kind: "weaponMod", weapon: "holyBolt", dmgPct: 0.15 },
      ],
    },
    {
      id: "priestSoftSmite",
      tier: 4,
      choice: "b",
      name: "Soft Smite",
      effect: "Weapon damage +10% (round weak weapons, capped).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock" },
          { kind: "statMod", stat: "atk", pct: 0.1 },
      ],
    },
    {
      id: "priestBeacon",
      tier: 5,
      choice: "a",
      name: "Beacon",
      effect: "Heal/signature +30% (outlast capstone).",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.3 },
          { kind: "weaponMod", weapon: "holyBolt", dmgPct: 0.1 },
      ],
    },
    {
      id: "priestWarPrayer",
      tier: 5,
      choice: "b",
      name: "War Prayer",
      effect: "All weapons +12% dmg (round, still not Mage).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock" },
          { kind: "weaponMod", weapon: "all", dmgPct: 0.12 },
      ],
    },
  ],
  warlock: [
    {
      id: "warlockPact",
      tier: 1,
      choice: "a",
      name: "Dark Pact",
      effect: "Lifesteal signature +25%.",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.25 },
      ],
    },
    {
      id: "warlockSiphon",
      tier: 1,
      choice: "b",
      name: "Siphon Ward",
      effect: "Max HP +6 flat and a kite band (round fragile body).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "kiteBand" },
          { kind: "statMod", stat: "hp", flat: 6 },
      ],
    },
    {
      id: "warlockHunger",
      tier: 2,
      choice: "a",
      name: "Hunger",
      effect: "Combat-lock (aggressive caster amp).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "combatLock" },
      ],
    },
    {
      id: "warlockKite",
      tier: 2,
      choice: "b",
      name: "Shadow Kite",
      effect: "Kite band graft (round fragility).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "kiteBand" },
      ],
    },
    {
      id: "warlockDrainCraft",
      tier: 3,
      choice: "a",
      name: "Drain Craft",
      effect: "Life Drain + Poison Flask +15%.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "lifeDrain", dmgPct: 0.15 },
          { kind: "weaponMod", weapon: "poisonFlask", dmgPct: 0.15 },
      ],
    },
    {
      id: "warlockVeil",
      tier: 3,
      choice: "b",
      name: "Veil",
      effect: "Max HP +10% (round soft body).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "kiteBand" },
          { kind: "statMod", stat: "hp", pct: 0.1 },
      ],
    },
    {
      id: "warlockOnKillDrain",
      tier: 4,
      choice: "a",
      name: "Kill Feast",
      effect: "On kill: signature lifesteal amp.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "onKill", effect: { kind: "signatureMod", pct: 0.1 } },
      ],
    },
    {
      id: "warlockPanic",
      tier: 4,
      choice: "b",
      name: "Panic Step",
      effect: "Early flee at 50% (round, never survivor-grade).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "kiteBand" },
          { kind: "weaponMod", weapon: "all", dmgPct: 0.08 },
      ],
    },
    {
      id: "warlockSoulbind",
      tier: 5,
      choice: "a",
      name: "Soulbind",
      effect: "Lifesteal signature +40%.",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.4 },
          { kind: "weaponMod", weapon: "lifeDrain", dmgPct: 0.15 },
      ],
    },
    {
      id: "warlockFlesh",
      tier: 5,
      choice: "b",
      name: "Borrowed Flesh",
      effect: "Max HP +14% (round, still fragile).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", pct: 0.14 },
      ],
    },
  ],
  elf: [
    {
      id: "elfGrace",
      tier: 1,
      choice: "a",
      name: "Grace",
      effect: "Speed +8%.",
      changesBehavior: false,
      effects: [
          { kind: "statMod", stat: "spd", pct: 0.08 },
      ],
    },
    {
      id: "elfTwinArts",
      tier: 1,
      choice: "b",
      name: "Leaf Guard",
      effect: "Max HP +6 flat and earlier retreat (round hybrid fragility).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", flat: 6 },
      ],
    },
    {
      id: "elfMeasure",
      tier: 2,
      choice: "a",
      name: "Measure",
      effect: "Sharper kite band.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "kiteBand", params: { weight: 1.25 } },
      ],
    },
    {
      id: "elfPress",
      tier: 2,
      choice: "b",
      name: "Woodland Step",
      effect: "Max HP +8 flat and earlier retreat (round neither-parent toughness).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", flat: 8 },
      ],
    },
    {
      id: "elfArrowCraft",
      tier: 3,
      choice: "a",
      name: "Arrow Craft",
      effect: "Magic Arrow +18%.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "magicArrow", dmgPct: 0.18 },
      ],
    },
    {
      id: "elfSlotEase",
      tier: 3,
      choice: "b",
      name: "Light Pack",
      effect: "Magnet +25 (round slot pressure).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "lootThroughPain" },
          { kind: "statMod", stat: "magnet", flat: 25 },
      ],
    },
    {
      id: "elfOnLevelFocus",
      tier: 4,
      choice: "a",
      name: "Level Focus",
      effect: "On level-up: focus path ATK +8%.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "onLevelUp", effect: { kind: "statMod", stat: "atk", pct: 0.08 } },
      ],
    },
    {
      id: "elfWard",
      tier: 4,
      choice: "b",
      name: "Leaf Ward",
      effect: "Max HP +10% (round neither-parent toughness).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", pct: 0.1 },
      ],
    },
    {
      id: "elfBladespell",
      tier: 5,
      choice: "a",
      name: "Blade-Spell",
      effect: "Sword + Bolt + Arrow +12%.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "swordSweep", dmgPct: 0.12 },
          { kind: "weaponMod", weapon: "fireBolt", dmgPct: 0.12 },
          { kind: "weaponMod", weapon: "magicArrow", dmgPct: 0.12 },
      ],
    },
    {
      id: "elfEndurance",
      tier: 5,
      choice: "b",
      name: "Woodland Endurance",
      effect: "Max HP +12% (round, still hybrid).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", pct: 0.12 },
      ],
    },
  ],
  thief: [
    {
      id: "thiefDeepPockets",
      tier: 1,
      choice: "a",
      name: "Deep Pockets",
      effect: "Gold pickup value +15%.",
      changesBehavior: false,
      effects: [
          { kind: "statMod", stat: "gold", pct: 0.15 },
      ],
    },
    {
      id: "thiefPrizeScent",
      tier: 1,
      choice: "b",
      name: "Evasive Route",
      effect: "Max HP +6 flat and earlier retreat (small durability round).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", flat: 6 },
      ],
    },
    {
      id: "thiefSpoilsBeforeBlood",
      tier: 2,
      choice: "a",
      name: "Spoils Before Blood",
      effect: "Loot pull stronger below 35% HP.",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "lootThroughPain" },
      ],
    },
    {
      id: "thiefLongFingers",
      tier: 2,
      choice: "b",
      name: "Light Fingers",
      effect: "Speed +5% and kite-band discipline (round low durability).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "kiteBand" },
          { kind: "statMod", stat: "spd", pct: 0.05 },
      ],
    },
    {
      id: "thiefTributeCart",
      tier: 3,
      choice: "a",
      name: "Tribute Cart",
      effect: "Elite brutes drop +10 gold.",
      changesBehavior: false,
      effects: [
          { kind: "statMod", stat: "gold", flat: 10 },
      ],
    },
    {
      id: "thiefTreasureRadar",
      tier: 3,
      choice: "b",
      name: "Escape Cache",
      effect: "Max HP +8 flat and earlier retreat (round, still fragile).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "hp", flat: 8 },
      ],
    },
    {
      id: "thiefCritCraft",
      tier: 4,
      choice: "a",
      name: "Crit Craft",
      effect: "Signature crit fantasy amp +15%.",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.15 },
          { kind: "weaponMod", weapon: "shadowDaggers", dmgPct: 0.12 },
      ],
    },
    {
      id: "thiefSlip",
      tier: 4,
      choice: "b",
      name: "Slip",
      effect: "Speed +10% (round glass body with mobility).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "lootThroughPain" },
          { kind: "statMod", stat: "spd", pct: 0.1 },
      ],
    },
    {
      id: "thiefMidas",
      tier: 5,
      choice: "a",
      name: "Midas Edge",
      effect: "Gold + crit signature peak.",
      changesBehavior: false,
      effects: [
          { kind: "statMod", stat: "gold", pct: 0.2 },
          { kind: "signatureMod", pct: 0.25 },
      ],
    },
    {
      id: "thiefIronLuck",
      tier: 5,
      choice: "b",
      name: "Iron Luck",
      effect: "Max HP +12% (round, still no tank).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "lootThroughPain" },
          { kind: "statMod", stat: "hp", pct: 0.12 },
      ],
    },
  ],
  monk: [
    {
      id: "monkBloodThirst",
      tier: 1,
      choice: "a",
      name: "Blood Thirst",
      effect: "Kill healing +0.1 HP before fatigue, +0.2 after.",
      changesBehavior: false,
      effects: [
          { kind: "signatureMod", pct: 0.15 },
      ],
    },
    {
      id: "monkClosingIn",
      tier: 1,
      choice: "b",
      name: "Fleet Feet",
      effect: "Speed +4% and earlier retreat (partly rounds the range lock).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "spd", pct: 0.04 },
      ],
    },
    {
      id: "monkFrenzy",
      tier: 2,
      choice: "a",
      name: "Frenzy",
      effect: "Damage +25% below 35% HP.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "hpBelow", threshold: 0.35, effect: { kind: "statMod", stat: "atk", pct: 0.25 } },
      ],
    },
    {
      id: "monkDesperateCharge",
      tier: 2,
      choice: "b",
      name: "Centered Retreat",
      effect: "Speed +6% and earlier retreat (round, weapon slot stays 1).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "earlyFlee" },
          { kind: "statMod", stat: "spd", pct: 0.06 },
      ],
    },
    {
      id: "monkSlaughterer",
      tier: 3,
      choice: "a",
      name: "Slaughterer",
      effect: "Elite kills reset all weapon cooldowns.",
      changesBehavior: false,
      effects: [
          { kind: "trigger", when: "onEliteKill", effect: { kind: "weaponMod", weapon: "all", cdPct: -1 } },
      ],
    },
    {
      id: "monkUndyingRage",
      tier: 3,
      choice: "b",
      name: "Undying Rage",
      effect: "Survive one lethal blow at 1 HP.",
      changesBehavior: true,
      effects: [
          { kind: "signatureMod", pct: 0 },
      ],
    },
    {
      id: "monkAuraCraft",
      tier: 4,
      choice: "a",
      name: "Aura Craft",
      effect: "Garlic Aura +20% damage / tighter cadence.",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "garlicAura", dmgPct: 0.2, cdPct: -0.08 },
      ],
    },
    {
      id: "monkStillness",
      tier: 4,
      choice: "b",
      name: "Stillness",
      effect: "Hold ground graft (discipline).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
      ],
    },
    {
      id: "monkPerfection",
      tier: 5,
      choice: "a",
      name: "Perfection",
      effect: "Garlic Aura +25% (one weapon perfected).",
      changesBehavior: false,
      effects: [
          { kind: "weaponMod", weapon: "garlicAura", dmgPct: 0.25 },
          { kind: "signatureMod", pct: 0.2 },
      ],
    },
    {
      id: "monkMortalCoil",
      tier: 5,
      choice: "b",
      name: "Mortal Coil",
      effect: "Max HP +10% (round, still one-weapon).",
      changesBehavior: true,
      effects: [
          { kind: "behaviorRule", rule: "holdGround" },
          { kind: "statMod", stat: "hp", pct: 0.1 },
      ],
    },
  ],
};

const allPerkById = new Map<PerkId, PerkDefinition>();
for (const classId of heroClassIds) {
  for (const perk of perkDefinitions[classId]) {
    allPerkById.set(perk.id, perk);
  }
}

export function findPerkDefinition(perkId: PerkId): PerkDefinition | undefined {
  return allPerkById.get(perkId);
}

export function collectPerkEffects(perks: readonly PerkId[]): readonly PerkEffect[] {
  const collected: PerkEffect[] = [];
  for (const perkId of perks) {
    const def = allPerkById.get(perkId);
    if (def === undefined) {
      continue;
    }
    for (const effect of def.effects) {
      collected.push(effect);
    }
  }
  return collected;
}

export function hasBehaviorRule(
  perks: readonly PerkId[],
  rule: "combatLock" | "earlyFlee" | "lootThroughPain" | "kiteBand" | "holdGround",
): boolean {
  for (const effect of collectPerkEffects(perks)) {
    if (effect.kind === "behaviorRule" && effect.rule === rule) {
      return true;
    }
  }
  return false;
}

export function signatureModPct(perks: readonly PerkId[]): number {
  let pct = 0;
  for (const effect of collectPerkEffects(perks)) {
    if (effect.kind === "signatureMod") {
      pct += effect.pct;
    }
  }
  return pct;
}

export function weaponModFor(
  perks: readonly PerkId[],
  weaponId: string,
): { dmgPct: number; cdPct: number } {
  let dmgPct = 0;
  let cdPct = 0;
  for (const effect of collectPerkEffects(perks)) {
    if (effect.kind !== "weaponMod") {
      continue;
    }
    if (effect.weapon !== "all" && effect.weapon !== weaponId) {
      continue;
    }
    dmgPct += effect.dmgPct ?? 0;
    cdPct += effect.cdPct ?? 0;
  }
  return { dmgPct, cdPct };
}

export function statModTotal(
  perks: readonly PerkId[],
  stat: "atk" | "hp" | "spd" | "luck" | "magnet" | "gold",
): { pct: number; flat: number } {
  let pct = 0;
  let flat = 0;
  for (const effect of collectPerkEffects(perks)) {
    if (effect.kind === "statMod" && effect.stat === stat) {
      pct += effect.pct ?? 0;
      flat += effect.flat ?? 0;
    }
  }
  return { pct, flat };
}

export function sanitizePerks(classId: HeroClassId, perks: readonly PerkId[]): readonly PerkId[] {
  const sanitized: PerkId[] = [];
  let expectedTier: PerkTier = 1;
  for (const tier of [1, 2, 3, 4, 5] as const) {
    if (tier !== expectedTier) {
      break;
    }
    const selected = perkDefinitions[classId].find((perk) => perk.tier === tier && perks.includes(perk.id));
    if (selected === undefined) {
      break;
    }
    sanitized.push(selected.id);
    expectedTier = nextTier(tier);
  }
  return sanitized;
}

export function isPerkId(value: unknown): value is PerkId {
  if (typeof value !== "string") {
    return false;
  }
  return allPerkById.has(value as PerkId);
}

export function hasPerk(perks: readonly PerkId[], perkId: PerkId): boolean {
  return perks.includes(perkId);
}

function nextTier(tier: PerkTier): PerkTier {
  switch (tier) {
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 4;
    case 4:
      return 5;
    case 5:
      return 5;
    default:
      return assertNever(tier);
  }
}
