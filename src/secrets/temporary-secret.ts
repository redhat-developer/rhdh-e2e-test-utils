import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TEMPORARY_SECRET_DIRECTORY = "rhdh-e2e-secrets";

export interface TemporarySecretFile {
  path: string;
  remove(): Promise<void>;
}

export interface TemporarySecretFileOptions {
  rootDirectory?: string;
  processId?: number;
  processExists?: (processId: number) => boolean;
  removeDirectory?: (directory: string) => Promise<void>;
}

export function defaultTemporarySecretRoot(): string {
  return path.join(os.tmpdir(), TEMPORARY_SECRET_DIRECTORY);
}

export async function createTemporarySecretFile(
  value: string,
  fileName: string,
  options: TemporarySecretFileOptions = {},
): Promise<TemporarySecretFile> {
  if (!fileName || path.basename(fileName) !== fileName) {
    throw new Error(`Temporary secret filename is unsafe: ${fileName}`);
  }

  const rootDirectory = path.resolve(
    options.rootDirectory ?? defaultTemporarySecretRoot(),
  );
  const processId = options.processId ?? process.pid;
  const processExists = options.processExists ?? isProcessAlive;
  const removeDirectory =
    options.removeDirectory ??
    ((directory: string) => rm(directory, { recursive: true, force: true }));

  await ensureSecureDirectory(rootDirectory);
  await removeStaleDirectories(rootDirectory, processId, processExists);

  const directory = await mkdtemp(path.join(rootDirectory, `${processId}-`));
  try {
    await chmod(directory, 0o700);
    await writeFile(path.join(directory, fileName), value, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(path.join(directory, fileName), 0o600);
  } catch (error) {
    try {
      await removeDirectory(directory);
    } catch (cleanupError) {
      throw new AggregateError(
        [error],
        "Temporary secret creation and cleanup failed",
        { cause: cleanupError },
      );
    }
    throw error;
  }

  const filePath = path.join(directory, fileName);
  return {
    path: filePath,
    remove: () => removeDirectory(directory),
  };
}

async function ensureSecureDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const details = await lstat(directory);
  if (details.isSymbolicLink()) {
    throw new Error(
      `Temporary secret directory must not be a symlink: ${directory}`,
    );
  }
  if (!details.isDirectory()) {
    throw new Error(`Temporary secret path is not a directory: ${directory}`);
  }
  const userId = process.getuid?.();
  if (userId !== undefined && details.uid !== userId) {
    throw new Error(
      `Temporary secret directory has the wrong owner: ${directory}`,
    );
  }
  await chmod(directory, 0o700);
  const secured = await stat(directory);
  if ((secured.mode & 0o777) !== 0o700) {
    throw new Error(`Temporary secret directory is not private: ${directory}`);
  }
}

async function removeStaleDirectories(
  rootDirectory: string,
  currentProcessId: number,
  processExists: (processId: number) => boolean,
): Promise<void> {
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory() || entry.isSymbolicLink()) return;
      const match = /^(\d+)-/.exec(entry.name);
      if (!match) return;
      const processId = Number(match[1]);
      if (processId === currentProcessId || processExists(processId)) return;
      await rm(path.join(rootDirectory, entry.name), {
        recursive: true,
        force: true,
      });
    }),
  );
}

function isProcessAlive(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
