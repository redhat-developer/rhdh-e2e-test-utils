/**
 * Realistic workspace fixture tests — based on actual workspace configurations.
 * Each test simulates a real workspace's dynamic-plugins.yaml pattern.
 */
/* eslint-disable @typescript-eslint/naming-convention -- test fixtures use real plugin config keys with dots/dashes */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import {
  processPluginsForDeployment,
  generatePluginsFromMetadata,
  type DynamicPluginsConfig,
} from "../plugin-metadata.js";
import { withCleanEnv, createMetadataFixture } from "./helpers.js";

describe("processPluginsForDeployment — workspace fixtures", () => {
  const env = withCleanEnv();
  beforeEach(() => env.save());
  afterEach(() => env.restore());

  // ── argocd-like ─────────────────────────────────────────────────────────

  describe("argocd-like workspace (OCI with aliases + local kubernetes)", () => {
    it("resolves OCI plugins to metadata refs and keeps local plugins unchanged", async () => {
      delete process.env.GIT_PR_NUMBER;
      delete process.env.E2E_NIGHTLY_MODE;

      const metadataDir = await createMetadataFixture([
        {
          name: "backstage-community-plugin-argocd",
          packageName: "@backstage-community/plugin-argocd",
          dynamicArtifact:
            "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-argocd:bs_1.45.3__2.4.3!backstage-community-plugin-argocd",
          appConfigExamples: {
            dynamicPlugins: {
              frontend: {
                "backstage-community.plugin-argocd": {
                  mountPoints: [
                    {
                      mountPoint: "entity.page.cd/cards",
                      importName: "EntityArgocdContent",
                    },
                  ],
                },
              },
            },
          },
        },
        {
          name: "backstage-community-plugin-argocd-backend",
          packageName: "@backstage-community/plugin-argocd-backend",
          dynamicArtifact:
            "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-argocd-backend:bs_1.45.3__1.0.2!backstage-community-plugin-argocd-backend",
        },
      ]);

      try {
        const config: DynamicPluginsConfig = {
          plugins: [
            {
              package:
                "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-argocd:old__tag!backstage-community-plugin-argocd",
              disabled: false,
              pluginConfig: {
                dynamicPlugins: {
                  frontend: {
                    "backstage-community.plugin-argocd": {
                      mountPoints: [
                        {
                          mountPoint: "entity.page.cd/cards",
                          importName: "CustomArgoContent",
                        },
                      ],
                    },
                  },
                },
              },
            },
            {
              package:
                "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-argocd-backend:old__tag!backstage-community-plugin-argocd-backend",
              disabled: false,
            },
            {
              package:
                "./dynamic-plugins/dist/backstage-plugin-kubernetes-backend-dynamic",
              disabled: false,
            },
            {
              package: "./dynamic-plugins/dist/backstage-plugin-kubernetes",
              disabled: false,
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);
        const plugins = result.plugins!;

        assert.strictEqual(plugins.length, 4, "must preserve all 4 plugins");

        // OCI argocd frontend → metadata ref
        assert.ok(
          plugins[0].package.includes("bs_1.45.3__2.4.3"),
          "argocd frontend OCI must resolve to metadata version",
        );
        // User pluginConfig overrides metadata
        const frontendConfig = (
          plugins[0].pluginConfig as Record<string, unknown>
        )?.dynamicPlugins as Record<string, unknown>;
        const frontend = frontendConfig?.frontend as Record<string, unknown>;
        const argoMount = frontend?.[
          "backstage-community.plugin-argocd"
        ] as Record<string, unknown>;
        const mounts = argoMount?.mountPoints as Array<Record<string, string>>;
        assert.strictEqual(
          mounts?.[0]?.importName,
          "CustomArgoContent",
          "user pluginConfig must override metadata mountPoints",
        );

        // OCI argocd backend → metadata ref
        assert.ok(
          plugins[1].package.includes("bs_1.45.3__1.0.2"),
          "argocd backend OCI must resolve to metadata version",
        );

        // Cross-workspace kubernetes plugins (no metadata) → unchanged
        assert.strictEqual(
          plugins[2].package,
          "./dynamic-plugins/dist/backstage-plugin-kubernetes-backend-dynamic",
          "cross-workspace local plugin must stay unchanged",
        );
        assert.strictEqual(
          plugins[3].package,
          "./dynamic-plugins/dist/backstage-plugin-kubernetes",
          "cross-workspace local plugin must stay unchanged",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });
  });

  // ── scorecard-like ──────────────────────────────────────────────────────

  describe("scorecard-like workspace (disabled plugin + cross-workspace OCI)", () => {
    it("preserves disabled flag and handles cross-workspace OCI plugin", async () => {
      delete process.env.GIT_PR_NUMBER;
      delete process.env.E2E_NIGHTLY_MODE;

      const metadataDir = await createMetadataFixture([
        {
          name: "rhdh-backstage-plugin-scorecard",
          packageName: "@red-hat-developer-hub/backstage-plugin-scorecard",
          dynamicArtifact:
            "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-scorecard:bs_1.45.3__2.3.5!red-hat-developer-hub-backstage-plugin-scorecard",
        },
      ]);

      try {
        const config: DynamicPluginsConfig = {
          plugins: [
            {
              package:
                "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-scorecard:old_tag!red-hat-developer-hub-backstage-plugin-scorecard",
              disabled: false,
              pluginConfig: { dynamicPlugins: { frontend: {} } },
            },
            {
              package:
                "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-dynamic-home-page:bs_1.45.3__1.10.3!red-hat-developer-hub-backstage-plugin-dynamic-home-page",
              disabled: false,
            },
            {
              package:
                "./dynamic-plugins/dist/red-hat-developer-hub-backstage-plugin-dynamic-home-page",
              disabled: true,
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);
        const plugins = result.plugins!;

        assert.strictEqual(plugins.length, 3, "must preserve all 3 plugins");

        assert.ok(
          plugins[0].package.includes("bs_1.45.3__2.3.5"),
          "scorecard must resolve to metadata ref",
        );

        assert.ok(
          plugins[1].package.includes("bs_1.45.3__1.10.3"),
          "cross-workspace OCI plugin must keep original tag",
        );

        assert.strictEqual(
          plugins[2].disabled,
          true,
          "disabled flag must be preserved",
        );
        assert.strictEqual(
          plugins[2].package,
          "./dynamic-plugins/dist/red-hat-developer-hub-backstage-plugin-dynamic-home-page",
          "disabled local path must stay unchanged",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });
  });

  // ── github-events-like ──────────────────────────────────────────────────

  describe("github-events-like workspace (OCI without aliases + different registries)", () => {
    it("resolves each OCI to correct metadata registry in nightly", async () => {
      delete process.env.GIT_PR_NUMBER;
      process.env.E2E_NIGHTLY_MODE = "true";

      const metadataDir = await createMetadataFixture([
        {
          name: "backstage-plugin-events-backend-module-github",
          packageName: "@backstage/plugin-events-backend-module-github",
          dynamicArtifact:
            "oci://quay.io/rhdh/backstage-plugin-events-backend-module-github@sha256:c1d17d47aaa",
        },
        {
          name: "backstage-plugin-catalog-backend-module-github-dynamic",
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
                "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-plugin-events-backend-module-github:bs_1.45.3__0.4.6",
              disabled: false,
              pluginConfig: {
                events: { http: { topics: ["github"] } },
              },
            },
            {
              package:
                "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-dynamic",
              disabled: false,
              pluginConfig: {
                catalog: { providers: { github: { org: "janus-qe" } } },
              },
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);
        const plugins = result.plugins!;

        assert.ok(
          plugins[0].package.startsWith("oci://quay.io/rhdh/"),
          "must use quay.io registry from metadata, not the ghcr.io from user config",
        );
        assert.ok(
          plugins[0].package.includes("@sha256:c1d17d47aaa"),
          "must preserve digest from metadata",
        );

        assert.deepStrictEqual(
          plugins[0].pluginConfig,
          { events: { http: { topics: ["github"] } } },
          "nightly must preserve user pluginConfig without metadata injection",
        );

        assert.strictEqual(
          plugins[1].package,
          "./dynamic-plugins/dist/backstage-plugin-catalog-backend-module-github-dynamic",
          "local path from metadata must stay unchanged",
        );

        assert.deepStrictEqual(
          plugins[1].pluginConfig,
          { catalog: { providers: { github: { org: "janus-qe" } } } },
          "nightly must preserve user pluginConfig for local path plugin",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });
  });

  // ── topology-like ───────────────────────────────────────────────────────

  describe("topology-like workspace (all local paths, no OCI)", () => {
    it("keeps all local plugins unchanged in both PR and nightly modes", async () => {
      const metadataDir = await createMetadataFixture([
        {
          name: "backstage-community-plugin-topology",
          packageName: "@backstage-community/plugin-topology",
          dynamicArtifact:
            "./dynamic-plugins/dist/backstage-community-plugin-topology",
          appConfigExamples: {
            dynamicPlugins: {
              frontend: {
                "backstage-community.plugin-topology": {
                  mountPoints: [{ mountPoint: "entity.page.topology/cards" }],
                },
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
                "./dynamic-plugins/dist/backstage-community-plugin-topology",
              disabled: false,
            },
            {
              package:
                "./dynamic-plugins/dist/backstage-plugin-kubernetes-backend-dynamic",
              disabled: false,
            },
            {
              package: "./dynamic-plugins/dist/backstage-plugin-kubernetes",
              disabled: false,
            },
          ],
        };

        // PR mode
        delete process.env.GIT_PR_NUMBER;
        delete process.env.E2E_NIGHTLY_MODE;
        const prResult = await processPluginsForDeployment(config, metadataDir);

        assert.ok(
          prResult.plugins![0].pluginConfig,
          "PR mode must inject pluginConfig for topology",
        );
        assert.strictEqual(
          prResult.plugins![0].package,
          "./dynamic-plugins/dist/backstage-community-plugin-topology",
          "local path must stay unchanged in PR mode",
        );

        // Nightly mode
        process.env.E2E_NIGHTLY_MODE = "true";
        const nightlyResult = await processPluginsForDeployment(
          { ...config, plugins: config.plugins!.map((p) => ({ ...p })) },
          metadataDir,
        );

        assert.strictEqual(
          nightlyResult.plugins![0].pluginConfig,
          undefined,
          "nightly must not inject pluginConfig",
        );

        for (const result of [prResult, nightlyResult]) {
          for (const plugin of result.plugins!) {
            assert.ok(
              plugin.package.startsWith("./dynamic-plugins/dist/"),
              `all plugins must stay as local paths, got: ${plugin.package}`,
            );
          }
        }
      } finally {
        await fs.remove(metadataDir);
      }
    });
  });

  // ── global-header-like ──────────────────────────────────────────────────

  describe("global-header-like workspace (npm package passthrough)", () => {
    it("keeps npm package references with integrity unchanged", async () => {
      delete process.env.GIT_PR_NUMBER;
      delete process.env.E2E_NIGHTLY_MODE;

      const metadataDir = await createMetadataFixture([]);

      try {
        const npmPackage =
          "@red-hat-developer-hub/backstage-plugin-global-header-test@0.0.2";
        const config: DynamicPluginsConfig = {
          plugins: [
            {
              package: npmPackage,
              disabled: false,
              integrity: "sha512-ABC123...",
              pluginConfig: { dynamicPlugins: { frontend: {} } },
            },
            {
              package:
                "./dynamic-plugins/dist/red-hat-developer-hub-backstage-plugin-global-header",
              disabled: false,
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);

        assert.strictEqual(
          result.plugins![0].package,
          npmPackage,
          "npm package reference must pass through unchanged",
        );
        assert.strictEqual(
          result.plugins![0].integrity,
          "sha512-ABC123...",
          "integrity hash must be preserved",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });
  });

  // ── tech-radar-like (auto-generate) ─────────────────────────────────────

  describe("auto-generate from metadata (tech-radar-like, no user config)", () => {
    it("generates correct entries from metadata with mixed artifact types", async () => {
      const metadataDir = await createMetadataFixture([
        {
          name: "backstage-community-plugin-tech-radar",
          packageName: "@backstage-community/plugin-tech-radar",
          dynamicArtifact:
            "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
          appConfigExamples: {
            techRadar: { url: "http://example.com/tech-radar" },
          },
        },
        {
          name: "backstage-community-plugin-tech-radar-backend-dynamic",
          packageName: "@backstage-community/plugin-tech-radar-backend",
          dynamicArtifact:
            "./dynamic-plugins/dist/backstage-community-plugin-tech-radar-backend-dynamic",
        },
      ]);

      try {
        const generated = await generatePluginsFromMetadata(metadataDir);

        assert.strictEqual(
          generated.plugins!.length,
          2,
          "must generate 2 entries",
        );

        for (const plugin of generated.plugins!) {
          assert.strictEqual(
            plugin.disabled,
            false,
            "generated plugins must be enabled",
          );
          assert.strictEqual(
            plugin.pluginConfig,
            undefined,
            "generated plugins must NOT include pluginConfig",
          );
        }

        const packages = generated.plugins!.map((p) => p.package).sort();
        assert.ok(
          packages.includes(
            "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
          ),
          "must include tech-radar frontend",
        );
        assert.ok(
          packages.includes(
            "./dynamic-plugins/dist/backstage-community-plugin-tech-radar-backend-dynamic",
          ),
          "must include tech-radar backend",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });
  });

  // ── orchestrator-like ───────────────────────────────────────────────────

  describe("registry.access.redhat.com plugins (orchestrator-like)", () => {
    it("resolves to registry.access.redhat.com from metadata", async () => {
      delete process.env.GIT_PR_NUMBER;
      delete process.env.E2E_NIGHTLY_MODE;

      const metadataDir = await createMetadataFixture([
        {
          name: "redhat-backstage-plugin-orchestrator",
          packageName: "@redhat/backstage-plugin-orchestrator",
          dynamicArtifact:
            "oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-orchestrator@sha256:f40d39fb7599",
        },
      ]);

      try {
        const config: DynamicPluginsConfig = {
          plugins: [
            {
              package:
                "oci://ghcr.io/some/other/red-hat-developer-hub-backstage-plugin-orchestrator:some_tag",
              disabled: false,
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);

        assert.ok(
          result.plugins![0].package.startsWith(
            "oci://registry.access.redhat.com/rhdh/",
          ),
          "must use registry.access.redhat.com from metadata",
        );
        assert.ok(
          result.plugins![0].package.includes("@sha256:f40d39fb7599"),
          "must preserve digest from metadata",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns config as-is when plugins array is undefined", async () => {
      const config = { includes: ["dynamic-plugins.default.yaml"] };
      const result = await processPluginsForDeployment(
        config as DynamicPluginsConfig,
      );
      assert.deepStrictEqual(result, config);
    });

    it("handles empty plugins array", async () => {
      const metadataDir = await createMetadataFixture([]);
      try {
        const config: DynamicPluginsConfig = { plugins: [] };
        const result = await processPluginsForDeployment(config, metadataDir);
        assert.strictEqual(result.plugins!.length, 0);
      } finally {
        await fs.remove(metadataDir);
      }
    });

    it("preserves includes and other top-level fields", async () => {
      const metadataDir = await createMetadataFixture([]);
      try {
        const config: DynamicPluginsConfig = {
          includes: ["dynamic-plugins.default.yaml"],
          plugins: [],
        };
        const result = await processPluginsForDeployment(config, metadataDir);
        assert.deepStrictEqual(result.includes, [
          "dynamic-plugins.default.yaml",
        ]);
      } finally {
        await fs.remove(metadataDir);
      }
    });

    it("preserves extra fields on plugin entries (integrity, custom keys)", async () => {
      const metadataDir = await createMetadataFixture([]);
      try {
        const config: DynamicPluginsConfig = {
          plugins: [
            {
              package: "./dynamic-plugins/dist/some-plugin",
              disabled: false,
              integrity: "sha512-hash",
              customField: "value",
            },
          ],
        };
        const result = await processPluginsForDeployment(config, metadataDir);
        assert.strictEqual(result.plugins![0].integrity, "sha512-hash");
        assert.strictEqual(result.plugins![0].customField, "value");
      } finally {
        await fs.remove(metadataDir);
      }
    });

    it("does not inject pluginConfig for plugins with no appConfigExamples", async () => {
      delete process.env.GIT_PR_NUMBER;
      delete process.env.E2E_NIGHTLY_MODE;

      const metadataDir = await createMetadataFixture([
        {
          name: "backstage-plugin-kubernetes-backend-dynamic",
          packageName: "@backstage/plugin-kubernetes-backend",
          dynamicArtifact:
            "./dynamic-plugins/dist/backstage-plugin-kubernetes-backend-dynamic",
        },
      ]);

      try {
        const config: DynamicPluginsConfig = {
          plugins: [
            {
              package:
                "./dynamic-plugins/dist/backstage-plugin-kubernetes-backend-dynamic",
              disabled: false,
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);

        const pc = result.plugins![0].pluginConfig;
        if (pc) {
          assert.deepStrictEqual(
            pc,
            {},
            "plugins without appConfigExamples must get empty pluginConfig or undefined",
          );
        }
      } finally {
        await fs.remove(metadataDir);
      }
    });

    it("deep merges nested pluginConfig (metadata base + user partial override)", async () => {
      delete process.env.GIT_PR_NUMBER;
      delete process.env.E2E_NIGHTLY_MODE;

      const metadataDir = await createMetadataFixture([
        {
          name: "backstage-community-plugin-argocd",
          packageName: "@backstage-community/plugin-argocd",
          dynamicArtifact:
            "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-argocd:bs_1.45.3__2.4.3!backstage-community-plugin-argocd",
          appConfigExamples: {
            dynamicPlugins: {
              frontend: {
                "backstage-community.plugin-argocd": {
                  mountPoints: [
                    {
                      mountPoint: "entity.page.cd/cards",
                      importName: "ArgoContent",
                    },
                  ],
                  entityTabs: [{ path: "/cd", title: "CD" }],
                },
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
                "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-argocd:old!backstage-community-plugin-argocd",
              disabled: false,
              pluginConfig: {
                dynamicPlugins: {
                  frontend: {
                    "backstage-community.plugin-argocd": {
                      mountPoints: [
                        {
                          mountPoint: "entity.page.cd/cards",
                          importName: "CustomArgo",
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);
        const pc = result.plugins![0].pluginConfig as Record<string, unknown>;
        const dp = pc?.dynamicPlugins as Record<string, unknown>;
        const fe = dp?.frontend as Record<string, unknown>;
        const argoConfig = fe?.["backstage-community.plugin-argocd"] as Record<
          string,
          unknown
        >;

        const mounts = argoConfig?.mountPoints as Array<Record<string, string>>;
        assert.strictEqual(
          mounts?.[0]?.importName,
          "CustomArgo",
          "user mountPoints must override metadata mountPoints",
        );

        const tabs = argoConfig?.entityTabs as Array<Record<string, string>>;
        assert.ok(
          tabs,
          "entityTabs from metadata must be preserved when user doesn't override",
        );
        assert.strictEqual(
          tabs?.[0]?.path,
          "/cd",
          "entityTabs must come from metadata base",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });

    it("handles non-existent metadata directory gracefully", async () => {
      delete process.env.GIT_PR_NUMBER;
      delete process.env.E2E_NIGHTLY_MODE;

      const config: DynamicPluginsConfig = {
        plugins: [
          {
            package: "./dynamic-plugins/dist/some-plugin",
            disabled: false,
            pluginConfig: { key: "value" },
          },
        ],
      };

      const result = await processPluginsForDeployment(
        config,
        "/tmp/nonexistent-metadata-dir-12345",
      );

      assert.strictEqual(
        result.plugins![0].package,
        "./dynamic-plugins/dist/some-plugin",
        "plugin must pass through when metadata dir doesn't exist",
      );
      assert.deepStrictEqual(
        result.plugins![0].pluginConfig,
        { key: "value" },
        "pluginConfig must be preserved when metadata dir doesn't exist",
      );
    });

    it("config has local path but metadata has OCI artifact for same plugin", async () => {
      delete process.env.GIT_PR_NUMBER;
      delete process.env.E2E_NIGHTLY_MODE;

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
                "./dynamic-plugins/dist/backstage-community-plugin-tekton",
              disabled: false,
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);

        assert.ok(
          result.plugins![0].package.startsWith("oci://"),
          "local path in config must be resolved to OCI when metadata has OCI dynamicArtifact",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });

    it("shared OCI image with alias (redhat-resource-optimization pattern)", async () => {
      delete process.env.GIT_PR_NUMBER;
      delete process.env.E2E_NIGHTLY_MODE;

      const metadataDir = await createMetadataFixture([
        {
          name: "redhat-resource-optimization",
          packageName:
            "@red-hat-developer-hub/plugin-redhat-resource-optimization",
          dynamicArtifact:
            "oci://quay.io/redhat-resource-optimization/dynamic-plugins:1.3.2!red-hat-developer-hub-plugin-redhat-resource-optimization",
        },
      ]);

      try {
        const config: DynamicPluginsConfig = {
          plugins: [
            {
              package:
                "oci://quay.io/redhat-resource-optimization/dynamic-plugins:old_tag!red-hat-developer-hub-plugin-redhat-resource-optimization",
              disabled: false,
            },
          ],
        };

        const result = await processPluginsForDeployment(config, metadataDir);

        assert.strictEqual(
          result.plugins![0].package,
          "oci://quay.io/redhat-resource-optimization/dynamic-plugins:1.3.2!red-hat-developer-hub-plugin-redhat-resource-optimization",
          "shared OCI image must resolve to metadata version with alias preserved",
        );
      } finally {
        await fs.remove(metadataDir);
      }
    });
  });
});
