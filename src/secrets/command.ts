import { spawn } from "node:child_process";
import { access, constants, open, type FileHandle } from "node:fs/promises";

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
  signal?: NodeJS.Signals;
  timedOut?: boolean;
}

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  stdio?: "pipe" | "inherit";
  tty?: boolean;
  timeoutMs?: number;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: CommandOptions,
) => Promise<CommandResult>;

export const runCommand: CommandRunner = async (
  command,
  args,
  options = {},
) => {
  let tty: FileHandle | undefined;
  if (options.tty) {
    tty = await open("/dev/tty", "r+");
  }
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.tty
        ? [tty!.fd, "inherit", "inherit"]
        : options.stdio === "inherit"
          ? "inherit"
          : "pipe",
      detached: process.platform !== "win32",
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let forceTimeout: NodeJS.Timeout | undefined;
    const terminate = (signal: NodeJS.Signals): void => {
      if (child.pid !== undefined && process.platform !== "win32") {
        try {
          process.kill(-child.pid, signal);
          return;
        } catch {
          // Fall through to the direct child signal.
        }
      }
      child.kill(signal);
    };
    const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
    const forwarders = new Map<(typeof signals)[number], () => void>();
    for (const signal of signals) {
      const forward = () => terminate(signal);
      forwarders.set(signal, forward);
      process.on(signal, forward);
    }
    const timeout =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            terminate("SIGTERM");
            forceTimeout = setTimeout(() => {
              forceTimeout = undefined;
              terminate("SIGKILL");
            }, 1_000);
          }, options.timeoutMs);

    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      if (forceTimeout !== undefined && !timedOut) clearTimeout(forceTimeout);
      for (const [signal, forward] of forwarders) {
        process.removeListener(signal, forward);
      }
      void tty?.close();
      resolve({ ...result, ...(timedOut ? { timedOut: true } : {}) });
    };

    if (options.stdio !== "inherit") {
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });
      if (options.input !== undefined) child.stdin?.end(options.input);
      else child.stdin?.end();
    }

    child.once("error", (error) => {
      finish({ status: null, stdout, stderr, error });
    });
    child.once("close", (status, signal) => {
      finish({
        status,
        stdout,
        stderr,
        ...(signal === null ? {} : { signal }),
      });
    });
  });
};

export async function assertInteractiveTerminal(): Promise<void> {
  await access("/dev/tty", constants.R_OK | constants.W_OK);
}
