#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { executeCommand } from "./exec.js";
import { parseProfile } from "./config.js";

export interface ExecCliArguments {
  command: "exec";
  profilePath: string;
  workspaces: string[];
  executable: string;
  args: string[];
}

const HELP = `Usage:
  rhdh-e2e-secrets exec --profile <profile.json> [--workspace <name> ...] -- <command> [args...]

Requirements:
  BW_SESSION must contain an already unlocked Bitwarden CLI session.
  The bw CLI must be installed and available on PATH.
`;

export function parseCliArguments(argv: readonly string[]): ExecCliArguments {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    throw new Error(HELP);
  }
  if (argv[0] !== "exec") {
    throw new Error(`Unsupported command: ${argv[0]}`);
  }

  const delimiter = argv.indexOf("--");
  if (delimiter === -1) {
    throw new Error("A command after -- is required");
  }
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

export async function main(
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP);
    return 0;
  }

  try {
    const parsed = parseCliArguments(argv);
    const profileValue = JSON.parse(
      await readFile(resolve(parsed.profilePath), "utf8"),
    ) as unknown;
    const profile = parseProfile(profileValue);
    return await executeCommand({
      profile,
      workspaces: parsed.workspaces,
      command: parsed.executable,
      args: parsed.args,
    });
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Secret execution failed",
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
