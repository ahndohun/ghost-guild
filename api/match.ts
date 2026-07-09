import { list } from "@vercel/blob";

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type Loadout = {
  name: string;
  class: string;
  traits: { bravery: number; greed: number; focus: number };
  temperament?: string;
  perks?: { tier1: string | null; tier2: string | null; tier3: string | null };
  permStats: { atk: number; hp: number; spd: number; luck: number; lvl: number };
};

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

    // Shuffle the listing first and stop after 3 valid picks — avoids
    // serially fetching up to 100 blobs per matchmaking request.
    const shuffled = [...blobs];
    shuffleInPlace(shuffled);
    const candidates: Loadout[] = [];
    for (const blob of shuffled) {
      if (candidates.length >= 3) break;
      try {
        const response = await fetch(blob.url);
        if (!response.ok) continue;
        const data: unknown = await response.json();
        if (!isLoadout(data)) continue;
        if (exclude && data.name === exclude) continue;
        candidates.push(data);
      } catch {
        // skip unreadable blobs
      }
    }

    // Pass through temperament/perks when present on stored loadouts
    const opponents = candidates.map((c) => ({
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
