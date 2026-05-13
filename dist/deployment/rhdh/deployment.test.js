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
        const authPlugins = {
            plugins: [
                {
                    package: "./dynamic-plugins/dist/backstage-community-plugin-catalog-backend-module-keycloak-dynamic",
                    disabled: false,
                    pluginConfig: {},
                },
            ],
            includes: ["dynamic-plugins.default.yaml"],
        };
        const metadataConfig = {
            plugins: [
                {
                    package: "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-catalog-backend-module-keycloak:pr_1980__3.16.0!backstage-community-plugin-catalog-backend-module-keycloak",
                    disabled: false,
                    pluginConfig: { catalog: { providers: { keycloakOrg: {} } } },
                },
            ],
        };
        const merged = deepMerge(authPlugins, metadataConfig, {
            arrayMergeStrategy: {
                byKey: "package",
                normalizeKey: (item) => getNormalizedPluginMergeKey(item),
            },
        });
        const plugins = merged.plugins;
        assert.strictEqual(plugins.length, 1, "merged config must have exactly one keycloak plugin");
        assert.ok(plugins[0].package?.startsWith("oci://"), "metadata (OCI) must win over auth local path");
    });
});
