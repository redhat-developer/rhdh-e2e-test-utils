/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect -- node:test fixture models CLI environment keys */

import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BitwardenClient } from "./bitwarden.js";
import type { ExpandedSecretSelector } from "./config.js";

const selector: ExpandedSecretSelector = {
  prefix: "global/",
  optional: false,
  destination: {
    kind: "environment",
    stripPrefix: "global/",
    requirePrefix: "VAULT_",
    keyTransform: "legacy-env",
  },
};

test("reads secure notes through the real command runner and a fake bw executable", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "bitwarden-cli-test-"),
  );
  const command = path.join(directory, "bw");
  await writeFile(
    command,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "--version") process.stdout.write("2026.5.0\\n");
else if (args[0] === "status") process.stdout.write(JSON.stringify({ status: "unlocked" }));
else if (args[0] === "sync") {}
else if (args[0] === "list" && args[1] === "collections") process.stdout.write(JSON.stringify([{ id: "collection-id", name: "Rhdh Qe Ci Secrets", organizationId: "organization-id" }]));
else if (args[0] === "list" && args[1] === "items") process.stdout.write(JSON.stringify([{ id: "item-id" }]));
else if (args[0] === "get" && args[1] === "item") process.stdout.write(JSON.stringify({ id: args[2], name: "global/VAULT_TOKEN", notes: "synthetic-value", type: 2, collectionIds: ["collection-id"], organizationId: "organization-id" }));
else process.exitCode = 1;
`,
  );
  await chmod(command, 0o755);

  try {
    const secrets = await new BitwardenClient({
      command,
      env: { BW_SESSION: "synthetic-session" },
    }).read("rhdh-qe", [selector]);
    assert.equal(secrets[0]?.name, "global/VAULT_TOKEN");
    assert.equal(secrets[0]?.value, "synthetic-value");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
