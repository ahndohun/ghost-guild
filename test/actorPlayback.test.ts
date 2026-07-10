import { describe, expect, it } from "vitest";
import {
  activeHeroPlaybackActorKeys,
  advanceActorPlayback,
  pruneActorPlaybackStates,
} from "../src/render/actorPlayback";

describe("actor playback transitions", () => {
  it("returns a finished attack to idle when a paused simulation keeps presenting the same trigger", () => {
    const started = advanceActorPlayback(undefined, { action: "attack", retriggerToken: 41 }, 1_000);
    const finished = advanceActorPlayback(
      started.state,
      { action: "attack", retriggerToken: 41 },
      1_320,
    );
    const stillIdle = advanceActorPlayback(
      finished.state,
      { action: "attack", retriggerToken: 41 },
      2_000,
    );

    expect(finished.playback).toEqual({ action: "idle", elapsedMs: 0 });
    expect(stillIdle.playback).toEqual({ action: "idle", elapsedMs: 680 });
  });

  it("returns a finished hit reaction to idle after its presentation duration", () => {
    const started = advanceActorPlayback(undefined, { action: "hit", retriggerToken: 12 }, 500);
    const finished = advanceActorPlayback(
      started.state,
      { action: "hit", retriggerToken: 12 },
      740,
    );
    const stillIdle = advanceActorPlayback(
      finished.state,
      { action: "hit", retriggerToken: 12 },
      1_000,
    );

    expect(finished.playback).toEqual({ action: "idle", elapsedMs: 0 });
    expect(stillIdle.playback).toEqual({ action: "idle", elapsedMs: 260 });
  });

  it("lets an attack finish before accepting a lower-priority looping action", () => {
    const started = advanceActorPlayback(undefined, { action: "attack", retriggerToken: 8 }, 0);
    const beforeEnd = advanceActorPlayback(started.state, { action: "idle" }, 319);
    const atEnd = advanceActorPlayback(beforeEnd.state, { action: "idle" }, 320);

    expect(beforeEnd.playback).toEqual({ action: "attack", elapsedMs: 319 });
    expect(atEnd.playback).toEqual({ action: "idle", elapsedMs: 0 });
  });

  it("does not resume an old attack trigger after a hit reaction interrupts it", () => {
    const attacking = advanceActorPlayback(undefined, { action: "attack", retriggerToken: 8 }, 0);
    const hit = advanceActorPlayback(
      attacking.state,
      { action: "hit", retriggerToken: 9 },
      100,
    );
    const afterHit = advanceActorPlayback(
      hit.state,
      { action: "attack", retriggerToken: 8 },
      340,
    );

    expect(hit.playback).toEqual({ action: "hit", elapsedMs: 0 });
    expect(afterHit.playback).toEqual({ action: "idle", elapsedMs: 0 });
  });

  it("prunes actors that are no longer rendered while retaining active playback", () => {
    const hero = advanceActorPlayback(undefined, { action: "walk" }, 0).state;
    const killedEnemy = advanceActorPlayback(undefined, { action: "attack", retriggerToken: 2 }, 0)
      .state;
    const expiredDeath = advanceActorPlayback(undefined, { action: "death", retriggerToken: 3 }, 0)
      .state;
    const states = new Map([
      ["hero:1", hero],
      ["enemy:17", killedEnemy],
      ["enemy-death:17:90", expiredDeath],
    ]);

    pruneActorPlaybackStates(states, new Set(["hero:1"]));

    expect([...states.keys()]).toEqual(["hero:1"]);
  });

  it("keeps a death one-shot on its final presentation instead of returning to idle", () => {
    const started = advanceActorPlayback(undefined, { action: "death", retriggerToken: 90 }, 100);
    const held = advanceActorPlayback(
      started.state,
      { action: "death", retriggerToken: 90 },
      10_000,
    );

    expect(held.playback).toEqual({ action: "death", elapsedMs: 9_900 });
  });

  it("expires Arena hero corpses after 22 ticks, prunes playback, and preserves Solo death", () => {
    const livingHero = { id: 1, alive: true, deathTick: undefined } as const;
    const defeatedHero = { id: 2, alive: false, deathTick: 100 } as const;
    const arenaHeroes = [livingHero, defeatedHero];

    expect([...activeHeroPlaybackActorKeys(arenaHeroes, 121)]).toEqual(["hero:1", "hero:2"]);
    const afterExpiry = activeHeroPlaybackActorKeys(arenaHeroes, 122);
    expect([...afterExpiry]).toEqual(["hero:1"]);
    expect([...activeHeroPlaybackActorKeys([defeatedHero], 10_000)]).toEqual(["hero:2"]);

    const states = new Map([
      ["hero:1", advanceActorPlayback(undefined, { action: "walk" }, 0).state],
      [
        "hero:2",
        advanceActorPlayback(undefined, { action: "death", retriggerToken: 100 }, 0).state,
      ],
    ]);
    pruneActorPlaybackStates(states, afterExpiry);

    expect([...states.keys()]).toEqual(["hero:1"]);
  });
});
