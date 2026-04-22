/**
 * PR mode tests — metadata injection, OCI resolution, skip injection, precedence.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import {
  isNightlyJob,
  processPluginsForDeployment,
  type DynamicPluginsConfig,
} from "../plugin-metadata.js";
import {
  withCleanEnv,
  createMetadataFixture,
  createWorkspaceFixture,
} from "./helpers.js";

describe("processPluginsForDeployment — PR mode", () => {
  const env = withCleanEnv();
  beforeEach(() => {
    env.save();
    delete process.env.E2E_NIGHTLY_MODE;
    delete process.env.JOB_NAME;
    delete process.env.GIT_PR_NUMBER;
  });
  afterEach(() => env.restore());

  it("injects appConfigExamples from metadata as base pluginConfig", async () => {
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

      assert.deepStrictEqual(
        result.plugins![0].pluginConfig,
        { techRadar: { url: "http://default.example.com" } },
        "metadata appConfigExamples must be injected as pluginConfig in PR mode",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("user pluginConfig overrides metadata appConfigExamples", async () => {
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
            pluginConfig: {
              techRadar: { url: "http://custom.example.com" },
            },
          },
        ],
      };

      const result = await processPluginsForDeployment(config, metadataDir);

      assert.strictEqual(
        (result.plugins![0].pluginConfig as Record<string, unknown>)
          .techRadar &&
          (
            (result.plugins![0].pluginConfig as Record<string, unknown>)
              .techRadar as Record<string, unknown>
          ).url,
        "http://custom.example.com",
        "user pluginConfig must override metadata defaults",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("resolves OCI plugin to metadata dynamicArtifact when no PR number", async () => {
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
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:old_tag!backstage-community-plugin-tekton",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(config, metadataDir);

      assert.strictEqual(
        result.plugins![0].package,
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:bs_1.45.3__3.33.3!backstage-community-plugin-tekton",
        "OCI plugin must be resolved to metadata dynamicArtifact",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("keeps local path plugins unchanged", async () => {
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

      const result = await processPluginsForDeployment(config, metadataDir);

      assert.strictEqual(
        result.plugins![0].package,
        "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
        "local path plugins must stay unchanged",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("keeps plugins without metadata unchanged", async () => {
    const metadataDir = await createMetadataFixture([]);

    try {
      const keycloakPackage =
        "./dynamic-plugins/dist/backstage-community-plugin-catalog-backend-module-keycloak-dynamic";
      const config: DynamicPluginsConfig = {
        plugins: [{ package: keycloakPackage, disabled: false }],
      };

      const result = await processPluginsForDeployment(config, metadataDir);

      assert.strictEqual(
        result.plugins![0].package,
        keycloakPackage,
        "plugins not in workspace metadata must stay unchanged",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("resolves OCI plugin from different registry using metadata ref", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-plugin-events-backend-module-github",
        packageName: "@backstage/plugin-events-backend-module-github",
        dynamicArtifact:
          "oci://quay.io/rhdh/backstage-plugin-events-backend-module-github@sha256:abc123",
      },
    ]);

    try {
      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package:
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-plugin-events-backend-module-github:bs_1.45.3__0.4.6",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(config, metadataDir);

      assert.ok(
        result.plugins![0].package.startsWith("oci://quay.io/rhdh/"),
        "must use the actual registry from metadata, not hardcoded ghcr.io",
      );
      assert.strictEqual(
        result.plugins![0].package,
        "oci://quay.io/rhdh/backstage-plugin-events-backend-module-github@sha256:abc123",
        "must use metadata dynamicArtifact exactly",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("skips injection when RHDH_SKIP_PLUGIN_METADATA_INJECTION is 'true'", async () => {
    process.env.RHDH_SKIP_PLUGIN_METADATA_INJECTION = "true";

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
        "pluginConfig must not be injected when RHDH_SKIP_PLUGIN_METADATA_INJECTION=true",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("does not skip injection when RHDH_SKIP_PLUGIN_METADATA_INJECTION is 'false'", async () => {
    process.env.RHDH_SKIP_PLUGIN_METADATA_INJECTION = "false";

    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tech-radar",
        packageName: "@backstage-community/plugin-tech-radar",
        dynamicArtifact:
          "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
        appConfigExamples: { techRadar: { url: "http://example.com" } },
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

      assert.ok(
        result.plugins![0].pluginConfig,
        "pluginConfig must be injected when RHDH_SKIP_PLUGIN_METADATA_INJECTION='false' (strict check)",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("resolves mixed plugin types correctly in a single config", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:bs_1.45.3__3.33.3!backstage-community-plugin-tekton",
      },
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
              "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:old_tag!backstage-community-plugin-tekton",
            disabled: false,
          },
          {
            package:
              "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
            disabled: false,
          },
          {
            package:
              "./dynamic-plugins/dist/backstage-community-plugin-catalog-backend-module-keycloak-dynamic",
            disabled: false,
          },
        ],
      };

      const result = await processPluginsForDeployment(config, metadataDir);
      const plugins = result.plugins!;

      assert.ok(
        plugins[0].package.includes("bs_1.45.3__3.33.3"),
        "OCI plugin with metadata must resolve to metadata dynamicArtifact",
      );
      assert.strictEqual(
        plugins[1].package,
        "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
        "local path plugin with metadata must stay unchanged",
      );
      assert.strictEqual(
        plugins[2].package,
        "./dynamic-plugins/dist/backstage-community-plugin-catalog-backend-module-keycloak-dynamic",
        "plugin without metadata must stay unchanged",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  // ── -dynamic suffix normalization ────────────────────────────────────────

  describe("-dynamic suffix normalization", () => {
    it("resolves OCI plugin to metadata when dynamicArtifact has -dynamic suffix", async () => {
      const metadataDir = await createMetadataFixture([
        {
          name: "backstage-plugin-catalog-backend-module-github",
          packageName: "@backstage/plugin-catalog-backend-module-github",
          dynamicArtifact:
            "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-dynamic",
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
                "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-plugin-catalog-backend-module-github:bs_1.45.3__0.11.2",
              disabled: false,
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);

        assert.ok(
          result.plugins![0].pluginConfig,
          "metadata config must be injected even when dynamicArtifact has -dynamic suffix but OCI URL does not",
        );
        assert.deepStrictEqual(
          result.plugins![0].pluginConfig,
          { catalog: { providers: { github: { org: "test" } } } },
          "injected config must match metadata appConfigExamples",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });

    it("keeps local -dynamic path unchanged when metadata also has -dynamic", async () => {
      const metadataDir = await createMetadataFixture([
        {
          name: "backstage-plugin-catalog-backend-module-github",
          packageName: "@backstage/plugin-catalog-backend-module-github",
          dynamicArtifact:
            "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-dynamic",
        },
      ]);

      try {
        const config: DynamicPluginsConfig = {
          plugins: [
            {
              package:
                "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-dynamic",
              disabled: false,
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);

        assert.strictEqual(
          result.plugins![0].package,
          "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-dynamic",
          "local path with -dynamic must stay unchanged",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });
  });

  // ── PR vs nightly precedence ────────────────────────────────────────────

  describe("PR vs nightly precedence", () => {
    it("isNightlyJob returns false when both GIT_PR_NUMBER and E2E_NIGHTLY_MODE are set", () => {
      process.env.GIT_PR_NUMBER = "42";
      process.env.E2E_NIGHTLY_MODE = "true";
      assert.strictEqual(
        isNightlyJob(),
        false,
        "GIT_PR_NUMBER must make isNightlyJob return false",
      );
    });

    it("injects metadata config when GIT_PR_NUMBER is set (PR mode despite nightly env)", async () => {
      process.env.GIT_PR_NUMBER = "42";
      process.env.E2E_NIGHTLY_MODE = "true";

      const { wsDir, metadataDir } = await createWorkspaceFixture([
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

        assert.ok(
          result.plugins![0].pluginConfig,
          "metadata injection must happen when GIT_PR_NUMBER is set (PR takes precedence over nightly)",
        );
      } finally {
        await fs.remove(wsDir);
      }
    });
  });
});
