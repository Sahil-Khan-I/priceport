import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), ".data", "investigations");

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true });
}

function filePath(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Invalid investigation id");
  }
  return path.join(ROOT, `${id}.json`);
}

export async function saveInvestigation(record) {
  await ensureRoot();
  const target = filePath(record.id);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
  await fs.rename(tmp, target);
  return record;
}

export async function loadInvestigation(id) {
  try {
    const raw = await fs.readFile(filePath(id), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function updateInvestigation(id, updater) {
  const current = await loadInvestigation(id);
  if (!current) return null;
  const next =
    typeof updater === "function" ? await updater(structuredClone(current)) : { ...current, ...updater };
  next.updatedAt = new Date().toISOString();
  await saveInvestigation(next);
  return next;
}

export async function listInvestigations() {
  await ensureRoot();
  const files = await fs.readdir(ROOT);
  const ids = files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  const rows = [];
  for (const id of ids) {
    const row = await loadInvestigation(id);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
