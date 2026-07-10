import { classDefinitions, heroClassIds, perkDefinitions, weaponDefinitions } from "../sim";
import type { HeroClassId, PerkChoice, PerkTier } from "../sim";
import { classPortraitPath, skillIconPath } from "./art";
import { perkArtMetadata } from "./perkArt";

export const recommendedClassIds: readonly HeroClassId[] = ["fighter", "knight", "mage"];

const allOtherClassIds = heroClassIds.filter((classId) => !recommendedClassIds.includes(classId));
export const additionalClassCount = allOtherClassIds.length;

export function screenMarkup(): string {
  return `
    <section id="screen-title" class="screen title-screen hidden">
      <div class="title-scene">
        <div class="title-sky" aria-hidden="true"></div>
        <div class="title-stars" aria-hidden="true"></div>
        <div class="title-colosseum" aria-hidden="true"></div>
        <div class="title-flames" aria-hidden="true">
          <span class="title-flame title-flame-1"></span>
          <span class="title-flame title-flame-2"></span>
          <span class="title-flame title-flame-3"></span>
          <span class="title-flame title-flame-4"></span>
          <span class="title-flame title-flame-5"></span>
          <span class="title-flame title-flame-6"></span>
          <span class="title-flame title-flame-7"></span>
        </div>
        <div class="title-fog" aria-hidden="true"></div>
        <img
          class="title-statue title-statue-left"
          src="/assets/props/statue-sword.png"
          alt=""
          width="160"
          height="320"
          decoding="async"
          aria-hidden="true"
        />
        <img
          class="title-statue title-statue-right"
          src="/assets/props/statue-spear.png"
          alt=""
          width="160"
          height="320"
          decoding="async"
          aria-hidden="true"
        />
        <div class="title-brand">
          <h1 class="title-logo-big"><span class="title-logo-line">GHOST</span><span class="title-logo-line">COLOSSEUM</span></h1>
        </div>
        <div class="title-shell">
          <div class="title-window">
            <p class="eyebrow">THE GHOST GUILD PRESENTS</p>
            <p class="title-tagline">You don't play the gladiator. You coach them.</p>
            <p class="title-subline">Pick a class, forge its specialization tree — then watch judgment decide the sand.</p>
            <button type="button" class="primary title-start" data-testid="start-game">PRESS START</button>
          </div>
        </div>
      </div>
    </section>
    <section id="screen-guild" class="screen guild-screen hidden">
      <div class="guild-shell">
        <header class="guild-topstrip">
          <label class="player-name-field">
            <span>Gladiator</span>
            <input type="text" data-testid="player-name" maxlength="20" autocomplete="off" spellcheck="false" />
          </label>
          <div class="gold"><span class="gold-label">Gold</span><span id="gold-amount" data-testid="gold-amount">0</span></div>
          <div id="best-survival-guild" class="best-survival-guild hidden" data-testid="best-survival-guild"></div>
        </header>

        <div class="guild-body">
          <nav class="guild-nav" aria-label="Guild sections">
            <button type="button" class="guild-tab" data-testid="guild-tab-overview" data-guild-tab="overview" aria-pressed="true">Overview</button>
            <button type="button" class="guild-tab" data-testid="guild-tab-class" data-guild-tab="class" aria-pressed="false">Class</button>
            <button type="button" class="guild-tab" data-testid="guild-tab-training" data-guild-tab="training" aria-pressed="false">Training</button>
            <button type="button" class="guild-tab" data-testid="guild-tab-gear" data-guild-tab="gear" aria-pressed="false">Gear</button>
          </nav>

          <main class="guild-pane">
            <div id="guild-section-overview" class="guild-section">
              <div class="lobby-stage" aria-label="Gladiator lobby">
                <div class="lobby-stage-frame">
                  <canvas id="lobby-canvas" width="960" height="280" aria-label="Lobby stage"></canvas>
                  <div class="lobby-title-overlay">
                    <p class="eyebrow">BARRACKS</p>
                    <h1>Ghost Colosseum</h1>
                    <p class="tagline">Coach your gladiator. The crowd remembers.</p>
                    <p class="onboarding-line">Your gladiator fights on its own - pick a class, unlock its specialization tree, hit DEPLOY, and watch. Win gold for perks and permanent upgrades.</p>
                  </div>
                </div>
                <div class="lobby-nameplate" aria-live="polite">
                  <p id="lobby-nameplate-title" class="lobby-nameplate-title">Gladiator · Knight · Guardian</p>
                  <p id="lobby-nameplate-rule" class="lobby-nameplate-rule">Holds ground; low-HP flee only below 25%.</p>
                </div>
              </div>
              <section class="panel overview-summary" data-testid="guild-overview-summary">
                <h2>Overview</h2>
                <div class="overview-identity">
                  <img
                    id="overview-class-portrait"
                    class="overview-class-portrait"
                    data-testid="overview-class-portrait"
                    src="${classPortraitPath("knight")}"
                    alt="Knight portrait"
                    width="64"
                    height="64"
                    decoding="async"
                  />
                  <div>
                    <span>Current Class</span>
                    <strong id="overview-class-name">Knight</strong>
                  </div>
                </div>
                <dl class="overview-grid">
                  <div class="overview-cell"><dt>Equipped</dt><dd id="overview-equipped">—</dd></div>
                  <div class="overview-cell"><dt>Recommended</dt><dd id="overview-recommendation">—</dd></div>
                </dl>
              </section>
            </div>

            <div id="guild-section-class" class="guild-section hidden">
              <section class="panel">
                <h2>Class</h2>
                <p class="class-group-label">Recommended</p>
                <div class="class-grid" data-class-group="recommended">
                  ${recommendedClassIds.map(classMarkup).join("")}
                </div>
                <button type="button" class="toggle-all-classes" data-testid="toggle-all-classes" aria-expanded="false" aria-controls="all-classes-grid">
                  ALL CLASSES +${additionalClassCount}
                </button>
                <div id="all-classes-grid" class="class-grid all-classes-grid hidden" data-class-group="all">
                  ${allOtherClassIds.map(classMarkup).join("")}
                </div>
              </section>
            </div>

            <div id="guild-section-training" class="guild-section hidden">
              <section class="panel">
                <h2>Guild Upgrades</h2>
                <div class="upgrade-grid">
                  <button type="button" data-testid="buy-atk" disabled>ATK 50g</button>
                  <button type="button" data-testid="buy-hp" disabled>HP 50g</button>
                  <button type="button" data-testid="buy-spd" disabled>SPD 80g</button>
                  <button type="button" data-testid="buy-luck" disabled>LUCK 100g</button>
                  <button type="button" data-testid="buy-lvl" disabled>LVL 200g</button>
                </div>
              </section>
              <section class="panel perk-panel">
                <h2>Class Specialization</h2>
                <div class="perk-grid">
                  ${perkSlotMarkup(1, "a")}
                  ${perkSlotMarkup(1, "b")}
                  ${perkSlotMarkup(2, "a")}
                  ${perkSlotMarkup(2, "b")}
                  ${perkSlotMarkup(3, "a")}
                  ${perkSlotMarkup(3, "b")}
                  ${perkSlotMarkup(4, "a")}
                  ${perkSlotMarkup(4, "b")}
                  ${perkSlotMarkup(5, "a")}
                  ${perkSlotMarkup(5, "b")}
                </div>
              </section>
            </div>

            <div id="guild-section-gear" class="guild-section hidden">
              <section class="panel inventory-panel" data-testid="inventory-panel">
                <h2>Guild Inventory</h2>
                <div class="item-slots" aria-label="Equipped items">
                  ${itemSlotMarkup("relicWeapon", "Relic Weapon")}
                  ${itemSlotMarkup("armor", "Armor")}
                  ${itemSlotMarkup("trinket", "Trinket")}
                </div>
                <div class="item-compare-panel" data-testid="item-compare-panel" aria-live="polite">
                  <p class="item-compare-placeholder">Select a stash item to compare.</p>
                </div>
                <div id="stash-list" class="stash-list" data-testid="stash-list" aria-live="polite"></div>
              </section>
            </div>
          </main>
        </div>

        <aside id="coach-panel" class="coach-panel hidden" data-testid="coach-panel" aria-live="polite">
          <div class="coach-copy">
            <strong id="coach-step-label">COACH 1/4</strong>
            <span id="coach-message">Choose a recommended class.</span>
          </div>
          <button type="button" data-testid="coach-skip">SKIP</button>
        </aside>

        <footer class="guild-actions">
          <div class="guild-actions-primary">
            <button type="button" class="primary" data-testid="deploy-solo">DEPLOY SOLO</button>
            <button type="button" data-testid="deploy-arena">DEPLOY ARENA</button>
          </div>
          <div class="guild-actions-settings">
            <button type="button" class="settings-toggle" data-testid="coach-replay">REPLAY COACH</button>
            <button type="button" class="settings-toggle" data-testid="toggle-autorun" aria-pressed="false">AUTO-RUN OFF</button>
            <button type="button" class="settings-toggle" id="guild-sound-toggle" data-testid="sound-toggle" aria-pressed="false">SOUND ON</button>
          </div>
        </footer>
      </div>
    </section>
    <section id="screen-run" class="screen hidden">
      <div class="run-shell game-window">
        <div class="run-canvas-frame">
          <canvas id="run-canvas" width="960" height="540" aria-label="Ghost Guild run"></canvas>
          <div id="arena-offline-badge" class="offline-badge hidden" data-testid="arena-offline-badge">OFFLINE MATCH</div>
          <aside id="coach-run-panel" class="coach-panel coach-overlay hidden" data-testid="coach-run-panel" aria-live="polite">
            <div class="coach-copy">
              <strong>COACH 3/4</strong>
              <span>Watch the run, then return to the Guild.</span>
            </div>
            <button type="button" data-testid="coach-run-skip">SKIP</button>
          </aside>
        </div>
        <div id="game-state" class="mirror" hidden
          data-phase="" data-time="0" data-hp="0" data-level="1" data-kills="0" data-gold="0" data-seed=""
          data-class="" data-temperament=""></div>
      </div>
      <div class="hud" aria-hidden="false">
        <span class="hud-chip hud-time">TIME <strong id="hud-time">0s</strong></span>
        <div class="hud-hp-orb">
          <div class="hud-hp-well" aria-hidden="true">
            <div class="hud-hp-fill" id="hud-hp-fill"></div>
          </div>
          <img class="hud-hp-frame" src="/assets/ui/hp-orb-frame.png" alt="" draggable="false" />
          <span class="hud-hp-label">HP <strong id="hud-hp">0</strong></span>
        </div>
        <div class="hud-xp">
          <span class="hud-xp-level">LV <strong id="hud-level">1</strong></span>
          <div class="hud-xp-bar">
            <div class="hud-xp-track" aria-hidden="true">
              <div class="hud-xp-fill" id="hud-xp-fill"></div>
            </div>
            <img class="hud-xp-frame" src="/assets/ui/xp-bar-frame.png" alt="" draggable="false" />
          </div>
        </div>
        <button type="button" id="run-sound-toggle" class="hud-sound" data-testid="sound-toggle" aria-pressed="false">SOUND ON</button>
      </div>
    </section>
    <section id="screen-results" class="screen hidden">
      <div class="results-scroll">
        <div class="results-panel victory-window">
          <p class="eyebrow results-eyebrow">RESULTS</p>
          <h1 class="victory-title">The Sand Settles</h1>
          <p class="victory-sub">Match report from the colosseum floor</p>
          <aside id="coach-results-panel" class="coach-panel coach-results hidden" data-testid="coach-results-panel" aria-live="polite">
            <div class="coach-copy">
              <strong>COACH 3/4</strong>
              <span>Review the result, then return to the Guild.</span>
            </div>
            <button type="button" data-testid="coach-results-skip">SKIP</button>
          </aside>
          <dl class="result-grid">
            <div class="result-cell"><dt>Score</dt><dd id="result-score" data-testid="result-score">0</dd></div>
            <div class="result-cell"><dt>Rank</dt><dd id="result-rank" data-testid="result-rank">1</dd></div>
            <div class="result-cell"><dt>Kills</dt><dd id="result-kills" data-testid="result-kills">0</dd></div>
            <div class="result-cell"><dt>Time</dt><dd id="result-time" data-testid="result-time">0s</dd></div>
            <div class="result-cell"><dt>Gold</dt><dd id="result-gold-earned" data-testid="result-gold-earned">0</dd></div>
          </dl>
          <p id="best-survival" class="best-survival" data-testid="best-survival"></p>
          <h2 class="results-section-title">Match Ranking</h2>
          <ol id="result-ranking" class="ranking-list" data-testid="result-ranking"></ol>
          <section id="leaderboard-section" class="leaderboard-panel">
            <h2 class="results-section-title">World Leaderboard</h2>
            <ol id="leaderboard-list" class="leaderboard-list" data-testid="leaderboard-list"></ol>
          </section>
          <button type="button" class="primary" data-testid="back-to-guild">BACK TO GUILD</button>
        </div>
      </div>
    </section>
  `;
}

function itemSlotMarkup(slot: "relicWeapon" | "armor" | "trinket", label: string): string {
  return `
    <button type="button" class="item-slot" id="item-slot-${slot}" data-testid="item-slot-${slot}" data-item-slot="${slot}">
      <span class="item-slot-label">${label}</span>
      <div class="item-card-body">
        <img class="item-icon hidden" alt="" width="32" height="32" decoding="async" />
        <div class="item-copy">
          <strong>Empty</strong>
          <small>Click an equipped item to unequip.</small>
        </div>
      </div>
    </button>
  `;
}

function perkSlotMarkup(tier: PerkTier, choice: PerkChoice): string {
  const fallback = perkDefinitions.knight.find((perk) => perk.tier === tier && perk.choice === choice);
  const name = fallback === undefined ? "Locked" : fallback.name;
  const effect = fallback === undefined ? "Choose the previous tier first." : fallback.effect;
  const art = fallback === undefined ? undefined : perkArtMetadata("knight", fallback);
  return `
    <button type="button" class="perk-card" data-testid="perk-t${tier}-${choice}" aria-pressed="false" data-perk-tier="${tier}" data-perk-choice="${choice}"${art === undefined ? "" : ` data-perk-family="${art.family}" data-perk-frame="${art.frameToken}" style="--perk-accent: ${art.classColor}"`}>
      <span class="perk-tier">T${tier}${choice.toUpperCase()}</span>
      <span class="perk-icon-frame">
        <img id="perk-t${tier}-${choice}-icon" class="perk-icon" src="${art?.iconPath ?? ""}" alt="" width="32" height="32" decoding="async" />
      </span>
      <strong id="perk-t${tier}-${choice}-name">${name}</strong>
      <small id="perk-t${tier}-${choice}-effect">${effect}</small>
      <em id="perk-t${tier}-${choice}-cost">0g</em>
    </button>
  `;
}

function classMarkup(classId: HeroClassId): string {
  const definition = classDefinitions[classId];
  const startingWeapons = definition.startingWeapons ?? [definition.startingWeapon];
  const startingWeaponLabel = startingWeapons.map((weaponId) => weaponDefinitions[weaponId].name).join(" + ");
  return `
    <button type="button" class="class-card" data-testid="class-${classId}">
      <img class="class-portrait" src="${classPortraitPath(classId)}" alt="" width="64" height="64" decoding="async" />
      <strong>${definition.name}</strong>
      <span class="class-skill">
        <img class="class-skill-icon" src="${skillIconPath(definition.startingWeapon)}" alt="" width="32" height="32" decoding="async" />
        <small>${startingWeaponLabel}</small>
      </span>
      <span class="class-strength">${definition.strength}</span>
      <span class="class-weakness">${definition.weakness}</span>
      <small id="class-${classId}-status" class="class-status">Ready</small>
    </button>
  `;
}
