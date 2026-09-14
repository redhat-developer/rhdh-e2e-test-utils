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

const LEGACY_SECRET_NAMES_ENVIRONMENT_VARIABLE = "RHDH_E2E_SECRET_NAMES";

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
  exposeSecretNames?: boolean;
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
  if (options.exposeSecretNames) {
    childEnvironment[LEGACY_SECRET_NAMES_ENVIRONMENT_VARIABLE] = JSON.stringify(
      materialized.secrets.map(({ name }) => name),
    );
  }
  const childRunner = options.childRunner ?? runChild;
  if (options.streamSecrets) {
    return childRunner(options.command, options.args, childEnvironment, {
      secretStream: materialized.secrets,
    });
  }
  return childRunner(options.command, options.args, childEnvironment);
}

export const runChild: ChildRunner = async (command, args, env, options) => {
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
      child = spawn(command, args, {
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
    let secretPipe: Writable | undefined;
    let writerPromise: Promise<void> | undefined;
    let writerSettled = false;
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
    const removeStreamListeners = () => {
      if (!secretPipe) return;
      secretPipe.removeListener("error", onStreamError);
      secretPipe.removeListener("close", onStreamClose);
    };
    const onStreamError = (error: unknown) => {
      streamFailure = error;
    };
    const onStreamClose = () => {
      if (streamClosing) removeStreamListeners();
    };
    let streamFailure: unknown;
    const adoptSecretPipe = (): void => {
      if (!secretPipe && child.stdio[3] instanceof Writable) {
        secretPipe = child.stdio[3];
      }
    };
    const closeSecretStream = (reason?: Error): void => {
      adoptSecretPipe();
      if (streamClosing) {
        if (secretPipe && !secretPipe.destroyed) {
          try {
            secretPipe.destroy(reason);
          } catch {
            removeStreamListeners();
          }
        }
        return;
      }
      streamClosing = true;
      if (!secretPipe) return;
      try {
        if (secretPipe.destroyed) {
          removeStreamListeners();
        } else {
          secretPipe.destroy(reason);
        }
      } catch {
        removeStreamListeners();
      }
    };
    const rejectStreamFailure = () => {
      if (
        settled ||
        childClosed ||
        forwardedSignal ||
        isBrokenPipe(streamFailure)
      )
        return;
      settled = true;
      removeForwarders();
      closeSecretStream(new Error("secret stream failure"));
      terminate("SIGTERM");
      reject(streamError(command));
    };
    const startStream = () => {
      const candidate = child.stdio[3];
      if (!(candidate instanceof Writable) || !candidate.writable) {
        rejectStreamFailure();
        return;
      }
      secretPipe = candidate;
      secretPipe.on("error", onStreamError);
      secretPipe.once("close", onStreamClose);
      writerPromise = writeSecretStream(secretPipe, secretStream!).then(
        () => {
          writerSettled = true;
          removeStreamListeners();
        },
        () => {
          writerSettled = true;
          rejectStreamFailure();
          throw streamError(command);
        },
      );
      void writerPromise.catch(() => undefined);
    };
    for (const signal of signals) {
      const forwardSignal = () => {
        if (settled) return;
        forwardedSignal = true;
        removeForwarders();
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
        if (forwardedSignal || settled) closeSecretStream();
        else startStream();
      }
    });
    child.once("error", () => {
      if (settled) return;
      settled = true;
      removeForwarders();
      closeSecretStream(
        writerPromise && !writerSettled
          ? new Error("secret stream closed")
          : undefined,
      );
      reject(new Error(`Unable to start command: ${command}`));
    });
    child.once("close", (code, signal) => {
      childClosed = true;
      closeSecretStream(
        writerPromise && !writerSettled
          ? new Error("secret stream closed")
          : undefined,
      );
      removeForwarders();
      if (settled) return;
      const signalExitCode = signal
        ? signalExitCodes.get(signal as (typeof signals)[number])
        : undefined;
      const childResult = code ?? signalExitCode ?? 1;
      const pumpSettlement =
        writerPromise?.catch(() => undefined) ?? Promise.resolve();
      void pumpSettlement.then(() => {
        if (settled) return;
        settled = true;
        resolve(childResult);
      });
    });
  });
};

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

function streamError(command: string): Error {
  return new Error(`Unable to write secret stream for command: ${command}`);
}
