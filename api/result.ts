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

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResult(body: unknown):
  | {
      name: string;
      class: "knight" | "mage" | "priest";
      score: number;
      kills: number;
      survived: boolean;
      timeMs: number;
    }
  | null {
  if (!isRecord(body)) return null;

  const name = body.name;
  if (typeof name !== "string" || name.length < 1 || name.length > 20) return null;

  const heroClass = body.class;
  if (typeof heroClass !== "string" || !CLASSES.has(heroClass)) return null;

  if (!isInt(body.score)) return null;
  if (!isInt(body.kills) || body.kills < 0) return null;
  if (typeof body.survived !== "boolean") return null;
  if (!isInt(body.timeMs) || body.timeMs < 0) return null;

  return {
    name,
    class: heroClass as "knight" | "mage" | "priest",
    score: body.score,
    kills: body.kills,
    survived: body.survived,
    timeMs: body.timeMs,
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

    const result = parseResult(req.body);
    if (!result) {
      res.status(400).json({ error: "Invalid result body" });
      return;
    }

    const id = randomUUID();
    await put(`results/${id}.json`, JSON.stringify(result), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      // BLOB_READ_WRITE_TOKEN is injected by Vercel
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
}
