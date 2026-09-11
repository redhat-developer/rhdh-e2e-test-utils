import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import lockfile from "proper-lockfile";

export async function withSecretLock<T>(
  key: string,
  stateDir: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockDir = path.join(stateDir, ".locks");
  await mkdir(lockDir, { recursive: true, mode: 0o700 });
  const target = path.join(
    lockDir,
    `${createHash("sha256").update(key).digest("hex")}.lock`,
  );
  await writeFile(target, "", { flag: "a", mode: 0o600 });
  const release = await lockfile.lock(target, {
    retries: 0,
    stale: 300_000,
  });
  try {
    return await operation();
  } finally {
    await release();
  }
}

export function defaultLockDir(env: NodeJS.ProcessEnv = process.env): string {
  const configuredRoot = env.XDG_STATE_HOME;
  const stateRoot =
    configuredRoot && path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.join(os.homedir(), ".local", "state");
  return path.join(stateRoot, "rhdh-e2e-secrets");
}
