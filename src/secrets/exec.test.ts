/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect -- node:test fixtures model process environment keys */

import assert from "node:assert/strict";
import test from "node:test";
import { executeCommand, runChild, type ChildRunner } from "./exec.js";
import type { BitwardenSecret } from "./bitwarden.js";
import type { SecretProfile } from "./config.js";

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
