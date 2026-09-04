/* eslint-disable playwright/expect-expect, playwright/no-conditional-in-test -- this is a node:test regression suite */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { FullConfig } from "@playwright/test";
import { loadDotenvFromProjects } from "./global-setup.js";

test("dotenv values do not override secrets supplied by the parent process", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "global-setup-test-"));
  const e2eRoot = path.join(root, "e2e-tests");
  const testDir = path.join(e2eRoot, "tests");
  await mkdir(testDir, { recursive: true });
  await writeFile(
    path.join(e2eRoot, ".env"),
    "VAULT_GITHUB_TOKEN=dotenv-value\nBW_SESSION=dotenv-session\nVAULT_TOKEN=dotenv-token\nLOCAL_ONLY=dotenv-only\n",
  );

  const previousToken = process.env.VAULT_GITHUB_TOKEN;
  const previousSession = process.env.BW_SESSION;
  const previousProviderToken = process.env.VAULT_TOKEN;
  const previousLocal = process.env.LOCAL_ONLY;
  process.env.VAULT_GITHUB_TOKEN = "bitwarden-value";
  delete process.env.BW_SESSION;
  delete process.env.VAULT_TOKEN;
  delete process.env.LOCAL_ONLY;
  try {
    loadDotenvFromProjects({ projects: [{ testDir }] } as FullConfig);
    assert.equal(process.env.VAULT_GITHUB_TOKEN, "bitwarden-value");
    assert.equal(process.env.BW_SESSION, undefined);
    assert.equal(process.env.VAULT_TOKEN, undefined);
    assert.equal(process.env.LOCAL_ONLY, "dotenv-only");
  } finally {
    if (previousToken === undefined) delete process.env.VAULT_GITHUB_TOKEN;
    else process.env.VAULT_GITHUB_TOKEN = previousToken;
    if (previousSession === undefined) delete process.env.BW_SESSION;
    else process.env.BW_SESSION = previousSession;
    if (previousProviderToken === undefined) delete process.env.VAULT_TOKEN;
    else process.env.VAULT_TOKEN = previousProviderToken;
    if (previousLocal === undefined) delete process.env.LOCAL_ONLY;
    else process.env.LOCAL_ONLY = previousLocal;
    await rm(root, { recursive: true, force: true });
  }
});
