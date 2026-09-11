/* eslint-disable playwright/expect-expect, playwright/no-conditional-in-test -- node:test assertions */

import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JournalStore } from "../journal.js";
import {
  executeRotation,
  type RotationBitwarden,
  type RotationGsm,
} from "../rotation.js";
import type { BitwardenRotationItem } from "../bitwarden.js";

function item(
  value: string,
  revisionDate = "revision-1",
): BitwardenRotationItem {
  return {
    id: "item-id",
    name: "rhdh/test",
    value,
    storage: "note",
    revisionDate,
    raw: {},
    attachments: [],
  };
}

test("dry-run validates both targets and the input without creating a journal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rotation-test-"));
  const calls: string[] = [];
  try {
    const result = await executeRotation({
      collection: "rhdh-qe",
      bitwardenPath: "rhdh/test",
      fromStdin: true,
      stdin: ["new-value"],
      apply: false,
      journal: new JournalStore(root),
      bitwarden: {
        readRotationItem: async () => {
          calls.push("bitwarden-read");
          return item("old-value");
        },
        updateRotationItem: async () => {
          throw new Error("must not write");
        },
      },
      gsm: {
        describe: async () => {
          calls.push("gsm-describe");
          return {};
        },
        update: async () => {
          throw new Error("must not write");
        },
      },
    });
    assert.deepEqual(result, {
      state: "dry-run",
      byteLength: 9,
      storage: "note",
      gsmPath: "rhdh/test",
    });
    assert.deepEqual(calls, ["bitwarden-read", "gsm-describe"]);
    assert.deepEqual(
      (await readdir(root)).filter((entry) => entry.endsWith(".json")),
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resumes a GSM failure using the verified Bitwarden value", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rotation-test-"));
  let current = item("old-value");
  let gsmAttempts = 0;
  try {
    const bitwarden: RotationBitwarden = {
      readRotationItem: async () => current,
      updateRotationItem: async (_item, value) => {
        current = item(value, "revision-2");
        return current;
      },
    };
    const gsm: RotationGsm = {
      describe: async () => ({}),
      update: async () => {
        gsmAttempts += 1;
        if (gsmAttempts === 1) throw new Error("GSM unavailable");
      },
    };
    const first = await assert.rejects(
      () =>
        executeRotation({
          collection: "rhdh-qe",
          bitwardenPath: "rhdh/test",
          fromStdin: true,
          stdin: ["new-value"],
          apply: true,
          journal: new JournalStore(root),
          bitwarden,
          gsm,
        }),
      (error: unknown) =>
        error instanceof Error &&
        /GSM unavailable/.test(error.message) &&
        typeof (error as Error & { operationId?: unknown }).operationId ===
          "string",
    );
    assert.equal(first, undefined);

    const journalFiles = (await readdir(root)).filter((entry) =>
      entry.endsWith(".json"),
    );
    assert.equal(journalFiles.length, 1);
    const operationId = journalFiles[0]!.replace(/\.json$/, "");
    const resumed = await executeRotation({
      resumeId: operationId,
      apply: true,
      journal: new JournalStore(root),
      bitwarden,
      gsm,
    });
    assert.deepEqual(resumed, {
      state: "gsm-succeeded",
      operationId,
      gsmPath: "rhdh/test",
    });
    assert.equal(gsmAttempts, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects resume after Bitwarden changed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rotation-test-"));
  try {
    const journal = new JournalStore(root);
    const bitwarden: RotationBitwarden = {
      readRotationItem: async () => item("changed-value", "revision-3"),
      updateRotationItem: async () => item("unused"),
    };
    const gsm: RotationGsm = {
      describe: async () => ({}),
      update: async () => undefined,
    };
    await journal.create({
      collection: "rhdh-qe",
      bitwardenPath: "rhdh/test",
      gsmPath: "rhdh/test",
      itemId: "item-id",
      itemName: "rhdh/test",
      storage: "note",
      revisionDate: "revision-2",
      state: "gsm-failed",
      gsmStatus: "failed",
    });
    const [file] = await readdir(root);
    const operationId = file!.replace(/\.json$/, "");
    await assert.rejects(
      () =>
        executeRotation({
          resumeId: operationId,
          apply: true,
          journal,
          bitwarden,
          gsm,
        }),
      /revision changed/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
