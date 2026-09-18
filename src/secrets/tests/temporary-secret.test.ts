/* eslint-disable playwright/expect-expect -- node:test assertions */

import assert from "node:assert/strict";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createTemporarySecretFile } from "../temporary-secret.js";

test("creates a private temporary secret file and removes it", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "temporary-secret-test-"));
  try {
    const secret = await createTemporarySecretFile(
      "synthetic-secret",
      "value",
      {
        rootDirectory: root,
      },
    );
    const rootStats = await stat(root);
    const directoryStats = await stat(path.dirname(secret.path));
    const fileStats = await stat(secret.path);

    assert.equal(rootStats.mode & 0o777, 0o700);
    assert.equal(directoryStats.mode & 0o777, 0o700);
    assert.equal(fileStats.mode & 0o777, 0o600);
    assert.equal(await readFile(secret.path, "utf8"), "synthetic-secret");

    await secret.remove();
    await assert.rejects(() => access(secret.path), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("removes abandoned directories for dead processes but preserves active ones", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "temporary-secret-test-"));
  const deadDirectory = path.join(root, "424242-dead");
  const activeDirectory = path.join(root, "424243-active");
  try {
    await mkdir(deadDirectory);
    await mkdir(activeDirectory);

    const secret = await createTemporarySecretFile("value", "value", {
      rootDirectory: root,
      processId: 424243,
      processExists: (pid: number) => pid === 424243,
    });

    await assert.rejects(() => lstat(deadDirectory), /ENOENT/);
    await access(activeDirectory);
    await secret.remove();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a symlink used as the temporary secret root", async () => {
  const parent = await mkdtemp(
    path.join(os.tmpdir(), "temporary-secret-test-"),
  );
  const target = path.join(parent, "target");
  const link = path.join(parent, "link");
  try {
    await mkdir(target);
    await symlink(target, link);
    await assert.rejects(
      () =>
        createTemporarySecretFile("value", "value", {
          rootDirectory: link,
        }),
      /symlink/i,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("reports temporary cleanup failure when file creation fails", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "temporary-secret-test-"));
  try {
    await assert.rejects(
      () =>
        createTemporarySecretFile("value", ".", {
          rootDirectory: root,
          removeDirectory: async () => {
            throw new Error("cleanup failed");
          },
        }),
      /creation and cleanup failed/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
