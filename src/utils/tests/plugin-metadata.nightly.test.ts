/**
 * Nightly mode tests — isNightlyJob detection and nightly plugin resolution.
 */
/* eslint-disable @typescript-eslint/naming-convention -- test fixtures use real plugin config keys with dots/dashes */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import path from "path";
import os from "os";
import yaml from "js-yaml";
import {
  isNightlyJob,
  processPluginsForDeployment,
  getDpdyRegistry,
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

  it("resolves DPDY OCI plugin to {{inherit}} tag with default RHEC registry", async () => {
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
        "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-tekton:{{inherit}}",
        "DPDY OCI plugin must resolve to {{inherit}} with default RHEC registry",
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

      assert.strictEqual(
        result.plugins![0].package,
        "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-topology:{{inherit}}",
        "{{inherit}} ref must use default RHEC registry with no alias suffix",
      );
      assert.ok(
        !result.plugins![0].package.includes("!"),
        "{{inherit}} ref must NOT include !alias suffix",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("{{inherit}} uses default RHEC even when metadata has ghcr.io (PR #2449 scenario)", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "red-hat-developer-hub-backstage-plugin-orchestrator",
        packageName: "@red-hat-developer-hub/backstage-plugin-orchestrator",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-orchestrator:bs_1.49.4__5.7.10!red-hat-developer-hub-backstage-plugin-orchestrator",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-orchestrator:old",
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
        "{{inherit}} must use default RHEC registry regardless of metadata's ghcr.io",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("NIGHTLY_DPDY_OCI_REGISTRY overrides default registry for all plugins", async () => {
    process.env.NIGHTLY_DPDY_OCI_REGISTRY =
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays";

    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-tekton@sha256:abc",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-tekton@sha256:abc",
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
        result.plugins![0].package,
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:{{inherit}}",
        "NIGHTLY_DPDY_OCI_REGISTRY must override default RHEC registry",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("NIGHTLY_DPDY_OCI_REGISTRY_MAP overrides registry for specific plugins", async () => {
    process.env.NIGHTLY_DPDY_OCI_REGISTRY_MAP = JSON.stringify({
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays": [
        "@backstage-community/plugin-tekton",
      ],
    });

    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-tekton@sha256:abc",
      },
      {
        name: "red-hat-developer-hub-backstage-plugin-orchestrator",
        packageName: "@red-hat-developer-hub/backstage-plugin-orchestrator",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-orchestrator:bs_1.49.4__5.7.10!red-hat-developer-hub-backstage-plugin-orchestrator",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-tekton@sha256:abc",
            disabled: false,
          },
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-orchestrator:old",
            disabled: false,
          },
        ],
      };

      const dpdyPackages = new Set([
        "@backstage-community/plugin-tekton",
        "@red-hat-developer-hub/backstage-plugin-orchestrator",
      ]);
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        dpdyPackages,
      );

      assert.strictEqual(
        result.plugins![0].package,
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:{{inherit}}",
        "tekton must use ghcr.io from NIGHTLY_DPDY_OCI_REGISTRY_MAP",
      );
      assert.strictEqual(
        result.plugins![1].package,
        "oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-orchestrator:{{inherit}}",
        "orchestrator must use default RHEC (not in map)",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("NIGHTLY_DPDY_OCI_REGISTRY_MAP takes precedence over NIGHTLY_DPDY_OCI_REGISTRY", async () => {
    process.env.NIGHTLY_DPDY_OCI_REGISTRY = "quay.io/rhdh";
    process.env.NIGHTLY_DPDY_OCI_REGISTRY_MAP = JSON.stringify({
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays": [
        "@backstage-community/plugin-tekton",
      ],
    });

    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-tekton@sha256:abc",
      },
      {
        name: "red-hat-developer-hub-backstage-plugin-orchestrator",
        packageName: "@red-hat-developer-hub/backstage-plugin-orchestrator",
        dynamicArtifact:
          "oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-orchestrator@sha256:def",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-tekton@sha256:abc",
            disabled: false,
          },
          {
            package:
              "oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-orchestrator@sha256:def",
            disabled: false,
          },
        ],
      };

      const dpdyPackages = new Set([
        "@backstage-community/plugin-tekton",
        "@red-hat-developer-hub/backstage-plugin-orchestrator",
      ]);
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        dpdyPackages,
      );

      assert.strictEqual(
        result.plugins![0].package,
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:{{inherit}}",
        "tekton must use ghcr.io from MAP (takes precedence over blanket)",
      );
      assert.strictEqual(
        result.plugins![1].package,
        "oci://quay.io/rhdh/red-hat-developer-hub-backstage-plugin-orchestrator:{{inherit}}",
        "orchestrator must use quay.io from NIGHTLY_DPDY_OCI_REGISTRY (blanket fallback)",
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

  it("mixed scenario: DPDY OCI → RHEC inherit, non-DPDY OCI → full ref + config", async () => {
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

      // Tekton: DPDY → {{inherit}} with default RHEC, no config injection
      assert.strictEqual(
        result.plugins![0].package,
        "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-tekton:{{inherit}}",
        "DPDY plugin must use {{inherit}} with default RHEC registry",
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

// ── getDpdyRegistry unit tests ──────────────────────────────────────────────

describe("getDpdyRegistry", () => {
  const env = withCleanEnv();
  beforeEach(() => env.save());
  afterEach(() => env.restore());

  it("returns default RHEC registry when no env vars set", () => {
    delete process.env.NIGHTLY_DPDY_OCI_REGISTRY;
    delete process.env.NIGHTLY_DPDY_OCI_REGISTRY_MAP;

    assert.strictEqual(
      getDpdyRegistry("@backstage-community/plugin-tekton"),
      "registry.access.redhat.com/rhdh",
    );
  });

  it("NIGHTLY_DPDY_OCI_REGISTRY overrides default for all plugins", () => {
    process.env.NIGHTLY_DPDY_OCI_REGISTRY =
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays";
    delete process.env.NIGHTLY_DPDY_OCI_REGISTRY_MAP;

    assert.strictEqual(
      getDpdyRegistry("@backstage-community/plugin-tekton"),
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays",
    );
    assert.strictEqual(
      getDpdyRegistry("@red-hat-developer-hub/backstage-plugin-orchestrator"),
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays",
    );
  });

  it("NIGHTLY_DPDY_OCI_REGISTRY_MAP returns mapped registry for listed plugin", () => {
    delete process.env.NIGHTLY_DPDY_OCI_REGISTRY;
    process.env.NIGHTLY_DPDY_OCI_REGISTRY_MAP = JSON.stringify({
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays": [
        "@backstage-community/plugin-tekton",
        "@backstage-community/plugin-argocd",
      ],
    });

    assert.strictEqual(
      getDpdyRegistry("@backstage-community/plugin-tekton"),
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays",
    );
    assert.strictEqual(
      getDpdyRegistry("@backstage-community/plugin-argocd"),
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays",
    );
  });

  it("NIGHTLY_DPDY_OCI_REGISTRY_MAP falls back to default for unlisted plugin", () => {
    delete process.env.NIGHTLY_DPDY_OCI_REGISTRY;
    process.env.NIGHTLY_DPDY_OCI_REGISTRY_MAP = JSON.stringify({
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays": [
        "@backstage-community/plugin-tekton",
      ],
    });

    assert.strictEqual(
      getDpdyRegistry("@red-hat-developer-hub/backstage-plugin-orchestrator"),
      "registry.access.redhat.com/rhdh",
      "unlisted plugin must fall back to default RHEC",
    );
  });

  it("NIGHTLY_DPDY_OCI_REGISTRY_MAP takes precedence over NIGHTLY_DPDY_OCI_REGISTRY", () => {
    process.env.NIGHTLY_DPDY_OCI_REGISTRY = "quay.io/rhdh";
    process.env.NIGHTLY_DPDY_OCI_REGISTRY_MAP = JSON.stringify({
      "ghcr.io/custom": ["@backstage-community/plugin-tekton"],
    });

    assert.strictEqual(
      getDpdyRegistry("@backstage-community/plugin-tekton"),
      "ghcr.io/custom",
      "MAP must take precedence over blanket",
    );
    assert.strictEqual(
      getDpdyRegistry("@red-hat-developer-hub/backstage-plugin-orchestrator"),
      "quay.io/rhdh",
      "unlisted plugin must fall back to blanket NIGHTLY_DPDY_OCI_REGISTRY",
    );
  });

  it("supports multiple registries in NIGHTLY_DPDY_OCI_REGISTRY_MAP", () => {
    delete process.env.NIGHTLY_DPDY_OCI_REGISTRY;
    process.env.NIGHTLY_DPDY_OCI_REGISTRY_MAP = JSON.stringify({
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays": [
        "@backstage-community/plugin-tekton",
      ],
      "quay.io/rhdh": ["@red-hat-developer-hub/backstage-plugin-orchestrator"],
    });

    assert.strictEqual(
      getDpdyRegistry("@backstage-community/plugin-tekton"),
      "ghcr.io/redhat-developer/rhdh-plugin-export-overlays",
    );
    assert.strictEqual(
      getDpdyRegistry("@red-hat-developer-hub/backstage-plugin-orchestrator"),
      "quay.io/rhdh",
    );
    assert.strictEqual(
      getDpdyRegistry("@backstage-community/plugin-argocd"),
      "registry.access.redhat.com/rhdh",
      "unlisted plugin falls back to default",
    );
  });
});

// ── Nightly coverage image swap ──────────────────────────────────────────────

describe("processPluginsForDeployment — nightly coverage swap", () => {
  const env = withCleanEnv();
  beforeEach(() => {
    env.save();
    delete process.env.GIT_PR_NUMBER;
    process.env.E2E_NIGHTLY_MODE = "true";
  });
  afterEach(() => env.restore());

  const OCI_REF =
    "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-theme:bs_1.49.4__0.14.5!red-hat-developer-hub-backstage-plugin-theme";

  // Builds a workspace layout (<ws>/metadata + optional <ws>/coverage-anchors)
  // and returns the metadata dir to pass as metadataPath. The resolver derives
  // the workspace root as the parent of the metadata dir.
  async function createCoverageWorkspace(opts: {
    rolledOut: boolean;
    role?: string;
  }): Promise<string> {
    const ws = await fs.mkdtemp(path.join(os.tmpdir(), "cov-ws-"));
    const metadataDir = path.join(ws, "metadata");
    await fs.ensureDir(metadataDir);
    if (opts.rolledOut) {
      await fs.ensureDir(path.join(ws, "coverage-anchors"));
    }
    await fs.writeFile(
      path.join(metadataDir, "theme.yaml"),
      yaml.dump({
        apiVersion: "extensions.backstage.io/v1alpha1",
        kind: "Package",
        metadata: { name: "theme" },
        spec: {
          packageName: "@red-hat-developer-hub/backstage-plugin-theme",
          dynamicArtifact: OCI_REF,
          ...(opts.role ? { backstage: { role: opts.role } } : {}),
        },
      }),
    );
    return metadataDir;
  }

  const config: DynamicPluginsConfig = {
    plugins: [{ package: OCI_REF, disabled: false }],
  };

  async function resolveWith(metadataDir: string): Promise<string> {
    const result = await processPluginsForDeployment(
      config,
      metadataDir,
      new Set(), // empty DPDY → OCI-direct branch, not {{inherit}}
    );
    return result.plugins![0].package;
  }

  it("swaps to the __coverage image for a rolled-out frontend plugin when opted in", async () => {
    process.env.E2E_NIGHTLY_COVERAGE = "true";
    const metadataDir = await createCoverageWorkspace({
      rolledOut: true,
      role: "frontend-plugin",
    });
    try {
      const pkg = await resolveWith(metadataDir);
      assert.strictEqual(
        pkg,
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-theme:bs_1.49.4__0.14.5__coverage!red-hat-developer-hub-backstage-plugin-theme",
        "tag must get the __coverage suffix, the !path must be preserved",
      );
    } finally {
      await fs.remove(path.resolve(metadataDir, ".."));
    }
  });

  it("does NOT swap in the functional nightly (E2E_NIGHTLY_COVERAGE unset), even with E2E_COLLECT_COVERAGE on", async () => {
    // The functional nightly runs with E2E_COLLECT_COVERAGE=true by default but
    // must keep deploying the released image — swapping there could point at a
    // __coverage tag that doesn't exist and break the deployment.
    process.env.E2E_COLLECT_COVERAGE = "true";
    delete process.env.E2E_NIGHTLY_COVERAGE;
    const metadataDir = await createCoverageWorkspace({
      rolledOut: true,
      role: "frontend-plugin",
    });
    try {
      assert.strictEqual(
        await resolveWith(metadataDir),
        OCI_REF,
        "functional nightly resolution must be unchanged (no swap)",
      );
    } finally {
      await fs.remove(path.resolve(metadataDir, ".."));
    }
  });

  it("does not swap when the workspace has no coverage-anchors (not rolled out)", async () => {
    process.env.E2E_NIGHTLY_COVERAGE = "true";
    const metadataDir = await createCoverageWorkspace({
      rolledOut: false,
      role: "frontend-plugin",
    });
    try {
      assert.strictEqual(await resolveWith(metadataDir), OCI_REF);
    } finally {
      await fs.remove(path.resolve(metadataDir, ".."));
    }
  });

  it("does not swap a non-frontend plugin even when rolled out and opted in", async () => {
    process.env.E2E_NIGHTLY_COVERAGE = "true";
    const metadataDir = await createCoverageWorkspace({
      rolledOut: true,
      role: "backend-plugin",
    });
    try {
      assert.strictEqual(await resolveWith(metadataDir), OCI_REF);
    } finally {
      await fs.remove(path.resolve(metadataDir, ".."));
    }
  });

  it("swaps a DPDY plugin to the ghcr __coverage build (bypassing {{inherit}}) when opted in", async () => {
    // A {{inherit}} ref would deploy the Konflux catalog image, which can't be
    // instrumented. In a coverage run, a rolled-out frontend DPDY plugin must
    // instead use the overlay's instrumented ghcr build of the same source.
    process.env.E2E_NIGHTLY_COVERAGE = "true";
    const metadataDir = await createCoverageWorkspace({
      rolledOut: true,
      role: "frontend-plugin",
    });
    try {
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@red-hat-developer-hub/backstage-plugin-theme"]), // in DPDY
      );
      assert.strictEqual(
        result.plugins![0].package,
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-theme:bs_1.49.4__0.14.5__coverage!red-hat-developer-hub-backstage-plugin-theme",
        "DPDY plugin in a coverage run must use the ghcr __coverage build, not {{inherit}}",
      );
    } finally {
      await fs.remove(path.resolve(metadataDir, ".."));
    }
  });

  it("keeps a DPDY plugin on {{inherit}} in the functional nightly (no opt-in)", async () => {
    // The functional nightly (no E2E_NIGHTLY_COVERAGE) must still deploy the
    // shipped Konflux build via {{inherit}} — unchanged from today.
    delete process.env.E2E_NIGHTLY_COVERAGE;
    const metadataDir = await createCoverageWorkspace({
      rolledOut: true,
      role: "frontend-plugin",
    });
    try {
      const result = await processPluginsForDeployment(
        config,
        metadataDir,
        new Set(["@red-hat-developer-hub/backstage-plugin-theme"]), // in DPDY
      );
      assert.strictEqual(
        result.plugins![0].package,
        "oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-theme:{{inherit}}",
        "functional nightly must keep DPDY plugins on {{inherit}}",
      );
    } finally {
      await fs.remove(path.resolve(metadataDir, ".."));
    }
  });
});
