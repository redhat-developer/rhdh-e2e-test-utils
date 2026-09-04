import { spawn } from "node:child_process";

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  stdio?: "pipe" | "inherit";
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: CommandOptions,
) => Promise<CommandResult>;

export const runCommand: CommandRunner = (command, args, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio === "inherit" ? "inherit" : "pipe",
    });
    let stdout = "";
    let stderr = "";

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
      resolve({ status: null, stdout, stderr, error });
    });
    child.once("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
