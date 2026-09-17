import { describe, it } from "node:test";
import assert from "node:assert";
import { deepMerge } from "../../utils/merge-yamls.js";
import { getNormalizedPluginMergeKey } from "../../utils/plugin-metadata.js";

/**
 * Tests the merge behavior used when user dynamic-plugins config does not exist:
 * auth config (e.g. keycloak) is merged with metadata config using normalized plugin key.
 * Result must have exactly one entry per logical plugin; metadata (source) wins so OCI URL is kept.
 */
describe("dynamic-plugins merge (no user config path)", () => {
  it("yields one keycloak plugin with OCI package when auth has local path and metadata has OCI", () => {
    const authPlugins: Record<string, unknown> = {
      plugins: [
        {
          package:
            "./dynamic-plugins/dist/backstage-community-plugin-catalog-backend-module-keycloak-dynamic",
          disabled: false,
          pluginConfig: {},
        },
      ],
      includes: ["dynamic-plugins.default.yaml"],
    };
    const metadataConfig: Record<string, unknown> = {
      plugins: [
        {
          package:
            "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-catalog-backend-module-keycloak:pr_1980__3.16.0!backstage-community-plugin-catalog-backend-module-keycloak",
          disabled: false,
          pluginConfig: { catalog: { providers: { keycloakOrg: {} } } },
        },
      ],
    };
    const merged = deepMerge(authPlugins, metadataConfig, {
      arrayMergeStrategy: {
        byKey: "package",
        normalizeKey: (item) =>
          getNormalizedPluginMergeKey(item as Record<string, unknown>),
      },
    });
    const plugins = merged.plugins as Array<{ package?: string }>;
    assert.strictEqual(
      plugins.length,
      1,
      "merged config must have exactly one keycloak plugin",
    );
    assert.ok(
      plugins[0].package?.startsWith("oci://"),
      "metadata (OCI) must win over auth local path",
    );
  });

  it("keeps user app-auth OCI ref over NFS defaults for same logical plugin", () => {
    const nfsDefaults: Record<string, unknown> = {
      plugins: [
        {
          package:
            "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-app-auth:bs_1.49.4__0.0.1",
          disabled: false,
        },
      ],
    };
    const userPlugins: Record<string, unknown> = {
      plugins: [
        {
          package:
            "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-app-auth:older__0.0.1",
          disabled: false,
        },
      ],
    };
    const merged = deepMerge(nfsDefaults, userPlugins, {
      arrayMergeStrategy: {
        byKey: "package",
        normalizeKey: (item) =>
          getNormalizedPluginMergeKey(item as Record<string, unknown>),
      },
    });
    const plugins = merged.plugins as Array<{ package?: string }>;
    assert.strictEqual(plugins.length, 1);
    assert.ok(
      plugins[0].package?.includes("older__0.0.1"),
      "user layer must win over NFS defaults for the same logical plugin",
    );
  });

  it("does not duplicate includes when NFS layer omits includes", () => {
    const common: Record<string, unknown> = {
      includes: ["dynamic-plugins.default.yaml"],
      plugins: [],
    };
    const nfsLayer: Record<string, unknown> = {
      plugins: [
        {
          package:
            "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-app-auth:bs_1.49.4__0.0.1",
          disabled: false,
        },
      ],
    };
    const merged = deepMerge(common, nfsLayer, {
      arrayMergeStrategy: {
        byKey: "package",
        normalizeKey: (item) =>
          getNormalizedPluginMergeKey(item as Record<string, unknown>),
      },
    });
    const includes = merged.includes as unknown[];
    assert.strictEqual(includes?.length, 1);
    assert.strictEqual(includes[0], "dynamic-plugins.default.yaml");
  });
});
