/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect -- node:test fixture models CLI environment keys */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const SECRET_METADATA = [
  {
    name: "VAULT_CERT_PEM",
    byteLength: 160 * 1024,
    sha256: createHash("sha256")
      .update("x".repeat(160 * 1024))
      .digest("hex"),
  },
  {
    name: "VAULT_TOKEN",
    byteLength: Buffer.byteLength("synthetic-note-value"),
    sha256: createHash("sha256").update("synthetic-note-value").digest("hex"),
  },
] as const;

test("provides provider-free help for every CLI command", () => {
  const topics = [
    [["--help"], "rhdh-e2e-secrets exec"],
    [["exec", "--help"], "--profile"],
    [["create", "-h"], "--from-stdin"],
    [["update", "--help"], "--from-file"],
    [["delete", "-h"], "--force"],
    [["describe", "--help"], "--output"],
    [["list", "-h"], "--collection"],
    [["gsm-login", "--help"], "Authenticate"],
    [["gsm-clean", "-h"], "Remove"],
  ] as const;

  for (const [args, expected] of topics) {
    const result = spawnSync(
      process.execPath,
      [path.resolve("dist/secrets/cli.js"), ...args],
      { cwd: path.resolve("."), encoding: "utf8", env: process.env },
    );
    assert.equal(
      result.status,
      0,
      `${args.join(" ")} failed: ${result.stderr}`,
    );
    assert.equal(result.stderr, "", `${args.join(" ")} wrote stderr`);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, new RegExp(expected));
  }
});

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
else if (args[0] === "get" && args[1] === "attachment" && args[2] === "VAULT_CERT_PEM" && args[3] === "--itemid" && args[4] === "attachment-item-id" && args[5] === "--raw") process.stdout.write("x".repeat(160 * 1024));
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
    const expectedMetadata = JSON.stringify(SECRET_METADATA);
    const result = spawnSync(
      entrypoint,
      [
        "exec",
        "--profile",
        profile,
        "--",
        process.execPath,
        "-e",
        [
          "const { createHash } = require('node:crypto');",
          `const expected = ${expectedMetadata};`,
          "const digest = (value) => createHash('sha256').update(value).digest('hex');",
          "const actual = ['VAULT_CERT_PEM', 'VAULT_TOKEN'].map((name) => ({ name, byteLength: Buffer.byteLength(process.env[name] ?? ''), sha256: typeof process.env[name] === 'string' ? digest(process.env[name]) : '' }));",
          "if (JSON.stringify(actual) !== JSON.stringify(expected) || process.env.BW_SESSION !== undefined) process.exit(1);",
          "process.stdout.write('child-ran');",
        ].join(" "),
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
    assert.equal(result.stdout, "child-ran");
    assert.equal(result.stderr, "");
    assert.doesNotMatch(result.stdout, /synthetic-(note|attachment)-value/);
    assert.doesNotMatch(result.stderr, /synthetic-(note|attachment)-value/);
    assert.doesNotMatch(result.stdout, /synthetic-session/);
    assert.doesNotMatch(result.stderr, /synthetic-session/);

    const streamModuleUrl = pathToFileURL(
      path.resolve("dist/secrets/stream.js"),
    ).href;
    const streamed = spawnSync(
      entrypoint,
      [
        "exec",
        "--profile",
        profile,
        "--stream-secrets",
        "--",
        process.execPath,
        "--input-type=module",
        "-e",
        [
          "import fs from 'node:fs';",
          "import { createHash } from 'node:crypto';",
          `import { decodeSecretStream } from ${JSON.stringify(streamModuleUrl)};`,
          `const expected = ${expectedMetadata};`,
          "const entries = decodeSecretStream(fs.readFileSync(3));",
          "const actual = entries.map(({ name, value }) => ({ name, byteLength: Buffer.byteLength(value), sha256: createHash('sha256').update(value).digest('hex') }));",
          "if (JSON.stringify(actual) !== JSON.stringify(expected) || process.env.VAULT_TOKEN !== undefined || process.env.VAULT_CERT_PEM !== undefined || process.env.RHDH_E2E_SECRET_FD !== '3' || process.env.BW_SESSION !== undefined) process.exit(1);",
          "process.stdout.write('child-ran-with-stream');",
        ].join(" "),
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
    assert.equal(streamed.status, 0, streamed.stderr);
    assert.equal(streamed.stdout, "child-ran-with-stream");
    assert.equal(streamed.stderr, "");
    assert.doesNotMatch(streamed.stdout, /synthetic-(note|attachment)-value/);
    assert.doesNotMatch(streamed.stderr, /synthetic-(note|attachment)-value/);
    assert.doesNotMatch(streamed.stdout, /synthetic-session/);
    assert.doesNotMatch(streamed.stderr, /synthetic-session/);

    const childEnvironment = {
      ...process.env,
      PATH: `${directory}${path.delimiter}${process.env.PATH ?? ""}`,
      BW_SESSION: "synthetic-session",
    };
    const ignored = spawnSync(
      entrypoint,
      [
        "exec",
        "--profile",
        profile,
        "--stream-secrets",
        "--",
        process.execPath,
        "-e",
        "process.exit(0)",
      ],
      {
        cwd: path.resolve("."),
        encoding: "utf8",
        env: childEnvironment,
        timeout: 2_000,
      },
    );
    assert.equal(ignored.error, undefined);
    assert.notEqual(ignored.status, null);
    assert.doesNotMatch(ignored.stdout, /synthetic-(note|attachment)-value/);
    assert.doesNotMatch(ignored.stderr, /synthetic-(note|attachment)-value/);
    assert.doesNotMatch(ignored.stdout, /synthetic-session/);
    assert.doesNotMatch(ignored.stderr, /synthetic-session/);

    const earlyClosed = spawnSync(
      entrypoint,
      [
        "exec",
        "--profile",
        profile,
        "--stream-secrets",
        "--",
        process.execPath,
        "-e",
        "if (process.env.VAULT_CERT_PEM !== undefined || process.env.VAULT_TOKEN !== undefined || process.env.RHDH_E2E_SECRET_FD !== '3' || process.env.BW_SESSION !== undefined) process.exit(18); require('node:fs').closeSync(3); setTimeout(() => process.exit(17), 50)",
      ],
      {
        cwd: path.resolve("."),
        encoding: "utf8",
        env: childEnvironment,
        timeout: 2_000,
      },
    );
    assert.equal(earlyClosed.error, undefined);
    assert.equal(earlyClosed.status, 17, earlyClosed.stderr);
    assert.doesNotMatch(
      earlyClosed.stdout,
      /synthetic-(note|attachment)-value/,
    );
    assert.doesNotMatch(
      earlyClosed.stderr,
      /synthetic-(note|attachment)-value/,
    );
    assert.doesNotMatch(earlyClosed.stdout, /synthetic-session/);
    assert.doesNotMatch(earlyClosed.stderr, /synthetic-session/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
