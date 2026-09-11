import { spawn } from "node:child_process";
import { BitwardenClient, type BitwardenSecret } from "./bitwarden.js";
import {
  expandProfile,
  type ExpandedSecretSelector,
  type SecretProfile,
} from "./config.js";
import {
  materializeEnvironmentWithSecretNames,
  SECRET_NAMES_ENVIRONMENT_VARIABLE,
} from "./environment.js";

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
  exposeSecretNames?: boolean;
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
  const { environment: childEnvironment, secretNames } =
    materializeEnvironmentWithSecretNames(
      secrets,
      expanded.selectors,
      options.env ?? process.env,
    );
  if (options.exposeSecretNames) {
    childEnvironment[SECRET_NAMES_ENVIRONMENT_VARIABLE] =
      JSON.stringify(secretNames);
  }
  const childRunner = options.childRunner ?? runChild;
  return childRunner(options.command, options.args, childEnvironment);
}

export const runChild: ChildRunner = (command, args, env) =>
  new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(command, args, {
      detached,
      env,
      stdio: "inherit",
    });
    let settled = false;
    const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
    const signalExitCodes = new Map<(typeof signals)[number], number>([
      ["SIGINT", 130],
      ["SIGTERM", 143],
      ["SIGHUP", 129],
    ]);
    const forwarders = new Map<(typeof signals)[number], () => void>();
    const terminate = (signal: (typeof signals)[number]): void => {
      if (detached && child.pid !== undefined) {
        try {
          process.kill(-child.pid, signal);
          return;
        } catch {
          // Fall through to the direct child signal.
        }
      }
      child.kill(signal);
    };
    for (const signal of signals) {
      const forwardSignal = () => terminate(signal);
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
