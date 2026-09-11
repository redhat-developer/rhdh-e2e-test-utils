/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect, playwright/no-conditional-in-test -- node:test fixtures model process environment keys */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { executeCommand, runChild, type ChildRunner } from "../exec.js";
import type { BitwardenSecret } from "../bitwarden.js";
import type { SecretProfile } from "../config.js";

const profile: SecretProfile = {
  schemaVersion: 1,
  collection: "rhdh-plugin-export-overlays",
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
};

const secret: BitwardenSecret = {
  id: "secret-id",
  name: "global/VAULT_TOKEN",
  value: "synthetic-value",
  selector: {
    ...profile.selectors[0]!,
    optional: false,
  },
};

test("executes a command with only selected secrets in its child environment", async () => {
  let received:
    | { command: string; args: readonly string[]; env: NodeJS.ProcessEnv }
    | undefined;
  const childRunner: ChildRunner = async (command, args, env) => {
    received = { command, args, env };
    return 0;
  };
  const client = { read: async () => [secret] };

  const exitCode = await executeCommand({
    profile,
    workspaces: [],
    command: "playwright",
    args: ["test", "--project", "github"],
    env: {
      PATH: "/usr/bin",
      BW_SESSION: "synthetic-session",
      EXISTING_VALUE: "preserved",
    },
    client,
    childRunner,
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(received?.args, ["test", "--project", "github"]);
  assert.equal(received?.command, "playwright");
  assert.equal(received?.env.VAULT_TOKEN, "synthetic-value");
  assert.equal(received?.env.EXISTING_VALUE, "preserved");
  assert.equal(received?.env.BW_SESSION, undefined);
});

test("validates all selected mappings before starting the child", async () => {
  let childStarted = false;
  const childRunner: ChildRunner = async () => {
    childStarted = true;
    return 0;
  };
  const client = {
    read: async () => {
      throw new Error("required prefix has no matching item");
    },
  };

  await assert.rejects(
    () =>
      executeCommand({
        profile,
        workspaces: [],
        command: "playwright",
        args: [],
        env: { BW_SESSION: "synthetic-session" },
        client,
        childRunner,
      }),
    /required prefix/i,
  );
  assert.equal(childStarted, false);
});

test("propagates the real child exit code", async () => {
  const exitCode = await runChild(
    process.execPath,
    ["-e", "process.exit(17)"],
    {
      ...process.env,
    },
  );
  assert.equal(exitCode, 17);
});

test("returns the shell-compatible status for a signal-terminated child", async () => {
  const exitCode = await runChild(
    process.execPath,
    ["-e", "process.kill(process.pid, 'SIGTERM')"],
    { ...process.env },
  );
  assert.equal(exitCode, 143);
});

test("forwards termination to descendants in the child process group", async () => {
  if (process.platform === "win32") return;
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "rhdh-e2e-exec-test-"),
  );
  const marker = path.join(directory, "terminated");
  const ready = path.join(directory, "ready");
  const pidFile = path.join(directory, "pid");
  let descendantPid: number | undefined;
  try {
    const descendantScript = [
      "const fs = require('node:fs');",
      `process.on('SIGTERM', () => { fs.writeFileSync(${JSON.stringify(marker)}, 'terminated'); process.exit(0); });`,
      `fs.writeFileSync(${JSON.stringify(ready)}, 'ready');`,
      "setTimeout(() => {}, 10000);",
    ].join(" ");
    const parentScript = [
      "const fs = require('node:fs');",
      "const { spawn } = require('node:child_process');",
      `const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendantScript)}], { stdio: 'ignore' });`,
      `fs.writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));`,
      "setTimeout(() => {}, 10000);",
    ].join(" ");
    const result = runChild(process.execPath, ["-e", parentScript], {
      ...process.env,
    });

    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        await readFile(ready, "utf8");
        descendantPid = Number(await readFile(pidFile, "utf8"));
        break;
      } catch {
        await delay(10);
      }
    }
    assert.equal(typeof descendantPid, "number");
    process.kill(process.pid, "SIGTERM");
    assert.equal(await result, 143);
    assert.equal(await readFile(marker, "utf8"), "terminated");
  } finally {
    if (descendantPid !== undefined) {
      try {
        process.kill(descendantPid, "SIGTERM");
      } catch {
        // The descendant may already have exited with the process group.
      }
    }
    await rm(directory, { recursive: true, force: true });
  }
});
