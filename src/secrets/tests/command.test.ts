/* eslint-disable playwright/expect-expect, playwright/no-conditional-in-test -- node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
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
