import { classDefinitions, perkDefinitions, temperamentDefinitions, temperamentIds } from "../sim";
import type { HeroClassId, PerkChoice, PerkTier, TemperamentId } from "../sim";

export function screenMarkup(): string {
  return `
    <section id="screen-guild" class="screen guild-screen">
      <div class="lobby-stage" aria-label="Gladiator lobby">
        <div class="lobby-stage-frame">
          <canvas id="lobby-canvas" width="960" height="280" aria-label="Lobby stage"></canvas>
          <div class="lobby-title-overlay">
            <p class="eyebrow">THE GHOST GUILD PRESENTS</p>
            <h1>Ghost Colosseum</h1>
            <p class="tagline">Coach your gladiator. The crowd remembers.</p>
            <p class="onboarding-line">Your gladiator fights on its own - pick a temperament, hit DEPLOY, and watch. Win gold to unlock perks, classes, and upgrades.</p>
          </div>
        </div>
        <div class="lobby-nameplate" aria-live="polite">
          <p id="lobby-nameplate-title" class="lobby-nameplate-title">Gladiator · Knight · Berserker</p>
          <p id="lobby-nameplate-rule" class="lobby-nameplate-rule">Ignores loot when an enemy is within 200px and never flees at low HP.</p>
          <div id="best-survival-guild" class="best-survival-guild hidden" data-testid="best-survival-guild"></div>
        </div>
      </div>
      <header class="topbar">
        <div class="topbar-meta">
          <label class="player-name-field">
            <span>Gladiator</span>
            <input type="text" data-testid="player-name" maxlength="20" autocomplete="off" spellcheck="false" />
          </label>
          <div class="gold">Gold <span id="gold-amount" data-testid="gold-amount">0</span></div>
        </div>
      </header>
      <main class="guild-layout">
        <section class="panel temperament-panel">
          <h2>Temperament</h2>
          <div class="temperament-grid">
            ${temperamentIds.map(temperamentMarkup).join("")}
          </div>
        </section>
        <section class="panel">
          <h2>Class</h2>
          <div class="class-grid">
            ${classMarkup("knight")}
            ${classMarkup("mage")}
            ${classMarkup("priest")}
          </div>
        </section>
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
          <h2>Perks</h2>
          <div class="perk-grid">
            ${perkSlotMarkup(1, "a")}
            ${perkSlotMarkup(1, "b")}
            ${perkSlotMarkup(2, "a")}
            ${perkSlotMarkup(2, "b")}
            ${perkSlotMarkup(3, "a")}
            ${perkSlotMarkup(3, "b")}
          </div>
        </section>
      </main>
      <footer class="actions">
        <button type="button" class="primary" data-testid="deploy-solo">DEPLOY SOLO</button>
        <button type="button" data-testid="deploy-arena">DEPLOY ARENA</button>
        <button type="button" data-testid="toggle-autorun" aria-pressed="false">AUTO-RUN OFF</button>
        <button type="button" id="guild-sound-toggle" data-testid="sound-toggle" aria-pressed="false">SOUND ON</button>
      </footer>
    </section>
    <section id="screen-run" class="screen hidden">
      <div class="run-shell">
        <canvas id="run-canvas" width="960" height="540" aria-label="Ghost Guild run"></canvas>
        <div id="arena-offline-badge" class="offline-badge hidden" data-testid="arena-offline-badge">OFFLINE MATCH</div>
        <div class="hud">
          <span>HP <strong id="hud-hp">0</strong></span>
          <span>LV <strong id="hud-level">1</strong></span>
          <span>KILLS <strong id="hud-kills">0</strong></span>
          <span>TIME <strong id="hud-time">0s</strong></span>
          <button type="button" id="run-sound-toggle" data-testid="sound-toggle" aria-pressed="false">SOUND ON</button>
        </div>
        <div id="game-state" class="mirror" hidden></div>
      </div>
    </section>
    <section id="screen-results" class="screen hidden">
      <div class="results-panel">
        <p class="eyebrow">RESULTS</p>
        <h1>The Sand Settles</h1>
        <dl class="result-grid">
          <div><dt>Score</dt><dd id="result-score" data-testid="result-score">0</dd></div>
          <div><dt>Rank</dt><dd id="result-rank" data-testid="result-rank">1</dd></div>
          <div><dt>Kills</dt><dd id="result-kills" data-testid="result-kills">0</dd></div>
          <div><dt>Time</dt><dd id="result-time" data-testid="result-time">0s</dd></div>
          <div><dt>Gold</dt><dd id="result-gold-earned" data-testid="result-gold-earned">0</dd></div>
        </dl>
        <p id="best-survival" class="best-survival" data-testid="best-survival"></p>
        <h2>Match Ranking</h2>
        <ol id="result-ranking" data-testid="result-ranking"></ol>
        <section id="leaderboard-section" class="leaderboard-panel">
          <h2>World Leaderboard</h2>
          <ol id="leaderboard-list" data-testid="leaderboard-list"></ol>
        </section>
        <button type="button" class="primary" data-testid="back-to-guild">BACK TO GUILD</button>
      </div>
    </section>
  `;
}

function temperamentMarkup(temperament: TemperamentId): string {
  const definition = temperamentDefinitions[temperament];
  return `
    <button type="button" class="temperament-card" data-testid="temperament-${temperament}" aria-pressed="false">
      <strong>${definition.name}</strong>
      <span>${definition.hardRule}</span>
      <small>${definition.signature}</small>
    </button>
  `;
}

function perkSlotMarkup(tier: PerkTier, choice: PerkChoice): string {
  const fallback = perkDefinitions.berserker.find((perk) => perk.tier === tier && perk.choice === choice);
  const name = fallback === undefined ? "Locked" : fallback.name;
  const effect = fallback === undefined ? "Choose the previous tier first." : fallback.effect;
  return `
    <button type="button" class="perk-card" data-testid="perk-t${tier}-${choice}" aria-pressed="false">
      <span class="perk-tier">T${tier}${choice.toUpperCase()}</span>
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
      <span class="class-glyph">${definition.glyph}</span>
      <strong>${definition.name}</strong>
      <small>${definition.startingWeapon}</small>
      <small id="class-${classId}-status" class="class-status">Unlocked</small>
    </button>
  `;
}
