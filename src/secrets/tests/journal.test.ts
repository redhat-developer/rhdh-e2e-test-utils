/* eslint-disable playwright/expect-expect -- node:test assertions */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JournalStore } from "../journal.js";

test("writes non-secret rotation journals atomically with restrictive permissions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rotation-journal-test-"));
  try {
    const store = new JournalStore(root);
    const record = await store.create({
      collection: "rhdh-qe",
      bitwardenPath: "rhdh/test",
      gsmPath: "rhdh/test",
      itemId: "item-id",
      itemName: "rhdh/test",
      storage: "note",
      revisionDate: "2026-09-10T10:00:00.000Z",
      state: "bitwarden-pending",
      gsmStatus: "not-started",
    });
    const loaded = await store.read(record.id);
    assert.equal(loaded.id, record.id);
    assert.equal(
      (await stat(path.join(root, `${record.id}.json`))).mode & 0o777,
      0o600,
    );
    assert.doesNotMatch(
      await readFile(path.join(root, `${record.id}.json`), "utf8"),
      /synthetic-secret/,
    );

    await store.update(record.id, {
      state: "gsm-succeeded",
      gsmStatus: "succeeded",
    });
    assert.equal((await store.read(record.id)).state, "gsm-succeeded");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects journal records containing secret-shaped fields", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rotation-journal-test-"));
  try {
    const store = new JournalStore(root);
    await assert.rejects(() => store.read("../outside"), /rotation ID/i);
    await assert.rejects(
      () => store.create({ value: "synthetic-secret" } as never),
      /secret fields/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
