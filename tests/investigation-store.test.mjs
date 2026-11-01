import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  atomicWriteFile,
  uniqueTempPath,
  withKeyLock,
} from "../lib/storage/atomic-file.ts";
import {
  loadInvestigation,
  saveInvestigation,
  setInvestigationStoreRoot,
  updateInvestigation,
} from "../lib/storage/file-store.ts";

const dir = await mkdtemp(path.join(tmpdir(), "priceport-store-"));
setInvestigationStoreRoot(dir);

after(async () => {
  setInvestigationStoreRoot(null);
  await rm(dir, { recursive: true, force: true });
});

describe("investigation update queue", () => {
  it("keeps every concurrent event and job update", async () => {
    await saveInvestigation({
      id: "inv_one",
      createdAt: "2026-11-01T00:00:00.000Z",
      events: [],
      jobs: [
        { id: "job_a", status: "queued" },
        { id: "job_b", status: "queued" },
      ],
    });

    await Promise.all([
      ...Array.from({ length: 25 }, (_, index) =>
        updateInvestigation("inv_one", (record) => {
          record.events.push({ id: `evt_${index}` });
          return record;
        }),
      ),
      updateInvestigation("inv_one", (record) => {
        record.jobs = record.jobs.map((job) =>
          job.id === "job_a" ? { ...job, status: "completed", offer: { totalPrice: 90 } } : job,
        );
        return record;
      }),
      updateInvestigation("inv_one", (record) => {
        record.jobs = record.jobs.map((job) =>
          job.id === "job_b" ? { ...job, status: "timed_out" } : job,
        );
        return record;
      }),
    ]);

    const saved = await loadInvestigation("inv_one");
    assert.equal(saved.events.length, 25);
    assert.equal(saved.jobs.find((job) => job.id === "job_a").status, "completed");
    assert.equal(saved.jobs.find((job) => job.id === "job_a").offer.totalPrice, 90);
    assert.equal(saved.jobs.find((job) => job.id === "job_b").status, "timed_out");
  });

  it("updates different investigations at the same time", async () => {
    await saveInvestigation({ id: "inv_left", events: [], jobs: [] });
    await saveInvestigation({ id: "inv_right", events: [], jobs: [] });
    await Promise.all([
      updateInvestigation("inv_left", (record) => {
        record.events.push({ id: "left" });
        return record;
      }),
      updateInvestigation("inv_right", (record) => {
        record.events.push({ id: "right" });
        return record;
      }),
    ]);
    assert.equal((await loadInvestigation("inv_left")).events[0].id, "left");
    assert.equal((await loadInvestigation("inv_right")).events[0].id, "right");
  });

  it("does not leave a lock stuck after a failed update", async () => {
    await saveInvestigation({ id: "inv_fail", events: [], jobs: [] });
    await assert.rejects(
      updateInvestigation("inv_fail", async () => {
        throw new Error("updater failed");
      }),
      /updater failed/,
    );
    const next = await updateInvestigation("inv_fail", (record) => {
      record.events.push({ id: "after-failure" });
      return record;
    });
    assert.equal(next.events.length, 1);
  });
});

describe("atomic files", () => {
  it("uses a different temporary name for every write", () => {
    const target = path.join(dir, "same.json");
    const names = new Set(Array.from({ length: 20 }, () => uniqueTempPath(target)));
    assert.equal(names.size, 20);
    for (const name of names) {
      assert.equal(path.dirname(name), path.dirname(target));
      assert.match(name, /\.tmp$/);
    }
  });

  it("removes only its temporary file when the write fails", async () => {
    const removed = [];
    const writeError = Object.assign(new Error("disk full"), { code: "ENOSPC" });
    await assert.rejects(
      atomicWriteFile(path.join(dir, "write.json"), "{}", {
        writeFile: async (tmp) => {
          removed.push(tmp);
          throw writeError;
        },
        rename: async () => {},
        unlink: async (tmp) => {
          assert.equal(tmp, removed[0]);
        },
      }),
      (error) => error === writeError,
    );
  });

  it("removes only its temporary file when the rename fails", async () => {
    let temp = "";
    const renameError = Object.assign(new Error("rename failed"), { code: "ENOENT" });
    await assert.rejects(
      atomicWriteFile(path.join(dir, "rename.json"), "{}", {
        writeFile: async (tmp) => {
          temp = tmp;
        },
        rename: async () => {
          throw renameError;
        },
        unlink: async (tmp) => {
          assert.equal(tmp, temp);
        },
      }),
      (error) => error === renameError,
    );
    const files = await readdir(dir);
    assert.equal(files.some((file) => file.includes("rename.json") && file.endsWith(".tmp")), false);
  });
});

describe("lock queue", () => {
  it("runs one key in order and lets another key overlap", async () => {
    const order = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    const first = withKeyLock("same", async () => {
      order.push("first-start");
      await firstGate;
      order.push("first-end");
    });
    const second = withKeyLock("same", async () => {
      order.push("second");
    });
    const other = withKeyLock("other", async () => {
      order.push("other");
    });
    await other;
    assert.deepEqual(order, ["first-start", "other"]);
    releaseFirst();
    await Promise.all([first, second]);
    assert.deepEqual(order, ["first-start", "other", "first-end", "second"]);
  });
});
