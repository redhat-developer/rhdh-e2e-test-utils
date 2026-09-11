/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect, playwright/no-conditional-in-test -- node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
import { GsmClient, type GsmRunner } from "../gsm.js";

function result(stdout = "", status: number | null = 0, timedOut = false) {
  return { status, stdout, stderr: "synthetic", timedOut, usedCache: false };
}

test("describes GSM metadata without exposing provider output", async () => {
  const calls: string[][] = [];
  const runner: GsmRunner = {
    run: async (args) => {
      calls.push([...args]);
      return result(
        [
          "Created:               synthetic",
          "JIRA project:          (not set)",
          "Rotation instructions: (not set)",
          "Request information:   (not set)",
        ].join("\n"),
      );
    },
  };

  const metadata = await new GsmClient({ runner }).describe(
    "rhdh-qe",
    "rhdh/test",
  );
  assert.deepEqual(metadata, {
    "create-time": "synthetic",
    "jira-project": "(not set)",
    "rotation-instructions": "(not set)",
    "request-information": "(not set)",
  });
  assert.deepEqual(calls[0], ["describe", "-c", "rhdh-qe", "rhdh/test"]);
});

test("updates GSM using the private snapshot and reports timeout as indeterminate", async () => {
  const calls: Array<{ args: string[]; timeout?: number }> = [];
  const runner: GsmRunner = {
    run: async (args, timeout) => {
      calls.push({ args: [...args], timeout });
      return result("", 0);
    },
  };
  await new GsmClient({ runner }).update(
    "rhdh-qe",
    "rhdh/test",
    "/private/snapshot",
    123,
  );
  assert.deepEqual(calls[0], {
    args: [
      "update",
      "-c",
      "rhdh-qe",
      "rhdh/test",
      "--from-file",
      "/private/snapshot",
    ],
    timeout: 123,
  });

  const timeoutRunner: GsmRunner = {
    run: async () => result("", null, true),
  };
  await assert.rejects(
    () =>
      new GsmClient({ runner: timeoutRunner }).update(
        "rhdh-qe",
        "rhdh/test",
        "/private/snapshot",
        123,
      ),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes("indeterminate") &&
      (error as Error & { indeterminate?: boolean }).indeterminate === true,
  );
});

test("distinguishes a missing GSM secret from other describe failures", async () => {
  const missing: GsmRunner = {
    run: async () => result("", 1, false),
  };
  const missingClient = new GsmClient({
    runner: {
      run: async () => ({
        ...result("Secret 'rhdh/test' does not exist", 1),
        stderr: "",
      }),
    },
  });
  assert.equal(await missingClient.exists("rhdh-qe", "rhdh/test"), false);
  await assert.rejects(
    () => new GsmClient({ runner: missing }).exists("rhdh-qe", "rhdh/test"),
    /does not exist or is inaccessible/i,
  );
});

test("does not classify missing application credentials as a missing secret", async () => {
  const runner: GsmRunner = {
    run: async () => result("", 1, false),
  };
  const authenticationRunner: GsmRunner = {
    run: async () => ({
      ...result("", 1),
      stderr:
        "google.auth.exceptions.DefaultCredentialsError: default credentials were not found",
    }),
  };

  await assert.rejects(
    () => new GsmClient({ runner }).exists("rhdh-qe", "rhdh/test"),
    /does not exist or is inaccessible/i,
  );
  await assert.rejects(
    () =>
      new GsmClient({ runner: authenticationRunner }).exists(
        "rhdh-qe",
        "rhdh/test",
      ),
    /gsm-login/i,
  );
});

test("lists GSM paths and creates with an interactive terminal", async () => {
  const calls: Array<{
    args: string[];
    timeout?: number;
    options?: { stdio?: "pipe" | "inherit"; tty?: boolean };
  }> = [];
  const runner: GsmRunner = {
    run: async (args, timeout, options) => {
      calls.push({ args: [...args], timeout, options });
      if (args[0] === "list") return result('["rhdh/test", "rhdh/other"]');
      return result();
    },
    ensureInteractive: async () => undefined,
  };
  const client = new GsmClient({ runner });
  assert.deepEqual(await client.list("rhdh-qe"), ["rhdh/test", "rhdh/other"]);
  await client.ensureInteractive();
  await client.create("rhdh-qe", "rhdh/new", "/private/snapshot", 123);
  await client.delete("rhdh-qe", "rhdh/new", 456);
  assert.deepEqual(calls, [
    {
      args: ["list", "-c", "rhdh-qe", "-o", "json"],
      timeout: 60_000,
      options: undefined,
    },
    {
      args: [
        "create",
        "-c",
        "rhdh-qe",
        "rhdh/new",
        "--from-file",
        "/private/snapshot",
      ],
      timeout: 123,
      options: { stdio: "inherit", tty: true },
    },
    {
      args: ["delete", "-c", "rhdh-qe", "rhdh/new"],
      timeout: 456,
      options: undefined,
    },
  ]);
});
