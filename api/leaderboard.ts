import { list } from "@vercel/blob";

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type ResultEntry = {
  name: string;
  class: string;
  score: number;
  survived: boolean;
  temperament?: string;
};

function isResultEntry(value: unknown): value is ResultEntry & {
  kills?: number;
  timeMs?: number;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== "string") return false;
  if (typeof obj.class !== "string") return false;
  if (typeof obj.score !== "number" || !Number.isFinite(obj.score)) return false;
  if (typeof obj.survived !== "boolean") return false;
  if (obj.temperament !== undefined && typeof obj.temperament !== "string") return false;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // BLOB_READ_WRITE_TOKEN is injected by Vercel
    const { blobs } = await list({
      prefix: "results/",
      limit: 200,
    });

    const bestByName = new Map<string, ResultEntry>();

    for (const blob of blobs) {
      try {
        const response = await fetch(blob.url);
        if (!response.ok) continue;
        const data: unknown = await response.json();
        if (!isResultEntry(data)) continue;

        const entry: ResultEntry = {
          name: data.name,
          class: data.class,
          score: data.score,
          survived: data.survived,
          ...(data.temperament !== undefined ? { temperament: data.temperament } : {}),
        };

        const existing = bestByName.get(entry.name);
        if (!existing || entry.score > existing.score) {
          bestByName.set(entry.name, entry);
        }
      } catch {
        // skip unreadable blobs
      }
    }

    const leaderboard = Array.from(bestByName.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ name, class: heroClass, score, survived, temperament }) => ({
        name,
        class: heroClass,
        score,
        survived,
        ...(temperament !== undefined ? { temperament } : {}),
      }));

    res.status(200).json(leaderboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
}
