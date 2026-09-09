/* eslint-disable playwright/expect-expect, playwright/no-conditional-in-test -- this is a node:test regression suite */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { FullConfig } from "@playwright/test";
import { loadDotenvFromProjects } from "./global-setup.js";

test("dotenv precedence follows the execution environment", async (context) => {
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
  const previousCi = process.env.CI;
  try {
    await context.test("local .env values override inherited values", () => {
      delete process.env.CI;
      process.env.VAULT_GITHUB_TOKEN = "bitwarden-value";
      process.env.BW_SESSION = "parent-session";
      process.env.VAULT_TOKEN = "parent-token";
      delete process.env.LOCAL_ONLY;

      loadDotenvFromProjects({ projects: [{ testDir }] } as FullConfig);

      assert.equal(process.env.VAULT_GITHUB_TOKEN, "dotenv-value");
      assert.equal(process.env.BW_SESSION, "dotenv-session");
      assert.equal(process.env.VAULT_TOKEN, "dotenv-token");
      assert.equal(process.env.LOCAL_ONLY, "dotenv-only");
    });

    await context.test("CI values override local .env values", () => {
      process.env.CI = "true";
      process.env.VAULT_GITHUB_TOKEN = "ci-value";
      process.env.BW_SESSION = "ci-session";
      process.env.VAULT_TOKEN = "ci-token";
      delete process.env.LOCAL_ONLY;

      loadDotenvFromProjects({ projects: [{ testDir }] } as FullConfig);

      assert.equal(process.env.VAULT_GITHUB_TOKEN, "ci-value");
      assert.equal(process.env.BW_SESSION, "ci-session");
      assert.equal(process.env.VAULT_TOKEN, "ci-token");
      assert.equal(process.env.LOCAL_ONLY, "dotenv-only");
    });
  } finally {
    if (previousToken === undefined) delete process.env.VAULT_GITHUB_TOKEN;
    else process.env.VAULT_GITHUB_TOKEN = previousToken;
    if (previousSession === undefined) delete process.env.BW_SESSION;
    else process.env.BW_SESSION = previousSession;
    if (previousProviderToken === undefined) delete process.env.VAULT_TOKEN;
    else process.env.VAULT_TOKEN = previousProviderToken;
    if (previousLocal === undefined) delete process.env.LOCAL_ONLY;
    else process.env.LOCAL_ONLY = previousLocal;
    if (previousCi === undefined) delete process.env.CI;
    else process.env.CI = previousCi;
    await rm(root, { recursive: true, force: true });
  }
});
