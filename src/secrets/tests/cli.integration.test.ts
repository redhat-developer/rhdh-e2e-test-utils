/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect -- node:test fixture models CLI environment keys */

import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("runs the package bin with a fake bw executable and redacted child auth", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "secrets-cli-test-"));
  const command = path.join(directory, "bw");
  const profile = path.join(directory, "profile.json");
  const entrypoint = path.join(directory, "rhdh-e2e-secrets");
  await symlink(path.resolve("dist/secrets/cli.js"), entrypoint);
  await writeFile(
    command,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "--version") process.stdout.write("2026.5.0\\n");
else if (args[0] === "status") process.stdout.write(JSON.stringify({ status: "unlocked" }));
else if (args[0] === "sync") {}
else if (args[0] === "list" && args[1] === "collections") process.stdout.write(JSON.stringify([{ id: "collection-id", name: "Rhdh Qe Ci Secrets", organizationId: "organization-id" }]));
else if (args[0] === "list" && args[1] === "items") process.stdout.write(JSON.stringify([{ id: "note-item-id" }, { id: "attachment-item-id" }]));
else if (args[0] === "get" && args[1] === "item" && args[2] === "note-item-id") process.stdout.write(JSON.stringify({ id: "note-item-id", name: "global/VAULT_TOKEN", notes: "synthetic-note-value", type: 2, collectionIds: ["collection-id"], organizationId: "organization-id" }));
else if (args[0] === "get" && args[1] === "item" && args[2] === "attachment-item-id") process.stdout.write(JSON.stringify({ id: "attachment-item-id", name: "global/VAULT_CERT_PEM", notes: null, type: 2, collectionIds: ["collection-id"], organizationId: "organization-id", attachments: [{ id: "attachment-id", fileName: "VAULT_CERT_PEM" }] }));
else if (args[0] === "get" && args[1] === "attachment" && args[2] === "VAULT_CERT_PEM" && args[3] === "--itemid" && args[4] === "attachment-item-id" && args[5] === "--raw") process.stdout.write("synthetic-attachment-value");
else process.exitCode = 1;
`,
  );
  await chmod(command, 0o755);
  await writeFile(
    profile,
    JSON.stringify({
      schemaVersion: 1,
      collection: "rhdh-qe",
      selectors: [
        {
          prefix: "global/",
          destination: {
            kind: "environment",
            stripPrefix: "global/",
            requirePrefix: "VAULT_",
            keyTransform: "legacy-env",
          },
        },
      ],
    }),
  );

  try {
    const result = spawnSync(
      entrypoint,
      [
        "exec",
        "--profile",
        profile,
        "--",
        process.execPath,
        "-e",
        "if (process.env.VAULT_TOKEN === 'synthetic-note-value' && process.env.VAULT_CERT_PEM === 'synthetic-attachment-value' && process.env.BW_SESSION === undefined) process.stdout.write('child-ran'); else process.exit(1)",
      ],
      {
        cwd: path.resolve("."),
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${directory}${path.delimiter}${process.env.PATH ?? ""}`,
          BW_SESSION: "synthetic-session",
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /child-ran/);
    assert.doesNotMatch(result.stdout, /synthetic-(note|attachment)-value/);
    assert.doesNotMatch(result.stderr, /synthetic-(note|attachment)-value/);
    assert.doesNotMatch(result.stdout, /synthetic-session/);
    assert.doesNotMatch(result.stderr, /synthetic-session/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
