# Ghost Colosseum — Design Spec

> **You don't play the gladiator. You coach them.**
> (display title: **Ghost Colosseum**; repo/URL codename remains ghost-guild)
> An idle management survivors-like: your hero fights, chooses upgrades, and dies **on their own judgment**. You tune who they *are* between runs — then watch your coaching pay off (or backfire) against ghosts of players worldwide.

One-line for judges: *An idle colosseum survivors where the gladiator fights on its own judgment — you tune who they are, then pit them against ghost loadouts of the world.*

**Setting (2026-07-10 확정)**: 검투사 콜로세움. 영웅 = 모래 위에서 처절하게 살아남으려는 검투사(직업은 다양). 아레나 = 관중석에 둘러싸인 투기장. 멀티의 고스트 = 전 세계 검투사들의 그림자. JRPG 2%는 DQ 클래스 문법 + 다이얼로그로 유지.

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

**Traits v2 — 기질(Temperament) 시스템 (2026-07-10 재기획, 슬라이더 폐지):**

검투사의 정체성은 카드 1장으로 선택한다. 각 기질 = 내부 가중치 프리셋(bravery/greed/focus는 내부 파라미터로 유지) + **화면에서 보이는 하드룰 1개** + 시그니처 패시브 1개 + 레벨업 선호.

| 기질 | 내부 프리셋 (b/g/f) | 하드룰 (유틸리티 가중치가 아니라 규칙) | 시그니처 | 레벨업 선호 |
|---|---|---|---|---|
| **광전사 Berserker** | 90/20/50 | 적이 200px 안에 있으면 전리품 무시(greed 신호 0), HP<35% 도주 보정 없음(돌진) | 처치 시 HP +1 | 공격 옵션만 |
| **보물꾼 Hoarder** | 35/95/45 | 전리품이 있으면 HP<35%에서도 우회한다 | 골드 획득 +30% | 경제 옵션 우선 |
| **냉혈검사 Duelist** | 60/25/95 | 무기 사거리의 80~100%를 유지하려 함(정밀 카이팅) | 최고레벨 무기 피해 +15% | 보유 무기 강화만 |
| **생존자 Survivor** | 20/40/60 | 위험 감지 반경 1.5배, HP<50%부터 도주 보정 | 생존초 점수 ×1.4 | 방어/이속 선호 |

기본 기질 = 광전사. UI: `#screen-guild`의 슬라이더 섹션 → 기질 카드 4장(data-testid `temperament-berserker|hoarder|duelist|survivor`), 선택 무료 교체 가능(코칭 판타지). 카드에 하드룰·시그니처 한 줄 명기.

**특성 노드(Perks) — 정체성을 벼리는 질적 성장 (만능화 금지):** 기질별 3티어 × 2택 1, 골드 해금(150/400/900g), 티어 순차, 기질 교체 시 노드는 기질별로 보존. 모든 노드는 해당 기질을 증폭하는 방향만 — 약점 보완 노드 없음. 예(광전사): T1 '피의 갈증'(처치 회복 +1) vs '전투 본능'(공격속도 +8%), T2 '광란'(HP<35%에서 피해 +25%) vs '철피부'(접촉피해 -20%), T3 '학살자'(엘리트 처치 시 전무기 쿨다운 초기화) vs '불멸의 분노'(치명타 1회 생존). 데이터 테이블로 구현, data-testid `perk-<tier>-<a|b>`.

로드아웃 호환: loadout에 `temperament`·`perks` 필드 추가. traits만 있는 구버전 로드아웃은 가장 가까운 기질로 매핑(서버·클라 공통 함수).

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
