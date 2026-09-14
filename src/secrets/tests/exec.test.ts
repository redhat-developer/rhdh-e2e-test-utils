/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect, playwright/no-conditional-in-test -- node:test fixtures model process environment keys */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import {
  executeCommand,
  runChild,
  type ChildRunner,
  type ChildRunnerOptions,
} from "../exec.js";
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
      RHDH_E2E_SECRET_FD: "stale-fd",
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
  assert.equal(received?.env.RHDH_E2E_SECRET_NAMES, undefined);
  assert.equal(received?.env.RHDH_E2E_SECRET_FD, undefined);
});

test("does not pass stream options to a non-stream injected runner", async () => {
  let receivedArgumentCount = 0;
  const childRunner: ChildRunner = async (...args) => {
    receivedArgumentCount = args.length;
    return 0;
  };

  const exitCode = await executeCommand({
    profile,
    workspaces: [],
    command: "playwright",
    args: [],
    env: { BW_SESSION: "synthetic-session" },
    client: { read: async () => [secret] },
    childRunner,
  });

  assert.equal(exitCode, 0);
  assert.equal(receivedArgumentCount, 3);
});

test("removes an inherited secret-name marker when exposure is disabled", async () => {
  let childEnvironment: NodeJS.ProcessEnv | undefined;

  const exitCode = await executeCommand({
    profile,
    workspaces: [],
    command: "playwright",
    args: [],
    env: {
      BW_SESSION: "synthetic-session",
      RHDH_E2E_SECRET_NAMES: '["STALE_NAME"]',
      RHDH_E2E_SECRET_FD: "stale-fd",
    },
    client: { read: async () => [secret] },
    childRunner: async (_command, _args, env) => {
      childEnvironment = env;
      return 0;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(childEnvironment?.RHDH_E2E_SECRET_NAMES, undefined);
  assert.equal(childEnvironment?.RHDH_E2E_SECRET_FD, undefined);
});

test("streams selected secrets without placing values in the child environment", async () => {
  let childEnvironment: NodeJS.ProcessEnv | undefined;
  let runnerOptions: ChildRunnerOptions | undefined;
  const childRunner: ChildRunner = async (_command, _args, env, options) => {
    childEnvironment = env;
    runnerOptions = options;
    return 0;
  };

  const exitCode = await executeCommand({
    profile,
    workspaces: [],
    command: "podman",
    args: ["run"],
    streamSecrets: true,
    env: {
      BW_SESSION: "synthetic-session",
      BW_CLIENTID: "synthetic-client-id",
      VAULT_TOKEN: "stale-value",
      RHDH_E2E_SECRET_FD: "stale-fd",
    },
    client: { read: async () => [secret] },
    childRunner,
  });

  assert.equal(exitCode, 0);
  assert.equal(childEnvironment?.VAULT_TOKEN, undefined);
  assert.equal(childEnvironment?.BW_SESSION, undefined);
  assert.equal(childEnvironment?.BW_CLIENTID, undefined);
  assert.equal(childEnvironment?.RHDH_E2E_SECRET_NAMES, undefined);
  assert.equal(childEnvironment?.RHDH_E2E_SECRET_FD, "3");
  assert.deepEqual(runnerOptions, {
    secretStream: [{ name: "VAULT_TOKEN", value: "synthetic-value" }],
  });
});

test("passes sorted mapped entries to the stream child runner", async () => {
  const expandedSelector = secret.selector;
  const secrets: BitwardenSecret[] = [
    {
      id: "zeta-id",
      name: "global/VAULT_ZETA",
      value: "zeta-secret-value",
      selector: expandedSelector,
    },
    {
      id: "alpha-id",
      name: "global/VAULT_ALPHA",
      value: "alpha-secret-value",
      selector: expandedSelector,
    },
  ];
  let runnerOptions: ChildRunnerOptions | undefined;

  const exitCode = await executeCommand({
    profile,
    workspaces: [],
    command: "playwright",
    args: [],
    streamSecrets: true,
    env: { BW_SESSION: "synthetic-session" },
    client: { read: async () => secrets },
    childRunner: async (_command, _args, _env, options) => {
      runnerOptions = options;
      return 0;
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(runnerOptions?.secretStream, [
    { name: "VAULT_ALPHA", value: "alpha-secret-value" },
    { name: "VAULT_ZETA", value: "zeta-secret-value" },
  ]);
});

test("writes the secret stream to child file descriptor three", async () => {
  const childScript = [
    "const fs = require('node:fs');",
    "const stream = fs.readFileSync(3);",
    "if (!stream.subarray(0, 8).equals(Buffer.from('RHDHSEC1')) || !stream.includes(Buffer.from('RHDHEND1')) || stream.length < 160000) process.exit(1);",
  ].join(" ");

  const exitCode = await runChild(
    process.execPath,
    ["-e", childScript],
    { ...process.env, RHDH_E2E_SECRET_FD: "3" },
    { secretStream: [{ name: "LARGE_VALUE", value: "x".repeat(160 * 1024) }] },
  );

  assert.equal(exitCode, 0);
});

test("decodes multiline, empty, and large values without exposing them to the child environment", async () => {
  const streamModuleUrl = pathToFileURL(
    path.join(process.cwd(), "dist/secrets/stream.js"),
  ).href;
  const childScript = [
    "import fs from 'node:fs';",
    `import { decodeSecretStream } from ${JSON.stringify(streamModuleUrl)};`,
    "const entries = decodeSecretStream(fs.readFileSync(3));",
    "const values = new Map(entries.map(({ name, value }) => [name, value]));",
    "if (process.env.RHDH_E2E_SECRET_FD !== '3') process.exit(2);",
    "if (values.get('VAULT_EMPTY_VALUE') !== '') process.exit(3);",
    "if (values.get('VAULT_MULTILINE_VALUE')?.split('\\n').length !== 3) process.exit(4);",
    "if (values.get('VAULT_LARGE_VALUE')?.length !== 160 * 1024) process.exit(5);",
    "if (process.env.VAULT_EMPTY_VALUE !== undefined || process.env.VAULT_MULTILINE_VALUE !== undefined || process.env.VAULT_LARGE_VALUE !== undefined) process.exit(6);",
    "if (process.env.BW_SESSION !== undefined || process.env.BW_CLIENTID !== undefined) process.exit(7);",
    "if (process.env.RHDH_E2E_SECRET_NAMES !== undefined) process.exit(8);",
    "try { fs.fstatSync(0); fs.fstatSync(3); } catch { process.exit(9); }",
    "if (process.stdin.fd !== 0 || 0 === 3) process.exit(10);",
  ].join(" ");
  const selector = secret.selector;
  const exitCode = await executeCommand({
    profile,
    workspaces: [],
    command: process.execPath,
    args: ["--input-type=module", "-e", childScript],
    streamSecrets: true,
    env: {
      ...process.env,
      VAULT_EMPTY_VALUE: "stale-value",
      VAULT_MULTILINE_VALUE: "stale-value",
      VAULT_LARGE_VALUE: "stale-value",
      BW_SESSION: "synthetic-session",
      BW_CLIENTID: "synthetic-client-id",
    },
    client: {
      read: async () => [
        {
          id: "empty-id",
          name: "global/VAULT_EMPTY_VALUE",
          value: "",
          selector,
        },
        {
          id: "multiline-id",
          name: "global/VAULT_MULTILINE_VALUE",
          value: "first line\nsecond line\n",
          selector,
        },
        {
          id: "large-id",
          name: "global/VAULT_LARGE_VALUE",
          value: "x".repeat(160 * 1024),
          selector,
        },
      ],
    },
  });

  assert.equal(exitCode, 0);
});

test("preserves a stream child's exit code after it reads the stream", async () => {
  const childScript = [
    "const fs = require('node:fs');",
    "fs.readFileSync(3);",
    "process.exit(17);",
  ].join(" ");

  const exitCode = await runChild(
    process.execPath,
    ["-e", childScript],
    { ...process.env, RHDH_E2E_SECRET_FD: "3" },
    { secretStream: [{ name: "EXIT_VALUE", value: "synthetic-value" }] },
  );

  assert.equal(exitCode, 17);
});

test("maps a stream child's SIGTERM to status 143", async () => {
  const childScript = [
    "const fs = require('node:fs');",
    "fs.readFileSync(3);",
    "process.kill(process.pid, 'SIGTERM');",
  ].join(" ");

  const exitCode = await runChild(
    process.execPath,
    ["-e", childScript],
    { ...process.env, RHDH_E2E_SECRET_FD: "3" },
    { secretStream: [{ name: "SIGNAL_VALUE", value: "synthetic-value" }] },
  );

  assert.equal(exitCode, 143);
});

test("preserves the child result when it closes the stream before reading it", async () => {
  const childScript = [
    "const fs = require('node:fs');",
    "fs.closeSync(3);",
    "setTimeout(() => process.exit(17), 50);",
  ].join(" ");

  const exitCode = await runChild(
    process.execPath,
    ["-e", childScript],
    { ...process.env, RHDH_E2E_SECRET_FD: "3" },
    {
      secretStream: [
        { name: "EARLY_CLOSE_VALUE", value: "x".repeat(160 * 1024) },
      ],
    },
  );

  assert.equal(exitCode, 17);
});

test("does not write or leak values when the stream command cannot start", async () => {
  await assert.rejects(
    () =>
      runChild(
        "command-that-does-not-exist",
        [],
        { ...process.env },
        { secretStream: [{ name: "MISSING_COMMAND_VALUE", value: "secret" }] },
      ),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.equal(
        error.message,
        "Unable to start command: command-that-does-not-exist",
      );
      assert.equal(error.message.includes("secret"), false);
      return true;
    },
  );
});

test("exposes only sorted validated secret names from one provider read", async () => {
  const expandedSelector = secret.selector;
  const secrets: BitwardenSecret[] = [
    {
      id: "zeta-id",
      name: "global/VAULT_ZETA",
      value: "zeta-secret-value",
      selector: expandedSelector,
    },
    {
      id: "filtered-id",
      name: "global/OTHER_VALUE",
      value: "filtered-secret-value",
      selector: expandedSelector,
    },
    {
      id: "alpha-id",
      name: "global/VAULT_A-B",
      value: "alpha-secret-value",
      selector: expandedSelector,
    },
  ];
  let readCount = 0;
  let childEnvironment: NodeJS.ProcessEnv | undefined;

  const exitCode = await executeCommand({
    profile,
    workspaces: [],
    command: "playwright",
    args: [],
    exposeSecretNames: true,
    env: {
      BW_SESSION: "synthetic-session",
      BW_CLIENTID: "synthetic-client-id",
      RHDH_E2E_SECRET_NAMES: '["STALE_NAME"]',
    },
    client: {
      read: async () => {
        readCount++;
        return secrets;
      },
    },
    childRunner: async (_command, _args, env) => {
      childEnvironment = env;
      return 0;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(readCount, 1);
  assert.equal(
    childEnvironment?.RHDH_E2E_SECRET_NAMES,
    '["VAULT_A_B","VAULT_ZETA"]',
  );
  assert.equal(childEnvironment?.BW_SESSION, undefined);
  assert.equal(childEnvironment?.BW_CLIENTID, undefined);
  assert.doesNotMatch(
    childEnvironment?.RHDH_E2E_SECRET_NAMES ?? "",
    /synthetic|OTHER_VALUE|BW_/,
  );
});

test("preserves the child exit code when secret names are exposed", async () => {
  const exitCode = await executeCommand({
    profile,
    workspaces: [],
    command: "playwright",
    args: [],
    exposeSecretNames: true,
    env: { BW_SESSION: "synthetic-session" },
    client: { read: async () => [secret] },
    childRunner: async () => 17,
  });

  assert.equal(exitCode, 17);
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
