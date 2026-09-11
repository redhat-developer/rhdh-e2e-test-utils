/* eslint-disable playwright/expect-expect, playwright/no-conditional-in-test -- node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { runCommand, shouldDetachCommand } from "../command.js";

test("keeps terminal-backed commands in the parent session", () => {
  if (process.platform === "win32") return;
  assert.equal(shouldDetachCommand({}), true);
  assert.equal(shouldDetachCommand({ tty: true }), false);
});

test("terminates timed-out commands and marks the result indeterminate", async () => {
  const result = await runCommand(
    process.execPath,
    ["-e", "setTimeout(() => {}, 10_000)"],
    { timeoutMs: 25 },
  );
  assert.equal(result.timedOut, true);
  assert.equal(result.status, null);
});

test("cancels forced termination after a timed-out child exits", async () => {
  if (process.platform === "win32") return;
  const originalKill = process.kill;
  const signals: (NodeJS.Signals | number)[] = [];
  process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
    if (signal !== undefined) signals.push(signal);
    return originalKill(pid, signal);
  }) as typeof process.kill;

  try {
    await runCommand(process.execPath, ["-e", "setTimeout(() => {}, 10_000)"], {
      timeoutMs: 25,
    });
    const signalCountAfterExit = signals.length;
    await delay(1_100);
    assert.equal(signals.length, signalCountAfterExit);
    assert.doesNotMatch(
      signals.slice(signalCountAfterExit).join(","),
      /SIGKILL/,
    );
  } finally {
    process.kill = originalKill;
  }
});
