/* eslint-disable playwright/expect-expect -- node:test assertions */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  executeMutation,
  type MutationBitwarden,
  type MutationGsm,
} from "../mutation.js";
import type { BitwardenSecretItem } from "../bitwarden.js";

function item(
  value: string,
  storage: "note" | "attachment" = "note",
): BitwardenSecretItem {
  return {
    id: "item-id",
    name: "rhdh/test",
    value,
    storage,
    revisionDate: "revision-1",
    raw: {},
    attachments:
      storage === "attachment"
        ? [{ id: "attachment-id", fileName: "test" }]
        : [],
    ...(storage === "attachment"
      ? { attachment: { id: "attachment-id", fileName: "test" } }
      : {}),
  };
}

function gsm(overrides: Partial<MutationGsm> = {}): MutationGsm {
  return {
    exists: async () => false,
    create: async () => undefined,
    update: async () => undefined,
    delete: async () => undefined,
    ...overrides,
  };
}

test("dry-run creates one value-free plan and performs no writes", async () => {
  const calls: string[] = [];
  const bitwarden: MutationBitwarden = {
    findItem: async () => {
      calls.push("bitwarden-find");
      return undefined;
    },
    createItem: async () => {
      calls.push("bitwarden-create");
      throw new Error("must not write");
    },
    updateItem: async () => {
      calls.push("bitwarden-update");
      throw new Error("must not write");
    },
    deleteItem: async () => {
      calls.push("bitwarden-delete");
      throw new Error("must not write");
    },
  };
  const result = await executeMutation({
    command: "create",
    collection: "rhdh-qe",
    bitwardenPath: "rhdh/test",
    fromStdin: true,
    stdin: ["new-value"],
    dryRun: true,
    bitwarden,
    gsm: gsm(),
  });

  assert.deepEqual(result, {
    state: "dry-run",
    plan: {
      command: "create",
      collection: "rhdh-qe",
      bitwardenCollection: "Rhdh Qe Ci Secrets",
      gsmCollection: "rhdh-qe",
      bitwardenPath: "rhdh/test",
      gsmPath: "rhdh/test",
      byteLength: 9,
      storage: "note",
      bitwardenAction: "create",
      gsmAction: "create",
    },
  });
  assert.deepEqual(calls, ["bitwarden-find"]);
});

test("decodes GSM dot encoding only for Bitwarden lookups", async () => {
  const calls: string[] = [];
  const result = await executeMutation({
    command: "create",
    collection: "rhdh-qe",
    bitwardenPath: "rhdh/rds-db-certificates--dot--pem",
    fromStdin: true,
    stdin: ["new-value"],
    dryRun: true,
    bitwarden: {
      findItem: async (_collection, name) => {
        calls.push(`bitwarden:${name}`);
        return undefined;
      },
      createItem: async () => item("new-value"),
      updateItem: async () => item("new-value"),
      deleteItem: async () => undefined,
    },
    gsm: gsm({
      exists: async (_collection, name) => {
        calls.push(`gsm:${name}`);
        return false;
      },
    }),
  });

  assert.deepEqual(calls, [
    "bitwarden:rhdh/rds-db-certificates.pem",
    "gsm:rhdh/rds-db-certificates--dot--pem",
  ]);
  assert.equal(result.plan.bitwardenPath, "rhdh/rds-db-certificates.pem");
  assert.equal(result.plan.gsmPath, "rhdh/rds-db-certificates--dot--pem");
});

test("forced create reconciles existing providers and converts Bitwarden storage", async () => {
  const calls: string[] = [];
  const bitwarden: MutationBitwarden = {
    findItem: async () => item("old-value", "note"),
    createItem: async () => {
      calls.push("bitwarden-create");
      return item("new-value", "attachment");
    },
    updateItem: async (_item, value, storage) => {
      calls.push(`bitwarden-update:${value}:${storage}`);
      return item(value, storage);
    },
    deleteItem: async () => {
      calls.push("bitwarden-delete");
    },
  };
  const gsmClient = gsm({
    exists: async () => true,
    update: async () => {
      calls.push("gsm-update");
    },
  });

  const result = await executeMutation({
    command: "create",
    collection: "rhdh-qe",
    bitwardenPath: "rhdh/test",
    fromFile: "replacement.txt",
    readFile: async () => Buffer.from("replacement-value"),
    force: true,
    bitwarden,
    gsm: gsmClient,
  });

  assert.equal(result.state, "applied");
  assert.deepEqual(result.plan, {
    command: "create",
    collection: "rhdh-qe",
    bitwardenCollection: "Rhdh Qe Ci Secrets",
    gsmCollection: "rhdh-qe",
    bitwardenPath: "rhdh/test",
    gsmPath: "rhdh/test",
    byteLength: 17,
    storage: "attachment",
    existingStorage: "note",
    bitwardenAction: "update",
    gsmAction: "update",
  });
  assert.deepEqual(calls, [
    "bitwarden-update:replacement-value:attachment",
    "gsm-update",
  ]);
});

test("checks the interactive terminal before writing Bitwarden for GSM create", async () => {
  const calls: string[] = [];
  await executeMutation({
    command: "create",
    collection: "rhdh-qe",
    bitwardenPath: "rhdh/test",
    fromStdin: true,
    stdin: ["new-value"],
    bitwarden: {
      findItem: async () => undefined,
      createItem: async () => {
        calls.push("bitwarden-create");
        return item("new-value");
      },
      updateItem: async () => item("new-value"),
      deleteItem: async () => undefined,
    },
    gsm: gsm({
      ensureInteractive: async () => {
        calls.push("gsm-ensure-interactive");
      },
      create: async () => {
        calls.push("gsm-create");
      },
    }),
  });

  assert.deepEqual(calls, [
    "gsm-ensure-interactive",
    "bitwarden-create",
    "gsm-create",
  ]);
});

test("normal create rejects a one-sided existing target before writing", async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      executeMutation({
        command: "create",
        collection: "rhdh-qe",
        bitwardenPath: "rhdh/test",
        fromStdin: true,
        stdin: ["new-value"],
        bitwarden: {
          findItem: async () => item("old-value"),
          createItem: async () => {
            calls.push("bitwarden-create");
            return item("new-value");
          },
          updateItem: async () => item("new-value"),
          deleteItem: async () => undefined,
        },
        gsm: gsm(),
      }),
    /already exists.*force/i,
  );
  assert.deepEqual(calls, []);
});

test("update writes Bitwarden before GSM and reports a retry without a resume id", async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      executeMutation({
        command: "update",
        collection: "rhdh-qe",
        bitwardenPath: "rhdh/test",
        fromStdin: true,
        stdin: ["new-value"],
        bitwarden: {
          findItem: async () => item("old-value"),
          createItem: async () => item("new-value"),
          updateItem: async (_item, value) => {
            calls.push("bitwarden-update");
            return item(value);
          },
          deleteItem: async () => undefined,
        },
        gsm: gsm({
          exists: async () => true,
          update: async () => {
            calls.push("gsm-update");
            throw new Error("GSM unavailable");
          },
        }),
      }),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /GSM unavailable/);
      assert.match(error.message, /retry/i);
      assert.doesNotMatch(error.message, /resume|operation id/i);
      return true;
    },
  );
  assert.deepEqual(calls, ["bitwarden-update", "gsm-update"]);
});

test("preserves force guidance after a forced partial delete fails", async () => {
  await assert.rejects(
    () =>
      executeMutation({
        command: "delete",
        collection: "rhdh-qe",
        bitwardenPath: "rhdh/test",
        force: true,
        bitwarden: {
          findItem: async () => undefined,
          createItem: async () => item("unused"),
          updateItem: async () => item("unused"),
          deleteItem: async () => undefined,
        },
        gsm: gsm({
          exists: async () => true,
          delete: async () => {
            throw new Error("GSM unavailable");
          },
        }),
      }),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /retry the delete command with --force/i);
      return true;
    },
  );
});

test("reports reconciliation guidance when Bitwarden may have changed", async () => {
  await assert.rejects(
    () =>
      executeMutation({
        command: "create",
        collection: "rhdh-qe",
        bitwardenPath: "rhdh/test",
        fromStdin: true,
        stdin: ["new-value"],
        force: true,
        bitwarden: {
          findItem: async () => undefined,
          createItem: async () => {
            throw new Error("Bitwarden response lost after create");
          },
          updateItem: async () => item("unused"),
          deleteItem: async () => undefined,
        },
        gsm: gsm(),
      }),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /may have been updated|Bitwarden/i);
      assert.match(error.message, /--force/);
      return true;
    },
  );
});

test("rejects delete input options at the library boundary", async () => {
  await assert.rejects(
    () =>
      executeMutation({
        command: "delete",
        collection: "rhdh-qe",
        bitwardenPath: "rhdh/test",
        fromFile: "secret.txt",
        bitwarden: {
          findItem: async () => undefined,
          createItem: async () => item("unused"),
          updateItem: async () => item("unused"),
          deleteItem: async () => undefined,
        },
        gsm: gsm(),
      }),
    /delete does not accept input options/i,
  );
});

test("uses one lock for equivalent GSM path spellings", async () => {
  const lockDirectory = await mkdtemp(
    path.join(os.tmpdir(), "rhdh-e2e-mutation-lock-test-"),
  );
  let active = 0;
  let maximumActive = 0;
  const bitwarden: MutationBitwarden = {
    findItem: async () => undefined,
    createItem: async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 25));
      active--;
      return item("new-value");
    },
    updateItem: async () => item("new-value"),
    deleteItem: async () => undefined,
  };
  const options = {
    command: "create" as const,
    collection: "rhdh-qe",
    fromStdin: true,
    stdin: ["new-value"],
    force: true,
    lockDirectory,
    bitwarden,
    gsm: gsm(),
  };

  try {
    const results = await Promise.allSettled([
      executeMutation({ ...options, bitwardenPath: "rhdh/test.pem" }),
      executeMutation({ ...options, bitwardenPath: "rhdh/test--dot--pem" }),
    ]);
    assert.equal(maximumActive, 1);
    assert.equal(
      results.filter((result) => result.status === "rejected").length,
      1,
    );
  } finally {
    await rm(lockDirectory, { recursive: true, force: true });
  }
});

test("forced delete removes existing targets and accepts an absent provider", async () => {
  const calls: string[] = [];
  const result = await executeMutation({
    command: "delete",
    collection: "rhdh-qe",
    bitwardenPath: "rhdh/test",
    force: true,
    bitwarden: {
      findItem: async () => item("old-value"),
      createItem: async () => item("unused"),
      updateItem: async () => item("unused"),
      deleteItem: async () => {
        calls.push("bitwarden-delete");
      },
    },
    gsm: gsm({
      exists: async () => false,
      delete: async () => {
        calls.push("gsm-delete");
      },
    }),
  });

  assert.equal(result.state, "applied");
  assert.equal(result.plan.bitwardenAction, "delete");
  assert.equal(result.plan.gsmAction, "skip");
  assert.deepEqual(calls, ["bitwarden-delete"]);
});

test("normal delete rejects an absent provider unless forced", async () => {
  await assert.rejects(
    () =>
      executeMutation({
        command: "delete",
        collection: "rhdh-qe",
        bitwardenPath: "rhdh/test",
        bitwarden: {
          findItem: async () => undefined,
          createItem: async () => item("unused"),
          updateItem: async () => item("unused"),
          deleteItem: async () => undefined,
        },
        gsm: gsm({ exists: async () => true }),
      }),
    /absent.*force/i,
  );
});
