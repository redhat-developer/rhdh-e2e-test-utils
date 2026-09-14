/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect -- node:test assertions */

import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GsmWrapper } from "../gsm-wrapper.js";

const script =
  "#!/bin/bash\nset -euo pipefail\nGCLOUD_CONFIG_PATH=x\nCONTAINER_ENGINE=podman\n";

test("downloads and atomically caches the GSM wrapper", async () => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "gsm-wrapper-test-"));
  const calls: string[][] = [];
  try {
    const wrapper = new GsmWrapper({
      cacheDir,
      fetchScript: async () => script,
      env: {
        BW_SESSION: "must-not-reach-gsm",
        VAULT_TOKEN: "must-not-reach-gsm",
      },
      commandRunner: async (_command, args, options) => {
        calls.push([...args]);
        assert.equal(options?.env?.BW_SESSION, undefined);
        assert.equal(options?.env?.VAULT_TOKEN, undefined);
        return { status: 0, stdout: "", stderr: "" };
      },
    });

    const metadata = await wrapper.run(["describe", "-o", "json"]);
    assert.equal(metadata.usedCache, false);
    assert.match(
      path.basename(calls[0]![0]!),
      /^secret-manager\.sh\.[a-f0-9]{64}$/,
    );
    assert.equal(await readFile(calls[0]![0]!, "utf8"), script);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("uses a validated cached wrapper when refresh fails", async () => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "gsm-wrapper-test-"));
  const warnings: string[] = [];
  try {
    const first = new GsmWrapper({
      cacheDir,
      fetchScript: async () => script,
      commandRunner: async () => ({ status: 0, stdout: "", stderr: "" }),
    });
    await first.run(["list"]);

    const second = new GsmWrapper({
      cacheDir,
      fetchScript: async () => {
        throw new Error("offline");
      },
      commandRunner: async () => ({ status: 0, stdout: "", stderr: "" }),
      warning: (message) => warnings.push(message),
    });
    const result = await second.run(["list"]);
    assert.equal(result.usedCache, true);
    assert.match(warnings[0] ?? "", /cached GSM wrapper/i);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("rejects an untrusted downloaded wrapper", async () => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "gsm-wrapper-test-"));
  try {
    const wrapper = new GsmWrapper({
      cacheDir,
      fetchScript: async () => "#!/bin/sh\necho untrusted\n",
      commandRunner: async () => ({ status: 0, stdout: "", stderr: "" }),
    });
    await assert.rejects(() => wrapper.run(["list"]), /no validated cache/i);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("passes interactive GSM commands through the terminal", async () => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "gsm-wrapper-test-"));
  let received: { stdio?: string; tty?: boolean } | undefined;
  try {
    const wrapper = new GsmWrapper({
      cacheDir,
      fetchScript: async () => script,
      commandRunner: async (_command, _args, options) => {
        received = options;
        return { status: 0, stdout: "", stderr: "" };
      },
    });
    await wrapper.run(["create"], undefined, {
      stdio: "inherit",
      tty: true,
    });
    assert.deepEqual(
      { stdio: received?.stdio, tty: received?.tty },
      { stdio: "inherit", tty: true },
    );
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("cleans the local GSM authentication directory without the wrapper", async () => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "gsm-wrapper-test-"));
  const authDir = path.join(
    cacheDir,
    "gcp-secret-manager",
    ".secret-manager-gcloud",
  );
  let fetched = false;
  let executed = false;
  try {
    await mkdir(authDir, { recursive: true });
    await writeFile(path.join(authDir, "credentials.db"), "synthetic");
    const wrapper = new GsmWrapper({
      cacheDir,
      fetchScript: async () => {
        fetched = true;
        throw new Error("offline");
      },
      commandRunner: async () => {
        executed = true;
        throw new Error("wrapper must not execute");
      },
    });

    await wrapper.clean();

    await assert.rejects(() => access(authDir), /ENOENT/);
    assert.equal(fetched, false);
    assert.equal(executed, false);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("shares one wrapper initialization across concurrent runs", async () => {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "gsm-wrapper-test-"));
  let fetches = 0;
  try {
    const wrapper = new GsmWrapper({
      cacheDir,
      fetchScript: async () => {
        fetches++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return script;
      },
      commandRunner: async () => ({ status: 0, stdout: "", stderr: "" }),
    });

    await Promise.all([wrapper.run(["list"]), wrapper.run(["list"])]);
    assert.equal(fetches, 1);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});
