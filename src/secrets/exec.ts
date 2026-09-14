import { spawn } from "node:child_process";
import { Writable } from "node:stream";
import { BitwardenClient, type BitwardenSecret } from "./bitwarden.js";
import {
  expandProfile,
  type ExpandedSecretSelector,
  type SecretProfile,
} from "./config.js";
import {
  materializeEnvironmentWithSecrets,
  materializeStreamEnvironment,
} from "./environment.js";
import { writeSecretStream, type SecretStreamEntry } from "./stream.js";

export interface SecretReader {
  read(
    collection: SecretProfile["collection"],
    selectors: readonly ExpandedSecretSelector[],
  ): Promise<BitwardenSecret[]>;
}

export interface ChildRunnerOptions {
  secretStream?: readonly SecretStreamEntry[];
}

export type ChildRunner = (
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options?: ChildRunnerOptions,
) => Promise<number>;

export interface ExecuteCommandOptions {
  profile: SecretProfile;
  workspaces: readonly string[];
  command: string;
  args: readonly string[];
  streamSecrets?: boolean;
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
  const secretValues = await client.read(
    options.profile.collection,
    expanded.selectors,
  );
  const materialized = materializeEnvironmentWithSecrets(
    secretValues,
    expanded.selectors,
    options.env ?? process.env,
  );
  const childEnvironment = options.streamSecrets
    ? materializeStreamEnvironment(materialized)
    : materialized.environment;
  const childRunner = options.childRunner ?? runChild;
  if (options.streamSecrets) {
    return childRunner(options.command, options.args, childEnvironment, {
      secretStream: materialized.secrets,
    });
  }
  return childRunner(options.command, options.args, childEnvironment);
}

export const runChild: ChildRunner = createChildRunner(spawn);

/** Internal spawn seam used by lifecycle tests; omitted from the package barrel. */
export function createChildRunner(spawnCommand: typeof spawn): ChildRunner {
  return (command, args, env, options) =>
    runChildWithSpawn(spawnCommand, command, args, env, options);
}

async function runChildWithSpawn(
  spawnCommand: typeof spawn,
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options?: ChildRunnerOptions,
): Promise<number> {
  const secretStream = options?.secretStream;
  if (secretStream !== undefined) {
    try {
      await validateSecretStream(secretStream);
    } catch {
      throw streamError(command);
    }
  }

  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    let child: ReturnType<typeof spawn>;
    try {
      child = spawnCommand(command, args, {
        detached,
        env,
        stdio:
          secretStream === undefined
            ? "inherit"
            : ["inherit", "inherit", "inherit", "pipe"],
      });
    } catch {
      reject(new Error(`Unable to start command: ${command}`));
      return;
    }

    let settled = false;
    let childClosed = false;
    let forwardedSignal = false;
    let childResult: number | undefined;
    let fatalStreamError: Error | undefined;
    let streamFailure: unknown;
    let secretPipe: Writable | undefined;
    let streamWriter: SecretStreamWriter | undefined;
    let writerPromise: Promise<void> | undefined;
    let writerSettled = secretStream === undefined;
    let streamClosing = false;

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
    const removeForwarders = () => {
      for (const [signal, forwardSignal] of forwarders) {
        process.removeListener(signal, forwardSignal);
      }
      forwarders.clear();
    };
    const onStreamError = (error: unknown) => {
      streamFailure = error;
    };
    const onStreamClose = () => {
      if (streamClosing && writerSettled) removeStreamListeners();
    };
    const removeStreamListeners = () => {
      if (secretPipe) {
        secretPipe.removeListener("error", onStreamError);
        secretPipe.removeListener("close", onStreamClose);
      }
      streamWriter?.removeListener("error", onStreamError);
    };
    const adoptSecretPipe = (): void => {
      if (!secretPipe && child.stdio[3] instanceof Writable) {
        secretPipe = child.stdio[3];
      }
    };
    const settleUnstartedWriter = (): void => {
      if (secretStream !== undefined && !streamWriter) writerSettled = true;
    };
    const closeSecretStream = (reason?: Error): void => {
      adoptSecretPipe();
      if (streamClosing) return;
      streamClosing = true;
      if (streamWriter && !streamWriter.destroyed) {
        streamWriter.destroy(reason);
      } else if (secretPipe && !secretPipe.destroyed) {
        secretPipe.destroy();
      }
    };
    const finish = () => {
      if (settled || !childClosed || !writerSettled) return;
      settled = true;
      removeForwarders();
      if (fatalStreamError) reject(fatalStreamError);
      else resolve(childResult ?? 1);
    };
    const rejectStreamFailure = () => {
      if (
        settled ||
        childClosed ||
        forwardedSignal ||
        isBrokenPipe(streamFailure)
      ) {
        finish();
        return;
      }
      fatalStreamError ??= streamError(command);
      removeForwarders();
      closeSecretStream();
      terminate("SIGTERM");
      finish();
    };
    const startStream = () => {
      const candidate = child.stdio[3];
      if (!(candidate instanceof Writable) || !candidate.writable) {
        writerSettled = true;
        rejectStreamFailure();
        return;
      }
      secretPipe = candidate;
      secretPipe.on("error", onStreamError);
      secretPipe.once("close", onStreamClose);
      streamWriter = new SecretStreamWriter(secretPipe, onStreamError);
      streamWriter.on("error", onStreamError);
      writerPromise = writeSecretStream(streamWriter, secretStream!).then(
        () => {
          writerSettled = true;
          removeStreamListeners();
          finish();
        },
        () => {
          writerSettled = true;
          rejectStreamFailure();
          removeStreamListeners();
          finish();
        },
      );
      void writerPromise.catch(() => undefined);
    };

    for (const signal of signals) {
      const forwardSignal = () => {
        if (settled) return;
        forwardedSignal = true;
        removeForwarders();
        settleUnstartedWriter();
        closeSecretStream(
          writerPromise && !writerSettled
            ? new Error("secret stream closed")
            : undefined,
        );
        terminate(signal);
      };
      forwarders.set(signal, forwardSignal);
      process.on(signal, forwardSignal);
    }

    child.once("spawn", () => {
      if (secretStream !== undefined) {
        if (forwardedSignal || settled) {
          settleUnstartedWriter();
          closeSecretStream();
        } else startStream();
      }
    });
    child.once("error", () => {
      if (settled) return;
      settled = true;
      removeForwarders();
      settleUnstartedWriter();
      closeSecretStream();
      reject(new Error(`Unable to start command: ${command}`));
    });
    child.once("close", (code, signal) => {
      childClosed = true;
      settleUnstartedWriter();
      const signalExitCode = signal
        ? signalExitCodes.get(signal as (typeof signals)[number])
        : undefined;
      childResult = code ?? signalExitCode ?? 1;
      closeSecretStream(
        writerPromise && !writerSettled
          ? new Error("secret stream closed")
          : undefined,
      );
      removeForwarders();
      finish();
    });
  });
}

/* eslint-disable @typescript-eslint/naming-convention -- Node Writable hook names */
class SecretStreamWriter extends Writable {
  private readonly target: Writable;
  private readonly onFailure: (error: unknown) => void;
  private readonly onTargetError: (error: Error) => void;
  private readonly onTargetClose: () => void;

  constructor(target: Writable, onFailure: (error: unknown) => void) {
    super();
    this.target = target;
    this.onFailure = onFailure;
    this.onTargetError = (error) => {
      onFailure(error);
      if (!this.destroyed) this.destroy(error);
    };
    this.onTargetClose = () => {
      if (this.destroyed || this.writableFinished) return;
      const error = pipeClosedError();
      onFailure(error);
      this.destroy(error);
    };
    target.on("error", this.onTargetError);
    target.once("close", this.onTargetClose);
  }

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    try {
      if (this.target.write(chunk)) callback();
      else this.target.once("drain", callback);
    } catch (error) {
      this.onFailure(error);
      callback(toError(error));
    }
  }

  override _final(callback: (error?: Error | null) => void): void {
    try {
      this.target.end(callback);
    } catch (error) {
      this.onFailure(error);
      callback(toError(error));
    }
  }

  override _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void,
  ): void {
    this.target.removeListener("error", this.onTargetError);
    this.target.removeListener("close", this.onTargetClose);
    if (!this.target.destroyed) this.target.destroy();
    callback(error);
  }
}
/* eslint-enable @typescript-eslint/naming-convention */

async function validateSecretStream(
  entries: readonly SecretStreamEntry[],
): Promise<void> {
  const sink = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  try {
    await writeSecretStream(sink, entries);
  } finally {
    sink.destroy();
  }
}

function isBrokenPipe(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPIPE" || error.code === "ERR_STREAM_DESTROYED")
  );
}

function pipeClosedError(): Error {
  return Object.assign(new Error("secret stream pipe closed"), {
    code: "ERR_STREAM_DESTROYED",
  });
}

function streamError(command: string): Error {
  return new Error(`Unable to write secret stream for command: ${command}`);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("secret stream failure");
}
