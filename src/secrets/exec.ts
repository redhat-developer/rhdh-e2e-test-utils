import { spawn } from "node:child_process";
import { BitwardenClient, type BitwardenSecret } from "./bitwarden.js";
import {
  expandProfile,
  type ExpandedSecretSelector,
  type SecretProfile,
} from "./config.js";
import { materializeEnvironment } from "./environment.js";

export interface SecretReader {
  read(
    collection: SecretProfile["collection"],
    selectors: readonly ExpandedSecretSelector[],
  ): Promise<BitwardenSecret[]>;
}

export type ChildRunner = (
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
) => Promise<number>;

export interface ExecuteCommandOptions {
  profile: SecretProfile;
  workspaces: readonly string[];
  command: string;
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
  client?: SecretReader;
  childRunner?: ChildRunner;
}

export async function executeCommand(
  options: ExecuteCommandOptions,
): Promise<number> {
  const expanded = expandProfile(options.profile, options.workspaces);
  const client =
    options.client ?? new BitwardenClient({ env: options.env ?? process.env });
  const secrets = await client.read(
    options.profile.collection,
    expanded.selectors,
  );
  const childEnvironment = materializeEnvironment(
    secrets,
    expanded.selectors,
    options.env ?? process.env,
  );
  const childRunner = options.childRunner ?? runChild;
  return childRunner(options.command, options.args, childEnvironment);
}

export const runChild: ChildRunner = (command, args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    let settled = false;
    const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
    const signalExitCodes = new Map<(typeof signals)[number], number>([
      ["SIGINT", 130],
      ["SIGTERM", 143],
      ["SIGHUP", 129],
    ]);
    const forwarders = new Map<(typeof signals)[number], () => void>();
    for (const signal of signals) {
      const forwardSignal = () => child.kill(signal);
      forwarders.set(signal, forwardSignal);
      process.on(signal, forwardSignal);
    }
    const cleanup = () => {
      for (const [signal, forwardSignal] of forwarders) {
        process.removeListener(signal, forwardSignal);
      }
    };

    child.once("error", () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Unable to start command: ${command}`));
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();
      const signalExitCode = signal
        ? signalExitCodes.get(signal as (typeof signals)[number])
        : undefined;
      resolve(code ?? signalExitCode ?? 1);
    });
  });
