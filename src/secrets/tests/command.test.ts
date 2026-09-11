/* eslint-disable playwright/expect-expect -- node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
import { runCommand } from "../command.js";

test("terminates timed-out commands and marks the result indeterminate", async () => {
  const result = await runCommand(
    process.execPath,
    ["-e", "setTimeout(() => {}, 10_000)"],
    { timeoutMs: 25 },
  );
  assert.equal(result.timedOut, true);
  assert.equal(result.status, null);
});
