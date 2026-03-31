/**
 * Nightly mode tests — isNightlyJob detection and nightly plugin resolution.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import {
  isNightlyJob,
  processPluginsForDeployment,
  type DynamicPluginsConfig,
} from "../plugin-metadata.js";
import { withCleanEnv, createMetadataFixture } from "./helpers.js";

// ── isNightlyJob ─────────────────────────────────────────────────────────────

describe("isNightlyJob", () => {
  const env = withCleanEnv();
  beforeEach(() => env.save());
  afterEach(() => env.restore());

  it("returns false with no env vars set", () => {
    delete process.env.E2E_NIGHTLY_MODE;
    delete process.env.JOB_NAME;
    delete process.env.GIT_PR_NUMBER;
    assert.strictEqual(isNightlyJob(), false);
  });

  it("returns true when E2E_NIGHTLY_MODE is 'true'", () => {
    delete process.env.GIT_PR_NUMBER;
    process.env.E2E_NIGHTLY_MODE = "true";
    assert.strictEqual(isNightlyJob(), true);
  });

  it("returns true when E2E_NIGHTLY_MODE is '1'", () => {
    delete process.env.GIT_PR_NUMBER;
    process.env.E2E_NIGHTLY_MODE = "1";
    assert.strictEqual(isNightlyJob(), true);
  });

  it("returns false when E2E_NIGHTLY_MODE is 'false' (strict check)", () => {
    delete process.env.GIT_PR_NUMBER;
    process.env.E2E_NIGHTLY_MODE = "false";
    assert.strictEqual(
      isNightlyJob(),
      false,
      "'false' string must not trigger nightly mode",
    );
  });

  it("returns false when E2E_NIGHTLY_MODE is empty string", () => {
    delete process.env.GIT_PR_NUMBER;
    process.env.E2E_NIGHTLY_MODE = "";
    assert.strictEqual(
      isNightlyJob(),
      false,
      "empty string must not trigger nightly mode",
    );
  });

  it("returns true when JOB_NAME contains 'periodic-'", () => {
    delete process.env.GIT_PR_NUMBER;
    delete process.env.E2E_NIGHTLY_MODE;
    process.env.JOB_NAME = "periodic-ci-overlay-e2e-nightly";
    assert.strictEqual(isNightlyJob(), true);
  });

  it("returns false when JOB_NAME contains 'periodic' without trailing dash", () => {
    delete process.env.GIT_PR_NUMBER;
    delete process.env.E2E_NIGHTLY_MODE;
    process.env.JOB_NAME = "run-periodically";
    assert.strictEqual(
      isNightlyJob(),
      false,
      "'periodic' without dash must not trigger nightly mode",
    );
  });

  it("returns false when GIT_PR_NUMBER is set (PR takes precedence)", () => {
    process.env.GIT_PR_NUMBER = "42";
    process.env.E2E_NIGHTLY_MODE = "true";
    assert.strictEqual(
      isNightlyJob(),
      false,
      "GIT_PR_NUMBER must take precedence over nightly mode",
    );
  });

  it("returns false when GIT_PR_NUMBER is set even with periodic JOB_NAME", () => {
    process.env.GIT_PR_NUMBER = "42";
    process.env.JOB_NAME = "periodic-ci-overlay-e2e-nightly";
    assert.strictEqual(
      isNightlyJob(),
      false,
      "GIT_PR_NUMBER must take precedence over periodic job detection",
    );
  });
});

// ── Nightly resolution scenarios ─────────────────────────────────────────────

describe("processPluginsForDeployment — nightly mode", () => {
  const env = withCleanEnv();
  beforeEach(() => {
    env.save();
    delete process.env.GIT_PR_NUMBER;
    process.env.E2E_NIGHTLY_MODE = "true";
  });
  afterEach(() => env.restore());

  it("skips metadata injection in nightly mode", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tech-radar",
        packageName: "@backstage-community/plugin-tech-radar",
        dynamicArtifact:
          "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
        appConfigExamples: {
          techRadar: { url: "http://default.example.com" },
        },
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(config, metadataDir);

      assert.strictEqual(
        result.plugins![0].pluginConfig,
        undefined,
        "nightly mode must NOT inject metadata pluginConfig",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("preserves user-provided pluginConfig in nightly mode", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tech-radar",
        packageName: "@backstage-community/plugin-tech-radar",
        dynamicArtifact:
          "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
        appConfigExamples: {
          techRadar: { url: "http://metadata.example.com" },
        },
      },
    ]);

    try {
      const userPluginConfig = {
        techRadar: { url: "http://user.example.com" },
      };
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
            disabled: false,
            pluginConfig: userPluginConfig,
          },
        ],
      };

      const result = await processPluginsForDeployment(config, metadataDir);

      assert.deepStrictEqual(
        result.plugins![0].pluginConfig,
        userPluginConfig,
        "nightly mode must preserve user pluginConfig exactly as-is",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("resolves OCI plugin to metadata dynamicArtifact in nightly", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:bs_1.45.3__3.33.3!backstage-community-plugin-tekton",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:old_stale_tag!backstage-community-plugin-tekton",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(config, metadataDir);

      assert.ok(
        result.plugins![0].package.includes("bs_1.45.3__3.33.3"),
        "nightly must resolve to metadata dynamicArtifact (latest published version)",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("keeps local path plugins unchanged in nightly", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "red-hat-developer-hub-backstage-plugin-quickstart",
        packageName: "@red-hat-developer-hub/backstage-plugin-quickstart",
        dynamicArtifact:
          "./dynamic-plugins/dist/red-hat-developer-hub-backstage-plugin-quickstart",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "./dynamic-plugins/dist/red-hat-developer-hub-backstage-plugin-quickstart",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(config, metadataDir);

      assert.strictEqual(
        result.plugins![0].package,
        "./dynamic-plugins/dist/red-hat-developer-hub-backstage-plugin-quickstart",
        "local path plugins must not be converted to OCI in nightly",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });
});
