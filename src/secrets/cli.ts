#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { executeCommand } from "./exec.js";
import {
  getCollectionMapping,
  gsmPathFromBitwardenPath,
  parseProfile,
  type ReadableCollectionId,
} from "./config.js";
import { GsmClient } from "./gsm.js";
import { GsmWrapper } from "./gsm-wrapper.js";
import {
  executeMutation,
  type MutationCommand,
  type MutationPlan,
} from "./mutation.js";
import { BitwardenClient } from "./bitwarden.js";

export interface ExecCliArguments {
  command: "exec";
  profilePath: string;
  workspaces: string[];
  executable: string;
  args: string[];
}

interface MutationCliBase {
  collection: string;
  bitwardenPath: string;
  dryRun: boolean;
  gsmTimeoutMs?: number;
}

export interface CreateCliArguments extends MutationCliBase {
  command: "create";
  fromFile?: string;
  fromStdin: boolean;
  allowEmpty: boolean;
  force: boolean;
}

export interface UpdateCliArguments extends MutationCliBase {
  command: "update";
  fromFile?: string;
  fromStdin: boolean;
  allowEmpty: boolean;
}

export interface DeleteCliArguments extends MutationCliBase {
  command: "delete";
  force: boolean;
}

export interface DescribeCliArguments {
  command: "describe";
  collection: string;
  bitwardenPath: string;
  output: "text" | "json";
}

export interface ListCliArguments {
  command: "list";
  collection?: string;
  output: "text" | "json";
}

export type CliArguments =
  | ExecCliArguments
  | CreateCliArguments
  | UpdateCliArguments
  | DeleteCliArguments
  | DescribeCliArguments
  | ListCliArguments
  | { command: "gsm-login" | "gsm-clean" };

const HELP = `Usage:
  rhdh-e2e-secrets exec --profile <profile.json> [--workspace <name> ...] -- <command> [args...]
  rhdh-e2e-secrets create -c <collection> <secret-path> (-f <file> | --from-stdin) [--allow-empty] [--force] [--dry-run]
  rhdh-e2e-secrets update -c <collection> <secret-path> (-f <file> | --from-stdin) [--allow-empty] [--dry-run]
  rhdh-e2e-secrets delete -c <collection> <secret-path> [--force] [--dry-run]
  rhdh-e2e-secrets describe -c <collection> <secret-path> [-o text|json]
  rhdh-e2e-secrets list [-c <collection>] [-o text|json]
  rhdh-e2e-secrets gsm-login
  rhdh-e2e-secrets gsm-clean

Requirements:
  BW_SESSION must contain an already unlocked Bitwarden CLI session for exec and create, update, and delete.
  GSM commands use a cached copy of openshift/release hack/secret-manager.sh and require local gcloud authentication.
`;

const MUTATION_COMMANDS = ["create", "update", "delete"] as const;
const READABLE_COLLECTIONS: readonly ReadableCollectionId[] = [
  "rhdh-qe",
  "rhdh-test-instance",
  "rhdh-plugin-export-overlays",
];

export function parseCliArguments(argv: readonly string[]): CliArguments {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    throw new Error(HELP);
  }
  if (argv[0] === "exec") return parseExecArguments(argv);
  if (isMutationCommand(argv[0])) return parseMutationArguments(argv);
  if (argv[0] === "describe") return parseDescribeArguments(argv);
  if (argv[0] === "list") return parseListArguments(argv);
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

function parseMutationArguments(
  argv: readonly string[],
): CreateCliArguments | UpdateCliArguments | DeleteCliArguments {
  const command = argv[0] as MutationCommand;
  let collection: string | undefined;
  let bitwardenPath: string | undefined;
  let fromFile: string | undefined;
  let fromStdin = false;
  let allowEmpty = false;
  let force = false;
  let dryRun = false;
  let gsmTimeoutMs: number | undefined;
  let pathSeen = false;
  const seenOptions = new Set<string>();
  const markOption = (name: string): void => {
    if (seenOptions.has(name)) throw new Error(`Duplicate option: ${name}`);
    seenOptions.add(name);
  };

  for (let index = 1; index < argv.length; index++) {
    const option = argv[index]!;
    if (!option.startsWith("-")) {
      if (pathSeen) throw new Error("Only one secret path is allowed");
      pathSeen = true;
      bitwardenPath = option;
      continue;
    }
    if (option === "--from-stdin") {
      markOption(option);
      fromStdin = true;
      continue;
    }
    if (
      option === "--allow-empty" ||
      option === "--force" ||
      option === "--dry-run"
    ) {
      markOption(option);
      if (option === "--allow-empty") allowEmpty = true;
      else if (option === "--force") force = true;
      else dryRun = true;
      continue;
    }
    const valueOption = readMutationValueOption(option, argv, index);
    if (valueOption) {
      markOption(valueOption.name);
      index = valueOption.nextIndex;
      if (valueOption.name === "--collection") collection = valueOption.value;
      else if (valueOption.name === "--from-file") fromFile = valueOption.value;
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

  if (!collection) throw new Error("--collection is required");
  if (!bitwardenPath) throw new Error("A secret path is required");
  if (command === "delete") {
    if (fromFile !== undefined || fromStdin || allowEmpty) {
      throw new Error("delete does not accept input options");
    }
    return {
      command,
      collection,
      bitwardenPath,
      force,
      dryRun,
      gsmTimeoutMs,
    };
  }
  if (force && command === "update") {
    throw new Error("--force is not supported for update");
  }
  if (Number(fromFile !== undefined) + Number(fromStdin) !== 1) {
    throw new Error("Exactly one of --from-file or --from-stdin is required");
  }
  return {
    command,
    collection,
    bitwardenPath,
    fromFile,
    fromStdin,
    allowEmpty,
    ...(command === "create" ? { force } : {}),
    dryRun,
    gsmTimeoutMs,
  } as CreateCliArguments | UpdateCliArguments;
}

function readMutationValueOption(
  option: string,
  argv: readonly string[],
  index: number,
):
  | {
      name: "--collection" | "--from-file" | "--gsm-timeout-seconds";
      value: string;
      nextIndex: number;
    }
  | undefined {
  const aliases = new Map<string, "--collection" | "--from-file">([
    ["-c", "--collection"],
    ["-f", "--from-file"],
  ]);
  const names = [
    "--collection",
    "--from-file",
    "--gsm-timeout-seconds",
  ] as const;
  const name =
    aliases.get(option) ??
    names.find(
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
    nextIndex:
      option === name || option === "-c" || option === "-f" ? index + 1 : index,
  };
}

function parseDescribeArguments(argv: readonly string[]): DescribeCliArguments {
  const parsed = parseReadArguments(argv, true);
  return {
    command: "describe",
    collection: parsed.collection!,
    bitwardenPath: parsed.bitwardenPath!,
    output: parsed.output,
  };
}

function parseListArguments(argv: readonly string[]): ListCliArguments {
  const parsed = parseReadArguments(argv, false);
  return {
    command: "list",
    ...(parsed.collection === undefined
      ? {}
      : { collection: parsed.collection }),
    output: parsed.output,
  };
}

function parseReadArguments(
  argv: readonly string[],
  pathRequired: boolean,
): { collection?: string; bitwardenPath?: string; output: "text" | "json" } {
  let collection: string | undefined;
  let bitwardenPath: string | undefined;
  let output: "text" | "json" = "text";
  const seen = new Set<string>();
  for (let index = 1; index < argv.length; index++) {
    const option = argv[index]!;
    if (!option.startsWith("-")) {
      if (bitwardenPath) throw new Error("Only one secret path is allowed");
      bitwardenPath = option;
      continue;
    }
    const value = readReadValueOption(option, argv, index);
    if (value) {
      if (seen.has(value.name))
        throw new Error(`Duplicate option: ${value.name}`);
      seen.add(value.name);
      index = value.nextIndex;
      if (value.name === "--collection") collection = value.value;
      else {
        if (value.value !== "text" && value.value !== "json") {
          throw new Error("--output must be text or json");
        }
        output = value.value;
      }
      continue;
    }
    throw new Error(`Unknown option: ${option}`);
  }
  if (pathRequired && !bitwardenPath)
    throw new Error("A secret path is required");
  if (pathRequired && !collection) throw new Error("--collection is required");
  if (!pathRequired && bitwardenPath) {
    throw new Error("list does not accept a secret path");
  }
  return { collection, bitwardenPath, output };
}

function readReadValueOption(
  option: string,
  argv: readonly string[],
  index: number,
):
  | { name: "--collection" | "--output"; value: string; nextIndex: number }
  | undefined {
  const name =
    option === "-c"
      ? "--collection"
      : option === "-o"
        ? "--output"
        : (["--collection", "--output"] as const).find(
            (candidate) =>
              option === candidate || option.startsWith(`${candidate}=`),
          );
  if (!name) return undefined;
  const inline = option.startsWith(`${name}=`)
    ? option.slice(name.length + 1)
    : argv[index + 1];
  if (!inline) throw new Error(`${name} requires a value`);
  return {
    name,
    value: inline,
    nextIndex:
      option === name || option === "-c" || option === "-o" ? index + 1 : index,
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
      if (result.status !== 0) throw new Error(`${parsed.command} failed`);
      return 0;
    }

    const gsm = new GsmClient();
    if (parsed.command === "describe") {
      const mapping = getCollectionMapping(parsed.collection);
      const metadata = await gsm.describe(
        mapping.gsmCollection,
        gsmPathFromBitwardenPath(parsed.bitwardenPath),
      );
      printOutput(metadata, parsed.output);
      return 0;
    }
    if (parsed.command === "list") {
      if (parsed.collection === undefined) {
        printOutput([...READABLE_COLLECTIONS], parsed.output);
      } else {
        const mapping = getCollectionMapping(parsed.collection);
        const paths = await gsm.list(mapping.gsmCollection);
        printOutput(paths, parsed.output);
      }
      return 0;
    }

    if (!isMutationCommand(parsed.command)) {
      throw new Error(`Unsupported command: ${parsed.command}`);
    }
    const mutation = parsed as
      | CreateCliArguments
      | UpdateCliArguments
      | DeleteCliArguments;
    const result = await executeMutation({
      command: mutation.command,
      collection: mutation.collection,
      bitwardenPath: mutation.bitwardenPath,
      fromFile: "fromFile" in mutation ? mutation.fromFile : undefined,
      fromStdin: "fromStdin" in mutation ? mutation.fromStdin : undefined,
      stdin: process.stdin,
      allowEmpty: "allowEmpty" in mutation ? mutation.allowEmpty : undefined,
      force: "force" in mutation ? mutation.force : undefined,
      dryRun: mutation.dryRun,
      gsmTimeoutMs: mutation.gsmTimeoutMs,
      bitwarden: new BitwardenClient(),
      gsm,
    });
    console.log(formatMutationResult(result.state, result.plan));
    return 0;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Secret operation failed",
    );
    return 1;
  }
}

function printOutput(value: unknown, output: "text" | "json"): void {
  if (output === "json") {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) console.log(String(entry));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      console.log(`${key}: ${String(entry)}`);
    }
    return;
  }
  console.log(String(value));
}

export function formatMutationResult(
  state: "dry-run" | "applied",
  plan: MutationPlan,
): string {
  const lines = [
    `${state === "dry-run" ? "Dry-run" : "Applied"}: ${plan.command} ${plan.collection}/${plan.bitwardenPath}`,
    `Bitwarden: ${plan.bitwardenAction}${plan.storage ? ` (${plan.storage})` : ""}`,
    `GSM: ${plan.gsmAction} ${plan.gsmPath}`,
  ];
  if (plan.byteLength !== undefined)
    lines.push(`Input: ${plan.byteLength} bytes`);
  return lines.join("\n");
}

function isMutationCommand(
  value: string | undefined,
): value is MutationCommand {
  return MUTATION_COMMANDS.includes(value as MutationCommand);
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
