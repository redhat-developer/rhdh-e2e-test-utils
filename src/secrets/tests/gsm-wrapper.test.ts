/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect -- node:test assertions */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    assert.equal(calls[0]?.[0], path.join(cacheDir, "secret-manager.sh"));
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
