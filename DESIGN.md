# Ghost Guild — Design Spec

> **You don't play the hero. You manage them.**
> An idle management survivors-like: your hero fights, chooses upgrades, and dies **on their own judgment**. You tune who they *are* between runs — then watch your coaching pay off (or backfire) against ghosts of players worldwide.

One-line for judges: *Vampire Survivors where the hero plays itself — you're the guildmaster tuning its personality, then racing it against the world.*

## Pillars (모든 결정의 근거 축)

1. **The hero is a person, not a cursor.** Every visible action (diving, fleeing, looting, upgrade picks) must be attributable to its personality sliders. If a behavior can't be traced to a trait, cut it.
2. **Coaching, not controlling.** The player's only verbs: spend gold, move sliders, pick class, hit DEPLOY. During a run the player can do nothing but watch and learn.
3. **Deterministic to the bone.** Same seed + same loadouts = identical battle on every machine. This IS the multiplayer architecture and the test surface. No exceptions ever.

JRPG 감성 2%: DQ-style dialog box — the hero announces choices in one line ("I shall take the axe."), classes follow DQ archetypes, pixel font UI. That's the whole 2% — no cutscenes, no story.

---

## 1. Run structure

- Bounded arena, single screen: world 960×540, walls solid. Camera fixed.
- Run length: **180s** cap (survive = victory) or death. Sim: **fixed 30 ticks/s** (dt = 1/30, never variable).
- Score = `kills*10 + gold picked + survivedSeconds*5 + (survived ? 500 : 0)`.

## 2. Autonomous hero AI (utility scoring, no pathfinding)

Every 5 ticks the hero re-evaluates a **movement target** by scoring candidate directions (16 compass samples, score = weighted sum):

| Signal | Weight source |
|---|---|
| enemy density within 120px (repulsion) | `(100 - bravery)` |
| enemy density within 240px (attraction — get in weapon range) | `bravery` |
| nearest XP gem / gold within 200px (attraction) | `greed` |
| wall proximity < 60px (repulsion) | fixed 80 |
| low HP (<35%): flee vector away from centroid of enemies | fixed `(100 - bravery) * 2` |

Attack is automatic: each weapon fires on cooldown at nearest enemy in its range (no aiming decisions).

**Level-up choice** (the signature moment): on level-up, sim pauses 1.2s, 3 deterministic options are rolled, hero picks by trait utility:
- `focus` high → prefers upgrading an owned weapon (+1 level) over new weapons.
- `greed` high → prefers economy options (magnet radius, gold bonus).
- `bravery` high → prefers damage over defense/speed.
Dialog box shows the pick with a one-liner (from a fixed 12-line table keyed by option type — deterministic).

**Traits (0–100 sliders, free to adjust in guild):** `bravery` (용맹 — engage vs kite), `greed` (탐욕 — loot detours under fire), `focus` (집중 — specialize vs diversify builds). Defaults 50/50/50.

## 3. Classes (DQ 문법, 3종)

| Class | Unlock | HP | Speed | Starting weapon | Flavor |
|---|---|---|---|---|---|
| **Knight** | free | 120 | 90px/s | Sword Sweep: 140° arc, r=70, dmg 8, cd 0.9s | melee bruiser |
| **Mage** | 400g | 70 | 100px/s | Fire Bolt: nearest-enemy projectile, dmg 12, speed 260, cd 1.1s | glass cannon |
| **Priest** | 1200g | 95 | 95px/s | Holy Bolt: dmg 7, cd 1.0s + Heal Pulse: +3 HP to lowest-HP ally (or self) in 160px every 4s | multiplayer synergy |

## 4. Weapons & upgrades (level-up option pool)

Weapon slots max 4, each weapon levels 1–5 (dmg ×1.25/level, minor cd reduction).
Pool: **Sword Sweep, Fire Bolt, Holy Bolt, Throwing Axe** (arc projectile, dmg 15, cd 1.6s), **Frost Nova** (AoE r=90 around hero, dmg 6 + 30% slow 1s, cd 2.5s), **Garlic Aura** (r=80, dmg 2/0.5s).
Passives: +Max HP 20%, +Speed 12%, +Damage 15%, Magnet +60px, Gold +20%.
XP curve: level N needs `5 + 3N` gems. Enemies drop 1 gem (elites 5 + 10 gold; normals 30% chance 1 gold).

## 5. Waves (180s table)

| t (s) | spawn | notes |
|---|---|---|
| 0–30 | Slime every 1.2s (HP 10, spd 40, dmg 4, touch) | warm-up |
| 30–60 | + Bat every 0.9s (HP 6, spd 85, dmg 3) | pressure |
| 45, 90, 135 | **Elite Brute** ×1 (HP 150+50/wave, spd 55, dmg 12, r=18) | drops 10 gold |
| 60–120 | Slime 0.8s + Bat 0.7s | mid |
| 120–165 | + Brute(normal, HP 40) every 3s | heavy |
| 165–180 | swarm: all rates ×2 | finale |

Spawn points: random edge positions (seeded). Multiplayer: rates ×(0.75 + 0.25×heroCount) — shared arena, shared spawns.

## 6. Match & multiplayer (ghost match)

- A **match** = 1–4 loadouts in one arena, one seed. All heroes simulated locally, no friendly fire, all fight the same waves. Ranking by score; survivor bonus applies per hero.
- Solo run = match of 1. **Arena mode (P2)** = my loadout + up to 3 **ghost loadouts** fetched from server pool (async PvP — matchmaking without presence). Server also assigns the seed.
- API (P2): `POST /api/loadout` (name+loadout), `GET /api/match` (3 opponents + seed), `POST /api/result`, `GET /api/leaderboard` (top 20).
- Fallback: bundled bot loadouts if API unreachable — arena must never dead-end.

## 7. Meta (guild screen)

- Currency: gold (earned per run, kept on death).
- **Permanent upgrades** (escalating cost `base × 1.5^owned`): ATK +5% (base 50g), Max HP +8% (50g), Speed +3% (80g), Luck +5% option quality (100g), Starting Level +1 (200g).
- Class unlock (see §3). Trait sliders free.
- **Auto-run toggle**: when ON, results auto-close after 4s and next run starts — the idle mode. Persist everything in `localStorage` key `ghost-guild-save-v1`.

## 8. Determinism contract (불가침)

- All sim code in `src/sim/` — **pure TS, zero imports from DOM/render/Date/Math.random**.
- PRNG: mulberry32 seeded per match; ALL randomness (spawns, drops, option rolls, one-liners) flows from it in fixed call order.
- `simulateMatch(config): MatchResult` must be a pure function; also step-wise API for rendering (`createMatch(config)` → `step()` → readable state).
- vitest gates: (1) same seed twice → identical final-state hash; (2) full-speed 180s sim completes < 2s; (3) golden seed snapshot.

## 9. DOM surface (TestSprite E2E 표면 — 1급 요구)

Three screens (plain HTML over the canvas), all interactive elements carry `data-testid`:

- `#screen-guild`: sliders `trait-bravery|greed|focus`, class cards `class-knight|mage|priest`, upgrade buttons `buy-atk|hp|spd|luck|lvl`, gold display `gold-amount`, buttons `deploy-solo`, `deploy-arena`, `toggle-autorun`.
- `#screen-run`: canvas + HUD; hidden mirror `#game-state` with `data-phase|time|hp|level|kills|gold|seed` updated every 500ms.
- `#screen-results`: `result-score|rank|kills|time|gold-earned`, list `result-ranking`, button `back-to-guild`.
- URL params (dev & E2E): `?seed=N` fixed seed, `?fast=1` sim at max speed (no rAF wait), `?autoplay=1` auto-DEPLOY solo on load.

## 10. Visual direction (P0 = shapes, P3 = polish)

Dark parchment-night palette (#0e0c15 bg, #e8e3d5 ink, class colors: knight #d9a441, mage #7aa5ff, priest #9fe3b0, enemies #b8453f family, XP gems #58d6c9). Heroes = 14px circles with class glyph, enemies = squares/triangles by type, damage numbers float, hit flash 2 frames. Pixel font: "Press Start 2P" via bundled woff2 (no CDN) or system monospace fallback. Screen shake 3px on elite kill. JRPG dialog box: bottom, 2px white border, black bg.
