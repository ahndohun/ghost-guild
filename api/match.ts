import { list } from "@vercel/blob";

// Inlined (not imported) so the Vercel serverless bundle has zero cross-file
// resolution risk. Picks up to `limit` opponents, deduped by name, excluding self.
// Keep Traits v3 derivation in sync with src/apiRules.ts / api/loadout.ts.
function selectUniqueByName<T extends { readonly name: string }>(
  candidates: readonly T[],
  excludeName: string,
  limit: number,
): readonly T[] {
  const selected: T[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (candidate.name === excludeName || seen.has(candidate.name)) continue;
    seen.add(candidate.name);
    selected.push(candidate);
  }
  return selected;
}

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type HeroClass = "knight" | "mage" | "priest" | "monk" | "gambler";
type Temperament = "berserker" | "hoarder" | "duelist" | "survivor" | "vanguard";

type Loadout = {
  name: string;
  class: string;
  traits: { bravery: number; greed: number; focus: number };
  temperament?: string;
  perks?: { tier1: string | null; tier2: string | null; tier3: string | null };
  permStats: { atk: number; hp: number; spd: number; luck: number; lvl: number };
};

const TEMPERAMENT_PRESETS: Record<Temperament, { bravery: number; greed: number; focus: number }> = {
  berserker: { bravery: 90, greed: 20, focus: 50 },
  hoarder: { bravery: 35, greed: 95, focus: 45 },
  duelist: { bravery: 60, greed: 25, focus: 95 },
  survivor: { bravery: 20, greed: 40, focus: 60 },
  vanguard: { bravery: 60, greed: 40, focus: 60 },
};

function temperamentForClass(classId: string): Temperament | undefined {
  switch (classId) {
    case "knight":
      return "vanguard";
    case "mage":
      return "duelist";
    case "priest":
      return "survivor";
    case "monk":
      return "berserker";
    case "gambler":
      return "hoarder";
    default:
      return undefined;
  }
}

function queryValue(query: VercelRequest["query"], key: string): string | undefined {
  const value = query?.[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function isLoadout(value: unknown): value is Loadout {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== "string") return false;
  if (typeof obj.class !== "string") return false;
  if (typeof obj.traits !== "object" || obj.traits === null) return false;
  if (typeof obj.permStats !== "object" || obj.permStats === null) return false;

  // temperament / perks: structural checks only (strict validation is loadout.ts)
  if (obj.temperament !== undefined && typeof obj.temperament !== "string") return false;
  if (obj.perks !== undefined) {
    if (typeof obj.perks !== "object" || obj.perks === null || Array.isArray(obj.perks)) return false;
    const perks = obj.perks as Record<string, unknown>;
    for (const key of ["tier1", "tier2", "tier3"] as const) {
      const choice = perks[key];
      if (choice !== undefined && choice !== null && typeof choice !== "string") return false;
    }
  }

  return true;
}

/**
 * Old ghosts stay usable. Always provide class-derived temperament when class is known.
 * Preserves stored perks shape; client maps a/b onto the class specialization tree.
 */
function canonicalizeGhost(loadout: Loadout): Loadout {
  const derived = temperamentForClass(loadout.class);
  if (derived === undefined) {
    // Unknown class string — pass through stored temperament if any.
    return {
      name: loadout.name,
      class: loadout.class,
      traits: loadout.traits,
      ...(loadout.temperament !== undefined ? { temperament: loadout.temperament } : {}),
      ...(loadout.perks !== undefined ? { perks: loadout.perks } : {}),
      permStats: loadout.permStats,
    };
  }

  return {
    name: loadout.name,
    class: loadout.class,
    traits: { ...TEMPERAMENT_PRESETS[derived] },
    temperament: derived,
    ...(loadout.perks !== undefined ? { perks: loadout.perks } : {}),
    permStats: loadout.permStats,
  };
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

function randomSeed32(): number {
  return (Math.random() * 0x100000000) >>> 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const exclude = queryValue(req.query, "exclude") ?? "";
    const seed = randomSeed32();

    // BLOB_READ_WRITE_TOKEN is injected by Vercel
    const { blobs } = await list({
      prefix: "loadouts/",
      limit: 100,
    });

    const shuffled = [...blobs];
    shuffleInPlace(shuffled);
    const candidates: Loadout[] = [];
    for (const blob of shuffled) {
      if (selectUniqueByName(candidates, exclude, 3).length >= 3) break;
      try {
        const response = await fetch(blob.url);
        if (!response.ok) continue;
        const data: unknown = await response.json();
        if (!isLoadout(data)) continue;
        candidates.push(canonicalizeGhost(data));
      } catch {
        // skip unreadable blobs
      }
    }

    const opponents = selectUniqueByName(candidates, exclude, 3).map((c) => ({
      name: c.name,
      class: c.class,
      traits: c.traits,
      ...(c.temperament !== undefined ? { temperament: c.temperament } : {}),
      ...(c.perks !== undefined ? { perks: c.perks } : {}),
      permStats: c.permStats,
    }));

    res.status(200).json({ seed, opponents });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
}
