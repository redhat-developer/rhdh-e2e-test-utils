#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { executeCommand } from "./exec.js";
import { parseProfile } from "./config.js";
import { GsmClient } from "./gsm.js";
import { GsmWrapper } from "./gsm-wrapper.js";
import { JournalStore } from "./journal.js";
import { BitwardenClient } from "./bitwarden.js";
import { executeRotation } from "./rotation.js";

export interface ExecCliArguments {
  command: "exec";
  profilePath: string;
  workspaces: string[];
  executable: string;
  args: string[];
}

export interface RotateCliArguments {
  command: "rotate";
  collection?: string;
  bitwardenPath?: string;
  fromFile?: string;
  fromStdin: boolean;
  allowEmpty: boolean;
  apply: boolean;
  resumeId?: string;
  gsmTimeoutMs?: number;
}

export type CliArguments =
  | ExecCliArguments
  | RotateCliArguments
  | { command: "gsm-login" | "gsm-clean" };

const HELP = `Usage:
  rhdh-e2e-secrets exec --profile <profile.json> [--workspace <name> ...] -- <command> [args...]
  rhdh-e2e-secrets rotate --collection <name> --path <bitwarden-path> (--from-file <path> | --from-stdin) [--allow-empty] [--gsm-timeout-seconds <seconds>] [--apply]
  rhdh-e2e-secrets rotate --resume <rotation-id> --apply [--gsm-timeout-seconds <seconds>]
  rhdh-e2e-secrets gsm-login
  rhdh-e2e-secrets gsm-clean

Requirements:
  BW_SESSION must contain an already unlocked Bitwarden CLI session for exec and rotate.
  GSM commands use a cached copy of openshift/release hack/secret-manager.sh and require local gcloud authentication.
`;

export function parseCliArguments(argv: readonly string[]): CliArguments {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    throw new Error(HELP);
  }
  if (argv[0] === "exec") return parseExecArguments(argv);
  if (argv[0] === "rotate") return parseRotateArguments(argv);
  if (argv[0] === "gsm-login" || argv[0] === "gsm-clean") {
    if (argv.length !== 1)
      throw new Error(`${argv[0]} does not accept options`);
    return { command: argv[0] };
  }
  throw new Error(`Unsupported command: ${argv[0]}`);
}

function parseExecArguments(argv: readonly string[]): ExecCliArguments {
  const delimiter = argv.indexOf("--");
  if (delimiter === -1) throw new Error("A command after -- is required");
  const options = argv.slice(1, delimiter);
  const command = argv[delimiter + 1];
  const args = argv.slice(delimiter + 2);
  let profilePath: string | undefined;
  const workspaces: string[] = [];

  for (let index = 0; index < options.length; index++) {
    const option = options[index]!;
    if (option === "--profile" || option === "--workspace") {
      const value = options[++index];
      if (!value) throw new Error(`${option} requires a value`);
      if (option === "--profile") profilePath = value;
      else workspaces.push(value);
      continue;
    }
    if (option.startsWith("--profile=")) {
      profilePath = option.slice("--profile=".length);
      if (!profilePath) throw new Error("--profile requires a value");
      continue;
    }
    if (option.startsWith("--workspace=")) {
      const workspace = option.slice("--workspace=".length);
      if (!workspace) throw new Error("--workspace requires a value");
      workspaces.push(workspace);
      continue;
    }
    throw new Error(`Unknown option: ${option}`);
  }

  if (!profilePath) throw new Error("--profile is required");
  if (!command) throw new Error("A non-empty command after -- is required");
  return {
    command: "exec",
    profilePath,
    workspaces,
    executable: command,
    args,
  };
}

function parseRotateArguments(argv: readonly string[]): RotateCliArguments {
  let collection: string | undefined;
  let bitwardenPath: string | undefined;
  let fromFile: string | undefined;
  let fromStdin = false;
  let allowEmpty = false;
  let apply = false;
  let resumeId: string | undefined;
  let gsmTimeoutMs: number | undefined;
  const seenOptions = new Set<string>();
  const markOption = (name: string): void => {
    if (seenOptions.has(name)) throw new Error(`Duplicate option: ${name}`);
    seenOptions.add(name);
  };

  for (let index = 1; index < argv.length; index++) {
    const option = argv[index]!;
    if (option === "--apply") {
      markOption(option);
      apply = true;
      continue;
    }
    if (option === "--allow-empty") {
      markOption(option);
      allowEmpty = true;
      continue;
    }
    if (option === "--from-stdin") {
      markOption(option);
      fromStdin = true;
      continue;
    }
    const valueOption = readValueOption(option, argv, index);
    if (valueOption) {
      markOption(valueOption.name);
      index = valueOption.nextIndex;
      if (valueOption.name === "--collection") collection = valueOption.value;
      else if (valueOption.name === "--path") bitwardenPath = valueOption.value;
      else if (valueOption.name === "--from-file") fromFile = valueOption.value;
      else if (valueOption.name === "--resume") resumeId = valueOption.value;
      else if (valueOption.name === "--gsm-timeout-seconds") {
        const seconds = Number(valueOption.value);
        if (!Number.isSafeInteger(seconds) || seconds <= 0) {
          throw new Error("--gsm-timeout-seconds must be a positive integer");
        }
        gsmTimeoutMs = seconds * 1000;
      }
      continue;
    }
    throw new Error(`Unknown option: ${option}`);
  }

  if (resumeId !== undefined) {
    if (!apply) throw new Error("--resume requires --apply");
    if (collection || bitwardenPath || fromFile || fromStdin || allowEmpty) {
      throw new Error(
        "--resume cannot be combined with rotation input or target options",
      );
    }
  } else {
    if (!collection) throw new Error("--collection is required");
    if (!bitwardenPath) throw new Error("--path is required");
    if (Number(fromFile !== undefined) + Number(fromStdin) !== 1) {
      throw new Error("Exactly one of --from-file or --from-stdin is required");
    }
  }
  return {
    command: "rotate",
    collection,
    bitwardenPath,
    fromFile,
    fromStdin,
    allowEmpty,
    apply,
    resumeId,
    gsmTimeoutMs,
  };
}

function readValueOption(
  option: string,
  argv: readonly string[],
  index: number,
): { name: string; value: string; nextIndex: number } | undefined {
  const names = [
    "--collection",
    "--path",
    "--from-file",
    "--resume",
    "--gsm-timeout-seconds",
  ];
  const name = names.find(
    (candidate) => option === candidate || option.startsWith(`${candidate}=`),
  );
  if (!name) return undefined;
  const inline = option.startsWith(`${name}=`)
    ? option.slice(name.length + 1)
    : argv[index + 1];
  if (!inline) throw new Error(`${name} requires a value`);
  return {
    name,
    value: inline,
    nextIndex: option === name ? index + 1 : index,
  };
}

export async function main(
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP);
    return 0;
  }

  try {
    const parsed = parseCliArguments(argv);
    if (parsed.command === "exec") {
      const profileValue = JSON.parse(
        await readFile(resolve(parsed.profilePath), "utf8"),
      ) as unknown;
      return await executeCommand({
        profile: parseProfile(profileValue),
        workspaces: parsed.workspaces,
        command: parsed.executable,
        args: parsed.args,
      });
    }
    if (parsed.command === "gsm-login" || parsed.command === "gsm-clean") {
      const wrapper = new GsmWrapper();
      const result =
        parsed.command === "gsm-login"
          ? await wrapper.login()
          : await wrapper.clean();
      if (result.status !== 0) {
        throw new Error(`${parsed.command} failed`);
      }
      return 0;
    }

    if (parsed.command !== "rotate") {
      throw new Error(`Unsupported command: ${parsed.command}`);
    }

    const result = await executeRotation({
      collection: parsed.collection,
      bitwardenPath: parsed.bitwardenPath,
      fromFile: parsed.fromFile,
      fromStdin: parsed.fromStdin,
      stdin: process.stdin,
      allowEmpty: parsed.allowEmpty,
      apply: parsed.apply,
      resumeId: parsed.resumeId,
      gsmTimeoutMs: parsed.gsmTimeoutMs,
      journal: new JournalStore(),
      bitwarden: new BitwardenClient(),
      gsm: new GsmClient(),
    });
    if (result.state === "dry-run") {
      console.log(
        `Dry-run: ${result.storage}-backed target ${result.gsmPath} exists; input is ${result.byteLength} bytes.`,
      );
    } else {
      console.log(
        `Rotation ${result.operationId} completed for ${result.gsmPath}.`,
      );
    }
    return 0;
  } catch (error) {
    if (error instanceof Error && "operationId" in error) {
      const operationId = (error as Error & { operationId: string })
        .operationId;
      console.error(
        `${error.message}; resume with --resume ${operationId} --apply`,
      );
      return 1;
    }
    console.error(
      error instanceof Error ? error.message : "Secret operation failed",
    );
    return 1;
  }
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  void main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    () => {
      process.exitCode = 1;
    },
  );
}
