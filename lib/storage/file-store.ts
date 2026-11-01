import { promises as fs } from "node:fs";
import path from "node:path";
import { atomicWriteFile, withKeyLock } from "#atomic-file";

const DEFAULT_ROOT = path.join(process.cwd(), ".data", "investigations");
let rootDir = DEFAULT_ROOT;

export function setInvestigationStoreRoot(dir: string | null) {
  rootDir = dir || DEFAULT_ROOT;
}

async function ensureRoot() {
  await fs.mkdir(rootDir, { recursive: true });
}

function filePath(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Invalid investigation id");
  }
  return path.join(rootDir, `${id}.json`);
}

async function writeRecord(record: any) {
  await ensureRoot();
  await atomicWriteFile(filePath(record.id), JSON.stringify(record, null, 2));
  return record;
}

export async function saveInvestigation(record: any) {
  return withKeyLock(String(record.id), () => writeRecord(record));
}

export async function loadInvestigation(id: string) {
  try {
    const raw = await fs.readFile(filePath(id), "utf8");
    return JSON.parse(raw);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function updateInvestigation(
  id: string,
  updater: ((current: any) => any | Promise<any>) | Record<string, any>,
) {
  return withKeyLock(id, async () => {
    const current = await loadInvestigation(id);
    if (!current) return null;
    const next =
      typeof updater === "function"
        ? await updater(structuredClone(current))
        : { ...current, ...updater };
    next.updatedAt = new Date().toISOString();
    await writeRecord(next);
    return next;
  });
}

export async function listInvestigations() {
  await ensureRoot();
  const files = await fs.readdir(rootDir);
  const ids = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
  const rows: any[] = [];
  for (const id of ids) {
    const row = await loadInvestigation(id);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
}
