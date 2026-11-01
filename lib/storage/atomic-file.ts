import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

const tails = new Map<string, Promise<void>>();

export function uniqueTempPath(target: string) {
  return `${target}.${process.pid}.${randomUUID()}.tmp`;
}

type FileIO = {
  writeFile: (path: string, data: string, encoding: "utf8") => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  unlink: (path: string) => Promise<void>;
};

/** Write beside the target, then rename. Only this call's temp file is removed on failure. */
export async function atomicWriteFile(
  target: string,
  contents: string,
  io: FileIO = fs,
) {
  const tmp = uniqueTempPath(target);
  try {
    await io.writeFile(tmp, contents, "utf8");
    await io.rename(tmp, target);
  } catch (error) {
    await io.unlink(tmp).catch(() => {});
    throw error;
  }
}

/**
 * One in-flight operation per key. A failure does not block the next caller.
 * Idle keys are removed after the queue drains.
 */
export function withKeyLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, settled);
  void settled.then(() => {
    if (tails.get(key) === settled) tails.delete(key);
  });
  return run;
}
