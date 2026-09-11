/* eslint-disable playwright/expect-expect -- this file uses node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMutationResult,
  getHelpText,
  parseCliArguments,
  type CreateCliArguments,
  type DeleteCliArguments,
  type DescribeCliArguments,
  type ExecCliArguments,
  type HelpCliArguments,
  type ListCliArguments,
  type UpdateCliArguments,
} from "../cli.js";
import type { MutationPlan } from "../mutation.js";

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

test("parses secret-name exposure before the child command", () => {
  assert.deepEqual(
    parseCliArguments([
      "exec",
      "--profile",
      "profile.json",
      "--expose-secret-names",
      "--",
      "node",
    ]),
    {
      command: "exec",
      profilePath: "profile.json",
      workspaces: [],
      executable: "node",
      args: [],
      exposeSecretNames: true,
    } satisfies ExecCliArguments,
  );
});

test("keeps secret-name exposure after -- as a child argument", () => {
  assert.deepEqual(
    parseCliArguments([
      "exec",
      "--profile",
      "profile.json",
      "--",
      "node",
      "--expose-secret-names",
    ]),
    {
      command: "exec",
      profilePath: "profile.json",
      workspaces: [],
      executable: "node",
      args: ["--expose-secret-names"],
    } satisfies ExecCliArguments,
  );
});

test("advertises secret-name exposure in root and exec help", () => {
  assert.match(getHelpText("root"), /--expose-secret-names/);
  assert.match(getHelpText("exec"), /--expose-secret-names/);
});

test("formats provider actions with their actual collection names", () => {
  const plan: MutationPlan = {
    command: "delete",
    collection: "rhdh-qe",
    bitwardenCollection: "Rhdh Qe Ci Secrets",
    gsmCollection: "rhdh-qe",
    bitwardenPath: "rhdh/TEST",
    gsmPath: "rhdh/TEST",
    bitwardenAction: "delete",
    gsmAction: "delete",
  };

  assert.equal(
    formatMutationResult("applied", plan),
    [
      "Applied: delete rhdh-qe/rhdh/TEST",
      "Bitwarden: delete Rhdh Qe Ci Secrets/rhdh/TEST",
      "GSM: delete rhdh-qe/rhdh/TEST",
    ].join("\n"),
  );
});

test("supports short exec profile and workspace options", () => {
  assert.deepEqual(
    parseCliArguments([
      "exec",
      "-p",
      "profile.json",
      "-w",
      "backstage",
      "--",
      "node",
    ]),
    {
      command: "exec",
      profilePath: "profile.json",
      workspaces: ["backstage"],
      executable: "node",
      args: [],
    } satisfies ExecCliArguments,
  );
});

test("returns root and subcommand help before validating required arguments", () => {
  assert.deepEqual(parseCliArguments(["--help"]), {
    command: "help",
    topic: "root",
  } satisfies HelpCliArguments);
  assert.deepEqual(parseCliArguments(["create", "--help"]), {
    command: "help",
    topic: "create",
  } satisfies HelpCliArguments);
  assert.deepEqual(parseCliArguments(["update", "-h"]), {
    command: "help",
    topic: "update",
  } satisfies HelpCliArguments);
  assert.deepEqual(parseCliArguments(["delete", "--help"]), {
    command: "help",
    topic: "delete",
  } satisfies HelpCliArguments);
  assert.deepEqual(parseCliArguments(["describe", "-h"]), {
    command: "help",
    topic: "describe",
  } satisfies HelpCliArguments);
  assert.deepEqual(parseCliArguments(["list", "--help"]), {
    command: "help",
    topic: "list",
  } satisfies HelpCliArguments);
  assert.deepEqual(parseCliArguments(["gsm-login", "-h"]), {
    command: "help",
    topic: "gsm-login",
  } satisfies HelpCliArguments);
  assert.deepEqual(parseCliArguments(["gsm-clean", "--help"]), {
    command: "help",
    topic: "gsm-clean",
  } satisfies HelpCliArguments);
});

test("keeps --help after exec -- for the child command", () => {
  assert.deepEqual(
    parseCliArguments([
      "exec",
      "--profile",
      "profile.json",
      "--",
      "node",
      "--help",
    ]),
    {
      command: "exec",
      profilePath: "profile.json",
      workspaces: [],
      executable: "node",
      args: ["--help"],
    } satisfies ExecCliArguments,
  );
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

test("supports the short stdin flag and case-insensitive output values", () => {
  assert.deepEqual(
    parseCliArguments(["create", "-c", "rhdh-qe", "rhdh/test", "-i"]),
    {
      command: "create",
      collection: "rhdh-qe",
      bitwardenPath: "rhdh/test",
      fromFile: undefined,
      fromStdin: true,
      allowEmpty: false,
      force: false,
      dryRun: false,
      gsmTimeoutMs: undefined,
    } satisfies CreateCliArguments,
  );
  assert.equal(
    (
      parseCliArguments([
        "describe",
        "-c",
        "rhdh-qe",
        "rhdh/test",
        "-o",
        "JSON",
      ]) as DescribeCliArguments
    ).output,
    "json",
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

test("rejects GSM timeout values above the Node timer limit", () => {
  assert.throws(
    () =>
      parseCliArguments([
        "create",
        "-c",
        "rhdh-qe",
        "rhdh/test",
        "-i",
        "--gsm-timeout-seconds",
        "2147484",
      ]),
    /maximum|timeout/i,
  );
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
  assert.throws(
    () =>
      parseCliArguments([
        "create",
        "-c",
        "rhdh-qe",
        "rhdh/test",
        "--from-literal",
        "secret-value",
      ]),
    /unknown option/i,
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
