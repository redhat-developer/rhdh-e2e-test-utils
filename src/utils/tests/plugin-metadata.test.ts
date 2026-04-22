/**
 * Pure utility function tests — no env vars, no file system fixtures.
 * Tests: extractPluginName, getNormalizedPluginMergeKey, disablePluginWrappers, generatePluginsFromMetadata
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import {
  extractPluginName,
  getNormalizedPluginMergeKey,
  disablePluginWrappers,
  generatePluginsFromMetadata,
} from "../plugin-metadata.js";
import { createMetadataFixture } from "./helpers.js";

// ── extractPluginName ────────────────────────────────────────────────────────

describe("extractPluginName", () => {
  it("extracts name from OCI URL with tag and alias", () => {
    assert.strictEqual(
      extractPluginName(
        "oci://ghcr.io/org/repo/backstage-community-plugin-keycloak:pr_1__1.0!alias",
      ),
      "backstage-community-plugin-keycloak",
    );
  });

  it("extracts name from OCI URL with digest and alias", () => {
    assert.strictEqual(
      extractPluginName(
        "oci://quay.io/rhdh/backstage-plugin-events-backend-module-github@sha256:abc123!backstage-plugin-events-backend-module-github",
      ),
      "backstage-plugin-events-backend-module-github",
    );
  });

  it("extracts name from OCI URL with tag only (no alias)", () => {
    assert.strictEqual(
      extractPluginName(
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:bs_1.45.3__3.33.3",
      ),
      "backstage-community-plugin-tekton",
    );
  });

  it("extracts name from local path and strips -dynamic suffix", () => {
    assert.strictEqual(
      extractPluginName(
        "./dynamic-plugins/dist/backstage-community-plugin-keycloak-dynamic",
      ),
      "backstage-community-plugin-keycloak",
    );
  });

  it("extracts name from OCI URL with digest but no alias", () => {
    assert.strictEqual(
      extractPluginName(
        "oci://quay.io/rhdh/backstage-plugin-events-backend-module-github@sha256:c1d17d47aaa",
      ),
      "backstage-plugin-events-backend-module-github",
    );
  });

  it("uses alias when alias differs from image name (redhat-resource-optimization pattern)", () => {
    assert.strictEqual(
      extractPluginName(
        "oci://quay.io/redhat-resource-optimization/dynamic-plugins:1.3.2!red-hat-developer-hub-plugin-redhat-resource-optimization",
      ),
      "dynamic-plugins",
      "when alias is present, extractPluginName strips alias first and extracts from OCI path",
    );
  });

  it("extracts name from npm package reference", () => {
    assert.strictEqual(
      extractPluginName(
        "@red-hat-developer-hub/backstage-plugin-global-header-test@0.0.2",
      ),
      "backstage-plugin-global-header-test",
      "must extract plugin name from npm @scope/name@version format",
    );
  });
});

// ── getNormalizedPluginMergeKey ───────────────────────────────────────────────

describe("getNormalizedPluginMergeKey", () => {
  it("returns same key for OCI and local -dynamic variant of the same plugin", () => {
    const oci = getNormalizedPluginMergeKey({
      package:
        "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-catalog-backend-module-keycloak:pr_1980__3.16.0!backstage-community-plugin-catalog-backend-module-keycloak",
    });
    const local = getNormalizedPluginMergeKey({
      package:
        "./dynamic-plugins/dist/backstage-community-plugin-catalog-backend-module-keycloak-dynamic",
    });
    assert.strictEqual(oci, local, "same logical plugin has same merge key");
    assert.strictEqual(
      oci,
      "backstage-community-plugin-catalog-backend-module-keycloak",
    );
  });

  it("returns different keys for different plugins", () => {
    const keycloak = getNormalizedPluginMergeKey({
      package:
        "./dynamic-plugins/dist/backstage-community-plugin-catalog-backend-module-keycloak-dynamic",
    });
    const techRadar = getNormalizedPluginMergeKey({
      package:
        "./dynamic-plugins/dist/backstage-community-plugin-tech-radar-dynamic",
    });
    assert.notStrictEqual(keycloak, techRadar);
  });

  it("returns empty string for missing or empty package", () => {
    assert.strictEqual(getNormalizedPluginMergeKey({}), "");
    assert.strictEqual(getNormalizedPluginMergeKey({ package: "" }), "");
    assert.strictEqual(getNormalizedPluginMergeKey({ package: undefined }), "");
  });
});

// ── disablePluginWrappers ────────────────────────────────────────────────────

describe("disablePluginWrappers", () => {
  it("returns empty plugins array for empty input", () => {
    const result = disablePluginWrappers([]);
    assert.deepStrictEqual(result, { plugins: [] });
  });

  it("creates disabled entries with correct local path format", () => {
    const result = disablePluginWrappers([
      "backstage-community-plugin-tech-radar",
      "backstage-plugin-kubernetes",
    ]);
    assert.strictEqual(result.plugins!.length, 2);
    assert.deepStrictEqual(result.plugins![0], {
      package: "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
      disabled: true,
    });
    assert.deepStrictEqual(result.plugins![1], {
      package: "./dynamic-plugins/dist/backstage-plugin-kubernetes",
      disabled: true,
    });
  });
});

// ── generatePluginsFromMetadata ──────────────────────────────────────────────

describe("generatePluginsFromMetadata", () => {
  it("generates entries from metadata with package set to dynamicArtifact", async () => {
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
      const result = await generatePluginsFromMetadata(metadataDir);
      assert.strictEqual(result.plugins!.length, 1);
      assert.strictEqual(
        result.plugins![0].package,
        "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
        "package must be the dynamicArtifact from metadata",
      );
      assert.strictEqual(result.plugins![0].disabled, false);
      assert.strictEqual(
        result.plugins![0].pluginConfig,
        undefined,
        "generatePluginsFromMetadata must NOT include pluginConfig",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("generates entries for OCI-referenced plugins", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:bs_1.45.3__3.33.3!backstage-community-plugin-tekton",
      },
    ]);

    try {
      const result = await generatePluginsFromMetadata(metadataDir);
      assert.strictEqual(result.plugins!.length, 1);
      assert.ok(
        result.plugins![0].package.startsWith("oci://"),
        "OCI artifact must be preserved as package",
      );
    } finally {
      await fs.remove(metadataDir);
    }
  });

  it("generates entries for mixed local and OCI artifacts", async () => {
    const metadataDir = await createMetadataFixture([
      {
        name: "backstage-community-plugin-tech-radar",
        packageName: "@backstage-community/plugin-tech-radar",
        dynamicArtifact:
          "./dynamic-plugins/dist/backstage-community-plugin-tech-radar",
      },
      {
        name: "backstage-community-plugin-tekton",
        packageName: "@backstage-community/plugin-tekton",
        dynamicArtifact:
          "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tekton:bs_1.45.3__3.33.3!backstage-community-plugin-tekton",
      },
      {
        name: "backstage-plugin-events-backend-module-github",
        packageName: "@backstage/plugin-events-backend-module-github",
        dynamicArtifact:
          "oci://quay.io/rhdh/backstage-plugin-events-backend-module-github@sha256:abc123",
      },
    ]);

    try {
      const result = await generatePluginsFromMetadata(metadataDir);

      assert.strictEqual(result.plugins!.length, 3, "must generate 3 entries");

      const packages = result.plugins!.map((p) => p.package).sort();
      assert.ok(
        packages.some((p) => p.startsWith("./")),
        "must include local path artifact",
      );
      assert.ok(
        packages.some((p) => p.startsWith("oci://ghcr.io/")),
        "must include ghcr.io OCI",
      );
      assert.ok(
        packages.some((p) => p.startsWith("oci://quay.io/")),
        "must include quay.io OCI",
      );

      for (const plugin of result.plugins!) {
        assert.strictEqual(plugin.disabled, false);
        assert.strictEqual(plugin.pluginConfig, undefined);
      }
    } finally {
      await fs.remove(metadataDir);
    }
  });
});
