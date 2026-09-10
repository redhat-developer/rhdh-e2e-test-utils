/* eslint-disable playwright/expect-expect -- this file uses node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
import { parseCliArguments, type ExecCliArguments } from "../cli.js";

test("parses the exec profile, repeated workspaces, and command after --", () => {
  const parsed = parseCliArguments([
    "exec",
    "--profile",
    "e2e-secrets.profile.json",
    "--workspace",
    "backstage",
    "--workspace=extensions",
    "--",
    "playwright",
    "test",
    "--headed",
  ]);

  assert.deepEqual(parsed, {
    command: "exec",
    profilePath: "e2e-secrets.profile.json",
    workspaces: ["backstage", "extensions"],
    executable: "playwright",
    args: ["test", "--headed"],
  } satisfies ExecCliArguments);
});

test("requires a profile and a command after --", () => {
  assert.throws(
    () => parseCliArguments(["exec", "--", "playwright"]),
    /profile/i,
  );
  assert.throws(
    () => parseCliArguments(["exec", "--profile", "profile.json"]),
    /command.*--/i,
  );
  assert.throws(
    () => parseCliArguments(["exec", "--profile", "profile.json", "--", ""]),
    /command/i,
  );
});

test("rejects unknown commands and malformed options", () => {
  assert.throws(() => parseCliArguments(["rotate"]), /unsupported command/i);
  assert.throws(
    () => parseCliArguments(["exec", "--profile", "--", "playwright"]),
    /requires a value/i,
  );
  assert.throws(
    () =>
      parseCliArguments([
        "exec",
        "--profile",
        "profile.json",
        "--workspace",
        "--",
        "playwright",
      ]),
    /requires a value/i,
  );
});
