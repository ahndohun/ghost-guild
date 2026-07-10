import { classDefinitions, heroClassIds, perkDefinitions } from "../sim";
import type { HeroClassId, PerkChoice, PerkTier } from "../sim";
import { classPortraitPath, skillIconPath } from "./art";
import { perkArtMetadata } from "./perkArt";

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
          <h1 class="title-logo-big" aria-label="Colosseum Survivors"><span class="title-logo-line">COLOSSEUM</span><span class="title-logo-line">SURVIVORS</span></h1>
        </div>
        <div class="title-shell">
          <div class="title-window">
            <p class="eyebrow">ENTER THE GRAND ARENA</p>
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
          <p class="guild-location">BARRACKS · GRAND COLOSSEUM</p>
          <div class="gold"><span class="gold-label">Gold</span><span id="gold-amount" data-testid="gold-amount">0</span></div>
          <div class="settings-menu">
            <button type="button" class="settings-open" data-testid="settings-open" aria-expanded="false" aria-label="Open settings">⚙</button>
            <div id="settings-popover" class="settings-popover hidden" data-testid="settings-popover" role="menu">
              <button type="button" id="guild-sound-toggle" data-testid="sound-toggle" aria-pressed="false" role="menuitem">SOUND ON</button>
              <button type="button" data-testid="coach-replay" role="menuitem">TUTORIAL</button>
            </div>
          </div>
        </header>

        <div class="guild-body">
          <div class="lobby-stage" aria-label="Gladiator lobby">
            <div class="lobby-stage-frame">
              <canvas id="lobby-canvas" width="960" height="140" aria-label="Lobby stage"></canvas>
              <div class="lobby-title-overlay">
                <p class="eyebrow">YOUR GLADIATOR</p>
                <h1>Colosseum Survivors</h1>
                <p class="tagline">Coach the build. Trust their judgment.</p>
              </div>
            </div>
            <div class="lobby-nameplate" aria-live="polite">
              <button type="button" id="lobby-nameplate-title" class="lobby-nameplate-title" data-testid="rename-player">Gladiator · Knight · Guardian</button>
              <p id="lobby-nameplate-rule" class="lobby-nameplate-rule">Holds ground; low-HP flee only below 25%.</p>
              <p id="lobby-nameplate-best" class="lobby-nameplate-best" data-testid="nameplate-best">NO RUN RECORDED</p>
            </div>
          </div>

          <nav class="guild-nav" aria-label="Guild sections">
            <button type="button" class="guild-tab" data-testid="guild-tab-class" data-guild-tab="class" aria-pressed="true">CLASS &amp; TREE</button>
            <button type="button" class="guild-tab" data-testid="guild-tab-training" data-guild-tab="training" aria-pressed="false">TRAINING</button>
            <button type="button" class="guild-tab" data-testid="guild-tab-gear" data-guild-tab="gear" aria-pressed="false">INVENTORY</button>
          </nav>

          <main class="guild-pane">
            <div id="guild-section-class" class="guild-section">
              <section class="panel class-picker-panel">
                <h2>Choose a Class</h2>
                <div class="class-roster" data-testid="class-roster">
                  ${heroClassIds.map(classMarkup).join("")}
                </div>
                <article class="selected-class-detail" data-testid="selected-class-detail" aria-live="polite">
                  <img id="selected-class-portrait" class="selected-class-portrait" data-testid="selected-class-portrait" src="${classPortraitPath("knight")}" alt="Knight portrait" width="64" height="64" decoding="async" />
                  <div class="selected-class-heading">
                    <span id="selected-class-behavior-name" data-testid="selected-class-behavior-name">Guardian</span>
                    <h3 id="selected-class-name" data-testid="selected-class-name">Knight</h3>
                  </div>
                  <div class="selected-class-weapon">
                    <img id="selected-class-weapon-icon" src="${skillIconPath("swordSweep")}" alt="" width="32" height="32" decoding="async" />
                    <p><span>WEAPON</span><strong id="selected-class-weapons" data-testid="selected-class-weapons">Sword Sweep</strong></p>
                  </div>
                  <p class="selected-class-strength"><span>STRENGTH</span><strong id="selected-class-strength" data-testid="selected-class-strength">High HP, shrugs contact hits</strong></p>
                  <p class="selected-class-weakness"><span>WEAKNESS</span><strong id="selected-class-weakness" data-testid="selected-class-weakness">Lowest attack tier; slow feet</strong></p>
                  <p class="selected-class-behavior"><span>BEHAVIOR</span><strong id="selected-class-behavior" data-testid="selected-class-behavior">Holds ground; low-HP flee only below 25%.</strong></p>
                </article>
              </section>
              <section class="panel perk-panel class-tree-panel">
                <h2>Specialization Tree</h2>
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
                <article id="specialization-detail" class="specialization-detail" data-testid="specialization-detail" data-perk-testid="perk-t1-a" aria-live="polite">
                  <p><span>NAME</span><strong id="specialization-detail-name" data-testid="specialization-detail-name">Bulwark</strong></p>
                  <p><span>WHY</span><strong id="specialization-detail-reason" data-testid="specialization-detail-reason">Needs 150g; 0g held.</strong></p>
                  <p><span>EFFECT</span><strong id="specialization-detail-effect" data-testid="specialization-detail-effect">Contact damage taken −12.5%.</strong></p>
                </article>
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
            <span id="coach-message">Choose a class.</span>
          </div>
          <button type="button" data-testid="coach-skip">SKIP</button>
        </aside>

        <footer class="guild-actions">
          <button type="button" class="primary battle-open" data-testid="battle-open" aria-expanded="false">ENTER THE ARENA</button>
        </footer>

        <div id="battle-modal" class="modal-backdrop hidden" data-testid="battle-modal" role="dialog" aria-modal="true" aria-labelledby="battle-modal-title">
          <section class="modal-window battle-modal-window">
            <p class="eyebrow">CHOOSE YOUR SAND</p>
            <h2 id="battle-modal-title">Enter the arena</h2>
            <div class="battle-mode-grid">
              <button type="button" data-testid="deploy-solo">
                <strong id="deploy-solo-label">PRACTICE BOUT</strong>
                <span>Stand alone upon the sand.</span>
              </button>
              <button type="button" data-testid="deploy-arena">
                <strong id="deploy-arena-label">GRAND BOUT</strong>
                <span>Face three rival legends.</span>
              </button>
            </div>
            <button type="button" class="autorun-choice" data-testid="toggle-autorun" aria-pressed="false">AUTO-RUN OFF</button>
            <div class="modal-actions">
              <button type="button" data-testid="battle-close">NOT YET</button>
            </div>
          </section>
        </div>

        <div id="name-modal" class="modal-backdrop hidden" data-testid="name-modal" role="dialog" aria-modal="true" aria-labelledby="name-modal-title">
          <section class="modal-window name-modal-window">
            <p class="eyebrow">THE SAND ASKS</p>
            <h2 id="name-modal-title">Leave your name</h2>
            <p id="name-modal-copy" class="modal-copy">The sand will remember it.</p>
            <label class="player-name-field">
              <span>GLADIATOR NAME</span>
              <input type="text" data-testid="player-name" maxlength="20" autocomplete="off" spellcheck="false" />
            </label>
            <p id="name-modal-error" class="modal-error" aria-live="polite"></p>
            <div class="modal-actions">
              <button type="button" data-testid="name-modal-close">CANCEL</button>
              <button type="button" class="primary" data-testid="confirm-player-name">ENTER THE BARRACKS</button>
            </div>
          </section>
        </div>
      </div>
    </section>
    <section id="screen-run" class="screen hidden">
      <div class="run-shell game-window">
        <div class="spectator-hud" data-testid="spectator-hud" aria-label="Live run report">
          <div class="hud-chip hud-identity" data-testid="run-identity">
            <strong id="run-class" data-testid="run-class">Knight</strong>
            <span id="run-behavior" data-testid="run-behavior">HOLD GROUND</span>
            <small id="run-behavior-reason" data-testid="run-behavior-reason">Holding the arena center.</small>
          </div>
          <div class="hud-chip hud-time" data-testid="run-survival">
            <span id="run-mode" data-testid="run-mode">SOLO</span>
            <strong id="run-remaining" data-testid="run-remaining">180s LEFT</strong>
            <div class="hud-progress-track" aria-hidden="true"><div id="run-progress-fill" class="hud-progress-fill"></div></div>
            <small id="run-progress" data-testid="run-progress">0 / 180s</small>
            <span id="hud-time" hidden>0s</span>
          </div>
          <div class="hud-chip hud-stats" data-testid="run-stats">
            <span>KILLS <strong id="run-kills" data-testid="run-kills">0</strong></span>
            <span>GOLD <strong id="run-gold" data-testid="run-gold">0</strong></span>
            <span>SCORE <strong id="run-score" data-testid="run-score">0</strong></span>
          </div>
        </div>
        <div id="run-canvas-frame" class="run-canvas-frame" tabindex="-1">
          <canvas id="run-canvas" width="960" height="540" aria-label="Colosseum Survivors run"></canvas>
          <div id="arena-offline-badge" class="offline-badge hidden" data-testid="arena-offline-badge">OFFLINE MATCH</div>
          <div class="hud" aria-hidden="false">
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
          </div>
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
    </section>
    <section id="screen-results" class="screen hidden">
      <div class="results-scroll">
        <div class="results-panel victory-window">
          <p class="eyebrow results-eyebrow">RESULTS</p>
          <h1 class="victory-title">The Sand Settles</h1>
          <p id="result-outcome" class="result-outcome" data-testid="result-outcome">DEFEATED AT 0s</p>
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
            <div id="result-rank-cell" class="result-cell" data-testid="result-rank-cell"><dt>Placement</dt><dd id="result-rank" data-testid="result-rank">1</dd></div>
            <div class="result-cell"><dt>Kills</dt><dd id="result-kills" data-testid="result-kills">0</dd></div>
            <div class="result-cell"><dt>Time</dt><dd id="result-time" data-testid="result-time">0s</dd></div>
          </dl>
          <section class="result-rewards" aria-label="Run rewards">
            <div class="gold-ledger" data-testid="result-gold-ledger">
              <span>BEFORE <strong id="result-gold-before" data-testid="result-gold-before">0</strong></span>
              <span>+ EARNED <strong id="result-gold-earned" data-testid="result-gold-earned">0</strong></span>
              <span>AFTER <strong id="result-gold-after" data-testid="result-gold-after">0</strong></span>
            </div>
            <div class="result-loot"><span>LOOT</span><strong id="result-loot" data-testid="result-loot">No loot</strong></div>
          </section>
          <p id="best-survival" class="best-survival" data-testid="best-survival"></p>
          <section id="match-ranking-section" data-testid="match-ranking-section">
            <h2 class="results-section-title">Match Ranking</h2>
            <ol id="result-ranking" class="ranking-list" data-testid="result-ranking"></ol>
          </section>
          <section id="leaderboard-section" class="leaderboard-panel" data-testid="leaderboard-section">
            <h2 class="results-section-title">World Leaderboard</h2>
            <p id="leaderboard-status" class="leaderboard-status" data-testid="leaderboard-status">WORLD LEADERBOARD UNAVAILABLE</p>
            <ol id="leaderboard-list" class="leaderboard-list" data-testid="leaderboard-list"></ol>
          </section>
          <div class="result-actions">
            <button type="button" class="primary" data-testid="run-again">RUN AGAIN</button>
            <button type="button" data-testid="adjust-build">ADJUST BUILD</button>
            <button type="button" class="tertiary" data-testid="back-to-guild">BACK TO GUILD</button>
          </div>
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
  return `
    <button type="button" class="class-card" data-testid="class-${classId}">
      <img class="class-portrait" src="${classPortraitPath(classId)}" alt="" width="64" height="64" decoding="async" />
      <strong>${definition.name}</strong>
      <small id="class-${classId}-status" class="class-status">Ready</small>
    </button>
  `;
}
