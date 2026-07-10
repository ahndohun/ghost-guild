import { describe, expect, it } from "vitest";
import { classDefinitions, heroClassIds } from "../src/sim/data";
import { perkDefinitions } from "../src/sim/perks";
import {
  perkArtFamilies,
  perkArtMetadata,
  perkIconPaths,
} from "../src/ui/perkArt";

describe("perk presentation art", () => {
  it("covers all 11 class trees and all 110 perk nodes without a missing family", () => {
    for (const classId of heroClassIds) {
      expect(perkDefinitions[classId], `${classId} perk tree`).toHaveLength(10);
    }

    const metadata = heroClassIds.flatMap((classId) =>
      perkDefinitions[classId].map((perk) => perkArtMetadata(classId, perk)),
    );

    expect(heroClassIds).toHaveLength(11);
    expect(metadata).toHaveLength(110);
    expect(metadata.every((entry) => perkArtFamilies.includes(entry.family))).toBe(true);
    expect(metadata.every((entry) => entry.iconPath === perkIconPaths[entry.family])).toBe(true);
    expect(metadata.every((entry) => entry.iconPath.startsWith("/assets/art/icons/perks/"))).toBe(true);
  });

  it("uses every composable icon family in the live perk vocabulary", () => {
    const usedFamilies = new Set(
      heroClassIds.flatMap((classId) =>
        perkDefinitions[classId].map((perk) => perkArtMetadata(classId, perk).family),
      ),
    );

    expect([...usedFamilies].sort()).toEqual([...perkArtFamilies].sort());
    expect(perkIconPaths).toEqual({
      attack: "/assets/art/icons/perks/attack.png",
      defense: "/assets/art/icons/perks/defense.png",
      movement: "/assets/art/icons/perks/movement.png",
      economy: "/assets/art/icons/perks/economy.png",
      behavior: "/assets/art/icons/perks/behavior.png",
      signature: "/assets/art/icons/perks/signature.png",
    });
  });

  it("classifies representative combat, survival, mobility, loot, AI, and signature nodes", () => {
    const representativeNodes = {
      attack: perkDefinitions.fighter.find((perk) => perk.id === "fighterSteelForm"),
      defense: perkDefinitions.knight.find((perk) => perk.id === "knightBulwark"),
      movement: perkDefinitions.elf.find((perk) => perk.id === "elfGrace"),
      economy: perkDefinitions.thief.find((perk) => perk.id === "thiefDeepPockets"),
      behavior: perkDefinitions.fighter.find((perk) => perk.id === "fighterPress"),
      signature: perkDefinitions.warlock.find((perk) => perk.id === "warlockPact"),
    } as const;

    for (const [expectedFamily, perk] of Object.entries(representativeNodes)) {
      expect(perk, `missing representative ${expectedFamily} node`).toBeDefined();
    }

    expect(perkArtMetadata("fighter", representativeNodes.attack!).family).toBe("attack");
    expect(perkArtMetadata("knight", representativeNodes.defense!).family).toBe("defense");
    expect(perkArtMetadata("elf", representativeNodes.movement!).family).toBe("movement");
    expect(perkArtMetadata("thief", representativeNodes.economy!).family).toBe("economy");
    expect(perkArtMetadata("fighter", representativeNodes.behavior!).family).toBe("behavior");
    expect(perkArtMetadata("warlock", representativeNodes.signature!).family).toBe("signature");

    const nestedSignature = perkDefinitions.warlock.find((perk) => perk.id === "warlockOnKillDrain")!;
    expect(perkArtMetadata("warlock", nestedSignature).family).toBe("signature");
  });

  it("returns framing metadata from class color, tier, and A/B choice without mutating input", () => {
    const perk = perkDefinitions.mage.find((entry) => entry.id === "mageMeteorCraft")!;
    const serializedBefore = JSON.stringify(perk);

    const first = perkArtMetadata("mage", perk);
    const second = perkArtMetadata("mage", perk);

    expect(first).toEqual(second);
    expect(JSON.stringify(perk)).toBe(serializedBefore);
    expect(first).toMatchObject({
      classId: "mage",
      classColor: classDefinitions.mage.color,
      tier: 4,
      choice: "a",
      frameToken: "mage-t4-a",
    });
  });
});
