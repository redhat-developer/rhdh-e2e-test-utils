/* eslint-disable playwright/expect-expect -- this file uses node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCliArguments,
  type ExecCliArguments,
  type RotateCliArguments,
} from "../cli.js";

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
  assert.throws(() => parseCliArguments(["unknown"]), /unsupported command/i);
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

test("parses rotate input, apply, empty confirmation, and timeout options", () => {
  const parsed = parseCliArguments([
    "rotate",
    "--collection",
    "rhdh-qe",
    "--path=rhdh/test",
    "--from-file",
    "replacement.txt",
    "--allow-empty",
    "--gsm-timeout-seconds",
    "30",
    "--apply",
  ]);
  assert.deepEqual(parsed, {
    command: "rotate",
    collection: "rhdh-qe",
    bitwardenPath: "rhdh/test",
    fromFile: "replacement.txt",
    fromStdin: false,
    allowEmpty: true,
    apply: true,
    resumeId: undefined,
    gsmTimeoutMs: 30_000,
  } satisfies RotateCliArguments);
});

test("parses resume and rejects ambiguous rotation input", () => {
  assert.deepEqual(
    parseCliArguments(["rotate", "--resume", "operation-id", "--apply"]),
    {
      command: "rotate",
      collection: undefined,
      bitwardenPath: undefined,
      fromFile: undefined,
      fromStdin: false,
      allowEmpty: false,
      apply: true,
      resumeId: "operation-id",
      gsmTimeoutMs: undefined,
    },
  );
  assert.throws(
    () =>
      parseCliArguments([
        "rotate",
        "--collection",
        "rhdh-qe",
        "--path",
        "rhdh/test",
      ]),
    /from-file.*from-stdin/i,
  );
  assert.throws(
    () =>
      parseCliArguments([
        "rotate",
        "--resume",
        "operation-id",
        "--from-stdin",
        "--apply",
      ]),
    /resume.*input/i,
  );
});

test("parses GSM credential lifecycle commands", () => {
  assert.deepEqual(parseCliArguments(["gsm-login"]), { command: "gsm-login" });
  assert.deepEqual(parseCliArguments(["gsm-clean"]), { command: "gsm-clean" });
});

test("rejects duplicate destructive rotation options", () => {
  assert.throws(
    () =>
      parseCliArguments([
        "rotate",
        "--collection",
        "rhdh-qe",
        "--collection",
        "rhdh-test-instance",
        "--path",
        "rhdh/test",
        "--from-stdin",
      ]),
    /duplicate.*collection/i,
  );
});
