import { put } from "@vercel/blob";
import { loadoutBlobKey } from "../src/apiRules";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type Temperament = "berserker" | "hoarder" | "duelist" | "survivor";
type PerkChoice = "a" | "b" | null;
type Perks = { tier1: PerkChoice; tier2: PerkChoice; tier3: PerkChoice };
type Traits = { bravery: number; greed: number; focus: number };

const CLASSES = new Set(["knight", "mage", "priest"]);
const TEMPERAMENTS = new Set<Temperament>(["berserker", "hoarder", "duelist", "survivor"]);
const PERK_CHOICES = new Set(["a", "b"]);
const MAX_BODY_BYTES = 3072;

const TEMPERAMENT_PRESETS: Record<Temperament, Traits> = {
  berserker: { bravery: 90, greed: 20, focus: 50 },
  hoarder: { bravery: 35, greed: 95, focus: 45 },
  duelist: { bravery: 60, greed: 25, focus: 95 },
  survivor: { bravery: 20, greed: 40, focus: 60 },
};

function bodyByteLength(req: VercelRequest): number {
  const header = req.headers["content-length"];
  const fromHeader = Number(Array.isArray(header) ? header[0] : header);
  if (Number.isFinite(fromHeader) && fromHeader > 0) return fromHeader;
  try {
    return Buffer.byteLength(JSON.stringify(req.body ?? ""), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPerkChoice(value: unknown): value is PerkChoice {
  return value === null || (typeof value === "string" && PERK_CHOICES.has(value));
}

function parseTraits(value: unknown): Traits | null {
  if (!isRecord(value)) return null;
  const { bravery, greed, focus } = value;
  if (
    !isIntInRange(bravery, 0, 100) ||
    !isIntInRange(greed, 0, 100) ||
    !isIntInRange(focus, 0, 100)
  ) {
    return null;
  }
  return { bravery, greed, focus };
}

function parsePerks(value: unknown): Perks | null {
  if (!isRecord(value)) return null;
  const { tier1, tier2, tier3 } = value;
  if (!isPerkChoice(tier1) || !isPerkChoice(tier2) || !isPerkChoice(tier3)) return null;
  return { tier1, tier2, tier3 };
}

/** Map legacy traits sliders to the closest temperament (bravery > greed > focus). */
function temperamentFromTraits(traits: Traits): Temperament {
  if (traits.bravery >= 75) return "berserker";
  if (traits.greed >= 75) return "hoarder";
  if (traits.focus >= 75) return "duelist";
  return "survivor";
}

function parseLoadout(body: unknown):
  | {
      name: string;
      class: "knight" | "mage" | "priest";
      traits: Traits;
      temperament: Temperament;
      perks: Perks;
      permStats: { atk: number; hp: number; spd: number; luck: number; lvl: number };
    }
  | null {
  if (!isRecord(body)) return null;

  const name = body.name;
  if (typeof name !== "string" || name.length < 1 || name.length > 20) return null;

  const heroClass = body.class;
  if (typeof heroClass !== "string" || !CLASSES.has(heroClass)) return null;

  // temperament: optional; derived from traits when omitted
  let temperament: Temperament | null = null;
  if (body.temperament !== undefined) {
    if (typeof body.temperament !== "string" || !TEMPERAMENTS.has(body.temperament as Temperament)) {
      return null;
    }
    temperament = body.temperament as Temperament;
  }

  // traits: required unless temperament is present (then fill from preset)
  let traits: Traits | null = null;
  if (body.traits !== undefined) {
    traits = parseTraits(body.traits);
    if (!traits) return null;
  }

  if (!traits && !temperament) return null;
  if (!traits && temperament) traits = { ...TEMPERAMENT_PRESETS[temperament] };
  if (!temperament && traits) temperament = temperamentFromTraits(traits);

  // perks: optional; default all null
  let perks: Perks;
  if (body.perks === undefined) {
    perks = { tier1: null, tier2: null, tier3: null };
  } else {
    const parsed = parsePerks(body.perks);
    if (!parsed) return null;
    perks = parsed;
  }

  if (!isRecord(body.permStats)) return null;
  const { atk, hp, spd, luck, lvl } = body.permStats;
  if (
    !isIntInRange(atk, 0, 50) ||
    !isIntInRange(hp, 0, 50) ||
    !isIntInRange(spd, 0, 50) ||
    !isIntInRange(luck, 0, 50) ||
    !isIntInRange(lvl, 0, 50)
  ) {
    return null;
  }

  return {
    name,
    class: heroClass as "knight" | "mage" | "priest",
    traits: traits!,
    temperament: temperament!,
    perks,
    permStats: { atk, hp, spd, luck, lvl },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (bodyByteLength(req) > MAX_BODY_BYTES) {
      res.status(400).json({ error: "Body too large (max 3KB)" });
      return;
    }

    const loadout = parseLoadout(req.body);
    if (!loadout) {
      res.status(400).json({ error: "Invalid loadout body" });
      return;
    }

    const id = loadoutBlobKey(loadout.name);
    await put(id, JSON.stringify(loadout), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      // BLOB_READ_WRITE_TOKEN is injected by Vercel
    });

    res.status(200).json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
}
