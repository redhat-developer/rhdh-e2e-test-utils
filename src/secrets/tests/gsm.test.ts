/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect -- node:test assertions */

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
      return result('{"create-time":"synthetic"}');
    },
  };

  const metadata = await new GsmClient({ runner }).describe(
    "rhdh-qe",
    "rhdh/test",
  );
  assert.deepEqual(metadata, { "create-time": "synthetic" });
  assert.deepEqual(calls[0], [
    "describe",
    "-c",
    "rhdh-qe",
    "rhdh/test",
    "-o",
    "json",
  ]);
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
