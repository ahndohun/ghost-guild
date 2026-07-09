import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const CLASSES = new Set(["knight", "mage", "priest"]);
const MAX_BODY_BYTES = 2048;

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

function parseLoadout(body: unknown):
  | {
      name: string;
      class: "knight" | "mage" | "priest";
      traits: { bravery: number; greed: number; focus: number };
      permStats: { atk: number; hp: number; spd: number; luck: number; lvl: number };
    }
  | null {
  if (!isRecord(body)) return null;

  const name = body.name;
  if (typeof name !== "string" || name.length < 1 || name.length > 20) return null;

  const heroClass = body.class;
  if (typeof heroClass !== "string" || !CLASSES.has(heroClass)) return null;

  if (!isRecord(body.traits)) return null;
  const { bravery, greed, focus } = body.traits;
  if (
    !isIntInRange(bravery, 0, 100) ||
    !isIntInRange(greed, 0, 100) ||
    !isIntInRange(focus, 0, 100)
  ) {
    return null;
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
    traits: { bravery, greed, focus },
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
      res.status(400).json({ error: "Body too large (max 2KB)" });
      return;
    }

    const loadout = parseLoadout(req.body);
    if (!loadout) {
      res.status(400).json({ error: "Invalid loadout body" });
      return;
    }

    const id = randomUUID();
    await put(`loadouts/${id}.json`, JSON.stringify(loadout), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      // BLOB_READ_WRITE_TOKEN is injected by Vercel
    });

    res.status(200).json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
}
