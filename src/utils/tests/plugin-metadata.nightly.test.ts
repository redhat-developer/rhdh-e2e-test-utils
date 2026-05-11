/**
 * Nightly mode tests — isNightlyJob detection and nightly plugin resolution.
 */
/* eslint-disable @typescript-eslint/naming-convention -- test fixtures use real plugin config keys with dots/dashes */
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

  it("skips metadata injection for wrapper plugins in nightly mode", async () => {
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

      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@backstage-community/plugin-tech-radar"]),
      );

      assert.strictEqual(
        result.plugins![0].pluginConfig,
        undefined,
        "nightly mode must NOT inject metadata pluginConfig for wrapper plugins",
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

      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(),
      );

      assert.deepStrictEqual(
        result.plugins![0].pluginConfig,
        userPluginConfig,
        "nightly mode must preserve user pluginConfig exactly as-is",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("resolves non-DPDY OCI plugin to metadata dynamicArtifact in nightly", async () => {
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

      // Empty DPDY set — plugin is NOT in default.packages.yaml
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(),
      );

      assert.ok(
        result.plugins![0].package.includes("bs_1.45.3__3.33.3"),
        "non-DPDY OCI plugin must resolve to metadata dynamicArtifact",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("resolves wrapper plugin to wrapper path when user config has stale OCI ref", async () => {
    // Reproduces: metadata says plugin is a wrapper (local path), but user's
    // dynamic-plugins.yaml has a hardcoded OCI ref from a previous version.
    // In nightly mode, the plugin should resolve to the wrapper path from
    // metadata, not pass through the stale OCI ref unchanged.
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-plugin-catalog-backend-module-github-org",
        packageName: "@backstage/plugin-catalog-backend-module-github-org",
        dynamicArtifact:
          "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-org-dynamic",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-plugin-catalog-backend-module-github-org:bs_1.45.3__0.3.16",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(),
      );

      assert.strictEqual(
        result.plugins![0].package,
        "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-org-dynamic",
        "when metadata has a wrapper path, nightly must resolve to wrapper — not pass through stale OCI ref from user config",
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

      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(),
      );

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

// ── {{inherit}} resolution (DPDY plugins) ──────────────────────────────────

describe("processPluginsForDeployment — nightly {{inherit}}", () => {
  const env = withCleanEnv();
  beforeEach(() => {
    env.save();
    delete process.env.GIT_PR_NUMBER;
    process.env.E2E_NIGHTLY_MODE = "true";
  });
  afterEach(() => env.restore());

  it("resolves DPDY OCI plugin to {{inherit}} tag", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:bs_1.49.4__3.33.3!backstage-community-plugin-tekton",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:old_tag",
            disabled: false,
          },
        ],
      };

      const dpdyPackages = new Set(["@backstage-community/plugin-tekton"]);
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        dpdyPackages,
      );

      assert.strictEqual(
        result.plugins![0].package,
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:{{inherit}}",
        "DPDY OCI plugin must resolve to {{inherit}} tag",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("{{inherit}} ref has no !alias suffix", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-topology",
        packageName: "@backstage-community/plugin-topology",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-topology:bs_1.49.4__1.2.0!backstage-community-plugin-topology",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-topology:old",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@backstage-community/plugin-topology"]),
      );

      assert.ok(
        !result.plugins![0].package.includes("!"),
        "{{inherit}} ref must NOT include !alias suffix",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("{{inherit}} preserves registry.access.redhat.com registry from metadata", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "red-hat-developer-hub-backstage-plugin-orchestrator",
        packageName: "@red-hat-developer-hub/backstage-plugin-orchestrator",
        dynamicArtifact:
          "oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-orchestrator@sha256:062a536d",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-orchestrator@sha256:062a536d",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@red-hat-developer-hub/backstage-plugin-orchestrator"]),
      );

      assert.strictEqual(
        result.plugins![0].package,
        "oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-orchestrator:{{inherit}}",
        "{{inherit}} must use registry from metadata, not hardcoded ghcr.io",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("{{inherit}} preserves quay.io registry from metadata", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-cost-management",
        packageName: "@backstage-community/plugin-cost-management",
        dynamicArtifact:
          "oci://quay.io/redhat-resource-optimization/backstage-community-plugin-cost-management@sha256:abc123",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://quay.io/redhat-resource-optimization/backstage-community-plugin-cost-management@sha256:abc123",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@backstage-community/plugin-cost-management"]),
      );

      assert.strictEqual(
        result.plugins![0].package,
        "oci://quay.io/redhat-resource-optimization/backstage-community-plugin-cost-management:{{inherit}}",
        "{{inherit}} must use registry from metadata, not hardcoded ghcr.io",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("DPDY wrapper plugin keeps wrapper path (no {{inherit}})", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tech-radar",
        packageName: "@backstage-community/plugin-tech-radar",
        dynamicArtifact:
          "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
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

      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@backstage-community/plugin-tech-radar"]),
      );

      assert.strictEqual(
        result.plugins![0].package,
        "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
        "DPDY wrapper plugin must keep wrapper path, not use {{inherit}}",
      );
      assert.ok(
        !result.plugins![0].package.includes("inherit"),
        "wrapper plugin must not contain {{inherit}}",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("non-DPDY OCI plugin uses full metadata ref (not {{inherit}})", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "red-hat-developer-hub-backstage-plugin-scorecard",
        packageName: "@red-hat-developer-hub/backstage-plugin-scorecard",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-scorecard:bs_1.49.4__1.0.0!red-hat-developer-hub-backstage-plugin-scorecard",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-scorecard:old",
            disabled: false,
          },
        ],
      };

      // Scorecard is NOT in the DPDY
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@backstage-community/plugin-tekton"]),
      );

      assert.ok(
        result.plugins![0].package.includes("bs_1.49.4__1.0.0"),
        "non-DPDY OCI plugin must use full metadata ref",
      );
      assert.ok(
        !result.plugins![0].package.includes("inherit"),
        "non-DPDY OCI plugin must NOT use {{inherit}}",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("skips config injection for DPDY OCI plugins", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:bs_1.49.4__3.33.3!backstage-community-plugin-tekton",
        appConfigExamples: {
          dynamicPlugins: {
            frontend: {
              "backstage-community.plugin-tekton": { enabled: true },
            },
          },
        },
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:old",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@backstage-community/plugin-tekton"]),
      );

      assert.strictEqual(
        result.plugins![0].pluginConfig,
        undefined,
        "DPDY plugin must NOT get metadata config injected — RHDH provides it via {{inherit}}",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("injects config for non-DPDY OCI plugins", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "red-hat-developer-hub-backstage-plugin-scorecard",
        packageName: "@red-hat-developer-hub/backstage-plugin-scorecard",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-scorecard:bs_1.49.4__1.0.0!red-hat-developer-hub-backstage-plugin-scorecard",
        appConfigExamples: {
          scorecard: { apiUrl: "http://scorecard.example.com" },
        },
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-scorecard:old",
            disabled: false,
          },
        ],
      };

      // Scorecard NOT in DPDY
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(),
      );

      assert.deepStrictEqual(
        result.plugins![0].pluginConfig,
        { scorecard: { apiUrl: "http://scorecard.example.com" } },
        "non-DPDY OCI plugin must get metadata config injected in nightly",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("does not inject config for non-DPDY wrapper plugins", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-plugin-catalog-backend-module-github-org",
        packageName: "@backstage/plugin-catalog-backend-module-github-org",
        dynamicArtifact:
          "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-org-dynamic",
        appConfigExamples: {
          catalog: { providers: { github: { org: "test" } } },
        },
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-org-dynamic",
            disabled: false,
          },
        ],
      };

      // NOT in DPDY, but it's a wrapper — no injection
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(),
      );

      assert.strictEqual(
        result.plugins![0].pluginConfig,
        undefined,
        "non-DPDY wrapper plugin must NOT get metadata config injected",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("mixed scenario: DPDY OCI → inherit, non-DPDY OCI → full ref + config", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:bs_1.49.4__3.33.3!backstage-community-plugin-tekton",
        appConfigExamples: {
          tekton: { enabled: true },
        },
      },
      {
        name: "red-hat-developer-hub-backstage-plugin-scorecard",
        packageName: "@red-hat-developer-hub/backstage-plugin-scorecard",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-scorecard:bs_1.49.4__1.0.0!red-hat-developer-hub-backstage-plugin-scorecard",
        appConfigExamples: {
          scorecard: { apiUrl: "http://scorecard.example.com" },
        },
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:old",
            disabled: false,
          },
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-scorecard:old",
            disabled: false,
          },
        ],
      };

      // Only tekton is in DPDY
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@backstage-community/plugin-tekton"]),
      );

      // Tekton: DPDY → {{inherit}}, no config injection
      assert.ok(
        result.plugins![0].package.includes("{{inherit}}"),
        "DPDY plugin must use {{inherit}}",
      );
      assert.strictEqual(
        result.plugins![0].pluginConfig,
        undefined,
        "DPDY plugin must not have config injected",
      );

      // Scorecard: non-DPDY → full OCI ref, config injected
      assert.ok(
        result.plugins![1].package.includes("bs_1.49.4__1.0.0"),
        "non-DPDY plugin must use full metadata ref",
      );
      assert.deepStrictEqual(
        result.plugins![1].pluginConfig,
        { scorecard: { apiUrl: "http://scorecard.example.com" } },
        "non-DPDY OCI plugin must have config injected",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });
});
