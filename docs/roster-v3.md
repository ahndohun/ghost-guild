# Roster v3 — Capcom D&D-inspired 11-class roster + deep specialization trees

Board directive 2026-07-10: drop Gambler; reference Capcom's *Dungeons & Dragons* (Tower of Doom / Shadow over Mystara) classes, richer; very large perk/spec-tree volume. Builds ON TOP of Traits v3 (class-embedded temperaments, per-class trees).

## Design grammar

- **Archetype** = extreme on one axis (identity reads in one sentence). **Hybrid** = midpoint of two archetypes — worse at both, unique because it does both alone.
- Every class card keeps the honest strength/weakness two-liner.
- Behavior (embedded temperament) is an axis too: same stats + different behavior = different class.

## The 11 classes (stat baselines — cycle may tune ±15% under determinism gates)

| Class | Capcom root | HP | SPD | Start weapon(s) | Embedded behavior | Signature / rule |
|---|---|---|---|---|---|---|
| **Fighter** | Fighter | 110 | 95 | Sword Sweep | vanguard (balanced) | none — reliability IS the identity |
| **Knight** | — (board) | 140 | 85 | Shield Bash | guardian (survivor-derived: holds ground, late flee) | contact damage −15%, ATK lowest tier |
| **Berserker** | — | 80 | 100 | Whirlwind Axe | berserker (combat-locked) | kill-heal (existing berserker signature) |
| **Dwarf** | Dwarf | 120 | 90 | Earth Shatter (fast cadence) | berserker-derived close-in | **small hitbox** (hero radius −25%), weapon cd −10% |
| **Paladin** | — (board) | 125 | 88 | Holy Smash + weak Heal Pulse (+1HP/5s) | vanguard-guardian mid | hybrid: damage ×0.55, tankier than Priest, heals worse; softer than Knight |
| **Mage** | Magic-User | 70 | 100 | Fire Bolt | duelist (precision kiting) | highest burst |
| **Priest** | Cleric | 95 | 95 | Holy Bolt + Heal Pulse | survivor (long-run ops) | heal specialist, weakest weapon dmg |
| **Warlock** | — | 75 | 95 | Life Drain | berserker-derived aggressive caster | **lifesteal 8%** of damage dealt |
| **Elf Archer** | Elf | 90 | 100 | Magic Arrow | duelist | **0.6s Elf-only arrow cadence**, weapon slots 4→3; fragile when cornered |
| **Thief** | Thief | 85 | **115** | Shadow Daggers | hoarder (loot-driven kiting) | **crit 20% ×2 dmg** (class-scoped RNG branch), magnet +60px, gold +20% |
| **Monk** | — (kept) | 110 | 100 | Garlic Aura | berserker | weapon slot locked to 1, cap Lv.8, contact −20% |

- Gambler removed. Save/ghost migration: gambler → thief (keeps the greed identity), refund unmappable perk gold. Server keeps accepting "gambler" in old ghost payloads, remapping to thief on read.
- New temperament presets are derivations (guardian, aggressive-caster) via preset parameters — behavior SYSTEM unchanged.

## Specialization trees — the big volume

**5 tiers × pick-1-of-2 = 10 nodes per class → 110 nodes total.** Tier unlock costs 150/350/600/900/1300g (per class). At least one behavior-changing node per tier. Node = pure data over a standardized effect schema (no per-node code):

```ts
type PerkEffect =
  | { kind: "statMod"; stat: "atk"|"hp"|"spd"|"luck"|"magnet"|"gold"; pct?: number; flat?: number }
  | { kind: "behaviorRule"; rule: "combatLock"|"earlyFlee"|"lootThroughPain"|"kiteBand"|"holdGround"; params?: Record<string, number> }
  | { kind: "signatureMod"; pct: number }                       // amplifies the class signature
  | { kind: "weaponMod"; weapon: WeaponId|"all"; dmgPct?: number; cdPct?: number }
  | { kind: "trigger"; when: "hpBelow"|"onKill"|"onEliteKill"|"onLevelUp"; threshold?: number; effect: PerkEffect };
```

Tier themes (shared skeleton, class-flavored): T1 stat identity · T2 **behavior fork** · T3 weapon/signature craft · T4 conditional power (triggers) · T5 capstone (mutually exclusive run-changers). Example (Paladin): T2 "Judgment" (graft combat-lock) vs "Vigil" (graft early-flee heal-bias); T5 "Crusader" (holy burst on elite kill) vs "Saint" (heal pulse becomes aura, +radius).

Node authoring: workers generate per-class tables from this schema + tier themes; the advisor reviews identity fit.

**Choice grammar (board 2026-07-10, supersedes amplify-only):** each pick-1-of-2 is a tension between **sharpen** (maximize the class strength) and **round** (partially offset the class weakness). Rounding is capped at ~40% of the weakness (e.g. Mage HP 70 → +20 via "Arcane Ward", still the softest tier; Berserker may buy back SOME caution, never survivor-grade). Total identity erasure is forbidden — the fantasy must survive every build.

## Execution phases

1. (running) Traits v3 cycle — infrastructure: class-keyed trees, temperament derivation, UI.
2. Roster v3 cycle: sim class data + new temperament derivations + crit branch (Thief) + pure-archer cadence/slot-cap (Elf) + hitbox (Dwarf) + lifesteal (Warlock) + weak-heal (Paladin); tree expansion to 5 tiers; UI grid for 11 classes; sprites; server CLASSES + gambler remap; bots refresh; golden update (intended).
3. Verification: determinism gates, per-class behavior smoke (distinct outcomes on one seed), tsloop, board report.

## Class fantasy gate (board 2026-07-10)

Every class must deliver the fantasy people expect from that job — visually (sprite silhouette/colors/weapon), mechanically (signature skill), and behaviorally. One expected-fantasy line per class is the review gate:

Fighter=reliable master-at-arms · Knight=immovable bulwark · Berserker=blood-fueled whirlwind · Dwarf=stout tunnel-fighter who shrugs blows · Paladin=holy protector who smites and mends · Mage=arcane artillery · Priest=divine light that outlasts darkness · Warlock=life-stealing dark caster · Elf Archer=rapid homing volleys from a safe firing lane · Thief=untouchable blur that strikes gold · Monk=one weapon, perfected.

## Skill & effect volume (board 2026-07-10)

Weapon/skill pool 6 → **18+**, each with a DISTINCT visual effect (render layer), class-affinity weighting in the level-up pool (fantasy reinforcement), and class-signature starters:

Existing 6: Sword Sweep, Fire Bolt, Holy Bolt, Throwing Axe, Frost Nova, Garlic Aura.
New 12+: Holy Smash (paladin: forward smite + small self-heal) · Life Drain (warlock: beam, lifesteal amp) · Shadow Daggers (thief: 3-dagger fan, crit synergy) · Earth Shatter (dwarf: quake AoE) · Magic Arrow (elf: homing bolt) · Whirlwind Axe (berserker: spin AoE) · Shield Bash (knight: knockback cone) · Radiant Burst (priest: turn-undead homage, expanding light) · Meteor (mage capstone, Capcom D&D homage) · Chain Lightning · Poison Flask (ground DoT) · Crossbow Bolt (generic ranged).
Effects: per-skill particle/shape/palette in the render layer — no two skills may read the same on screen.

## Item & loot system v1 (board 2026-07-10 — parallel track)

Diablo-grammar loot, deterministic, ghost-compatible:

- **Rarities**: common / magic / rare / **unique** (orange — changes gameplay rules) / **set** (green — 2-3pc bonuses).
- **Loop**: enemies drop items mid-run (auto-loot via existing magnet/pickup path; new DropKind "item") → end-of-run settlement → **surviving the full 180s upgrades the rarity table for that run's drops** (survival = better loot).
- **Determinism**: drop rolls from the seeded PRNG (+LUCK weighting). Equipped items are part of the loadout (server schema + ghost replay must carry them).
- **Slots (simple)**: relic weapon / armor / trinket. Inventory panel on the guild screen (equipped 3 + stash); auto-equip suggestion allowed, click to equip.
- **Affix schema = PerkEffect reuse** (one effect system for tree nodes AND items): statMod / behaviorRule / signatureMod / weaponMod / trigger. Uniques are class-locked and rule-bending (e.g. Berserker "Bloodhowl Axe": no fatigue, maxHP −20%; Mage "Archon Orb": Fire Bolt triple-shot, HP −15; Thief "Midas Fang": crits steal gold). Sets: 3-4 sets × 3 pieces with 2pc/3pc bonuses.
- **Volume**: ~18 base items × rarity affix pools + 11-22 class uniques + 3-4 sets ≈ 60-80 item definitions (pure data tables; workers mass-produce, advisor reviews identity fit + fantasy gate).
- UI: rarity colors on drop sparkle + inventory cards; item card shows name/rarity/affixes; DOM surface additions get data-testids (inventory-panel, item-slot-*, stash-list) — extend DESIGN §9 when implemented.
