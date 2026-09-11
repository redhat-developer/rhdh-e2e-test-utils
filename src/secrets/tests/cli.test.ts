/* eslint-disable playwright/expect-expect -- this file uses node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCliArguments,
  type CreateCliArguments,
  type DeleteCliArguments,
  type DescribeCliArguments,
  type ExecCliArguments,
  type ListCliArguments,
  type UpdateCliArguments,
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

test("parses create with file input and applies by default", () => {
  assert.deepEqual(
    parseCliArguments([
      "create",
      "-c",
      "rhdh-qe",
      "rhdh/test",
      "-f",
      "replacement.txt",
    ]),
    {
      command: "create",
      collection: "rhdh-qe",
      bitwardenPath: "rhdh/test",
      fromFile: "replacement.txt",
      fromStdin: false,
      allowEmpty: false,
      force: false,
      dryRun: false,
      gsmTimeoutMs: undefined,
    } satisfies CreateCliArguments,
  );
});

test("parses update with stdin input and dry-run", () => {
  assert.deepEqual(
    parseCliArguments([
      "update",
      "--collection=rhdh-qe",
      "rhdh/test",
      "--from-stdin",
      "--allow-empty",
      "--dry-run",
      "--gsm-timeout-seconds",
      "30",
    ]),
    {
      command: "update",
      collection: "rhdh-qe",
      bitwardenPath: "rhdh/test",
      fromFile: undefined,
      fromStdin: true,
      allowEmpty: true,
      dryRun: true,
      gsmTimeoutMs: 30_000,
    } satisfies UpdateCliArguments,
  );
});

test("parses forced delete and does not require input", () => {
  assert.deepEqual(
    parseCliArguments([
      "delete",
      "--collection",
      "rhdh-qe",
      "rhdh/test",
      "--force",
    ]),
    {
      command: "delete",
      collection: "rhdh-qe",
      bitwardenPath: "rhdh/test",
      force: true,
      dryRun: false,
      gsmTimeoutMs: undefined,
    } satisfies DeleteCliArguments,
  );
});

test("parses GSM describe and list commands", () => {
  assert.deepEqual(
    parseCliArguments(["describe", "-c", "rhdh-qe", "rhdh/test", "-o", "json"]),
    {
      command: "describe",
      collection: "rhdh-qe",
      bitwardenPath: "rhdh/test",
      output: "json",
    } satisfies DescribeCliArguments,
  );
  assert.deepEqual(parseCliArguments(["list", "--collection", "rhdh-qe"]), {
    command: "list",
    collection: "rhdh-qe",
    output: "text",
  } satisfies ListCliArguments);
});

test("requires exactly one input for create and update", () => {
  assert.throws(
    () => parseCliArguments(["create", "-c", "rhdh-qe", "rhdh/test"]),
    /from-file.*from-stdin/i,
  );
  assert.throws(
    () =>
      parseCliArguments([
        "update",
        "-c",
        "rhdh-qe",
        "rhdh/test",
        "--from-file",
        "one",
        "--from-stdin",
      ]),
    /exactly one/i,
  );
  assert.throws(
    () =>
      parseCliArguments([
        "delete",
        "-c",
        "rhdh-qe",
        "rhdh/test",
        "--from-stdin",
      ]),
    /does not accept input/i,
  );
});

test("restricts force to create and delete", () => {
  assert.throws(
    () =>
      parseCliArguments([
        "update",
        "-c",
        "rhdh-qe",
        "rhdh/test",
        "--from-stdin",
        "--force",
      ]),
    /force.*update/i,
  );
});

test("rejects the removed rotation and resume commands", () => {
  assert.throws(() => parseCliArguments(["rotate"]), /unsupported command/i);
  assert.throws(
    () => parseCliArguments(["create", "--resume", "operation-id"]),
    /unknown option|collection/i,
  );
});

test("parses GSM credential lifecycle commands", () => {
  assert.deepEqual(parseCliArguments(["gsm-login"]), { command: "gsm-login" });
  assert.deepEqual(parseCliArguments(["gsm-clean"]), { command: "gsm-clean" });
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
