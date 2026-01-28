import fs from "fs-extra";
import path from "path";
import yaml from "js-yaml";
import { glob } from "zx";
import { deepMerge } from "./merge-yamls.js";

const OCI_REGISTRY_PREFIX =
  "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays";

/**
 * Fetches plugin versions from source repo and builds OCI URL map.
 * Only called when GIT_PR_NUMBER is set.
 */
async function getOCIUrlsForPR(
  workspacePath: string,
  prNumber: string,
): Promise<Map<string, string>> {
  const ociUrls = new Map<string, string>();

  const sourceJsonPath = path.join(workspacePath, "source.json");
  const pluginsListPath = path.join(workspacePath, "plugins-list.yaml");

  if (!fs.existsSync(sourceJsonPath)) {
    throw new Error(
      `[PluginMetadata] PR build requires source.json but not found at: ${sourceJsonPath}`,
    );
  }

  if (!fs.existsSync(pluginsListPath)) {
    throw new Error(
      `[PluginMetadata] PR build requires plugins-list.yaml but not found at: ${pluginsListPath}`,
    );
  }

  const sourceJson = JSON.parse(await fs.readFile(sourceJsonPath, "utf-8"));
  const { repo, "repo-ref": ref, "repo-flat": repoFlat } = sourceJson;

  if (!repo) {
    throw new Error(
      `[PluginMetadata] source.json is missing required 'repo' field: ${sourceJsonPath}`,
    );
  }

  if (!ref) {
    throw new Error(
      `[PluginMetadata] source.json is missing required 'repo-ref' field: ${sourceJsonPath}`,
    );
  }

  // Parse owner/repo from URL
  const match = repo.match(/github\.com\/(.+?)(?:\.git)?$/);
  if (!match) {
    throw new Error(
      `[PluginMetadata] Failed to parse GitHub repo from source.json: ${repo}`,
    );
  }
  const ownerRepo = match[1];

  // Read plugins list
  const pluginsList = await fs.readFile(pluginsListPath, "utf-8");
  const pluginPaths = pluginsList
    .trim()
    .split("\n")
    .map((l: string) => l.replace(/:$/, "").trim())
    .filter(Boolean);

  const workspaceName = path.basename(workspacePath);

  console.log(
    `[PluginMetadata] Fetching versions for ${pluginPaths.length} plugins from source...`,
  );

  for (const pluginPath of pluginPaths) {
    const pkgJsonPath = repoFlat
      ? `${pluginPath}/package.json`
      : `workspaces/${workspaceName}/${pluginPath}/package.json`;

    const rawUrl = `https://raw.githubusercontent.com/${ownerRepo}/${ref}/${pkgJsonPath}`;

    const res = await fetch(rawUrl);
    if (!res.ok) {
      throw new Error(
        `[PluginMetadata] Failed to fetch package.json for ${pluginPath}: ${res.status} ${res.statusText}\n` +
          `  URL: ${rawUrl}`,
      );
    }

    const pkgJson = (await res.json()) as { name?: string; version?: string };

    if (!pkgJson.name) {
      throw new Error(
        `[PluginMetadata] package.json is missing 'name' field for ${pluginPath}\n` +
          `  URL: ${rawUrl}`,
      );
    }

    if (!pkgJson.version) {
      throw new Error(
        `[PluginMetadata] package.json is missing 'version' field for ${pluginPath}\n` +
          `  URL: ${rawUrl}`,
      );
    }

    const { name, version } = pkgJson;

    // @backstage-community/plugin-tech-radar -> backstage-community-plugin-tech-radar
    const displayName = name.replace(/^@/, "").replace(/\//g, "-");
    // TODO(RHDHBUGS-2530): Remove !alias suffix once Konflux builds include
    // io.backstage.dynamic-packages annotation. The suffix is a workaround
    // because install-dynamic-plugins.py can't auto-detect plugin path without it.
    const ociUrl = `${OCI_REGISTRY_PREFIX}/${displayName}:pr_${prNumber}__${version}!${displayName}`;

    ociUrls.set(displayName, ociUrl);
    console.log(`[PluginMetadata] ${displayName} -> ${ociUrl}`);
  }

  return ociUrls;
}

/**
 * Represents parsed plugin metadata from a Package CRD file.
 */
export interface PluginMetadata {
  /** The dynamic artifact path (e.g., ./dynamic-plugins/dist/plugin-name) */
  packagePath: string;
  /** The plugin configuration from appConfigExamples[0].content */
  pluginConfig: Record<string, unknown>;
  /** The package name (e.g., @backstage-community/plugin-tech-radar) */
  packageName: string;
  /** Source metadata file path */
  sourceFile: string;
}

/**
 * Structure of a Package CRD metadata file.
 */
interface PackageCRD {
  spec?: {
    packageName?: string;
    dynamicArtifact?: string;
    appConfigExamples?: Array<{
      title?: string;
      content?: Record<string, unknown>;
    }>;
  };
}

/**
 * Checks if plugin metadata handling should be enabled.
 * This controls both auto-generation and injection of plugin metadata.
 *
 * Default: ENABLED (for local dev and PR builds)
 * Disabled when:
 * - RHDH_SKIP_PLUGIN_METADATA_INJECTION is set, OR
 * - JOB_NAME contains "periodic-" (nightly/periodic builds)
 */
export function shouldInjectPluginMetadata(): boolean {
  // Explicit opt-out
  if (process.env.RHDH_SKIP_PLUGIN_METADATA_INJECTION) {
    console.log(
      "[PluginMetadata] Metadata handling disabled (RHDH_SKIP_PLUGIN_METADATA_INJECTION is set)",
    );
    return false;
  }

  // Periodic/nightly job
  const jobName = process.env.JOB_NAME || "";
  if (jobName.includes("periodic-")) {
    console.log(
      "[PluginMetadata] Metadata handling disabled (periodic job detected)",
    );
    return false;
  }

  return true;
}

/**
 * Extracts the plugin name from a package path or OCI reference.
 *
 * Handles various formats:
 * - Local path: ./dynamic-plugins/dist/backstage-community-plugin-tech-radar
 * - OCI with integrity: oci://quay.io/rhdh/plugin@sha256:...!backstage-community-plugin-tech-radar
 * - OCI without integrity: oci://quay.io/rhdh/backstage-community-plugin-tech-radar:tag
 *
 * @param packageRef The package reference string
 * @returns The extracted plugin name
 */
export function extractPluginName(packageRef: string): string {
  // Strip ! suffix if present (e.g., oci://...@sha256:...!alias)
  const ref = packageRef.includes("!") ? packageRef.split("!")[0] : packageRef;

  // Regex to extract plugin name from various formats:
  // Captures the last path segment (chars except / : @) before any :tag or @digest
  const match = ref.match(/\/([^/:@]+)(?:[:@].*)?$/);
  return match?.[1] || packageRef;
}

/**
 * Default metadata directory path relative to the e2e-tests directory.
 * Follows the same pattern as user config paths (e.g., tests/config/dynamic-plugins.yaml).
 */
export const DEFAULT_METADATA_PATH = "../metadata";

/**
 * Gets the metadata directory path.
 * Uses the provided path or falls back to DEFAULT_METADATA_PATH.
 *
 * @param metadataPath Optional custom path to metadata directory
 * @returns The metadata directory path, or null if it doesn't exist
 */
export function getMetadataDirectory(
  metadataPath: string = DEFAULT_METADATA_PATH,
): string | null {
  const resolvedPath = path.resolve(metadataPath);

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    console.log(`[PluginMetadata] Using metadata directory: ${resolvedPath}`);
    return resolvedPath;
  }

  console.log(`[PluginMetadata] Metadata directory not found: ${resolvedPath}`);
  return null;
}

/**
 * Parses a single metadata YAML file and extracts plugin configuration.
 *
 * @param filePath Path to the metadata YAML file
 * @returns PluginMetadata if valid, null otherwise
 */
export async function parseMetadataFile(
  filePath: string,
): Promise<PluginMetadata | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = yaml.load(content) as PackageCRD;

    const packagePath = parsed?.spec?.dynamicArtifact;
    const packageName = parsed?.spec?.packageName;
    const pluginConfig = parsed?.spec?.appConfigExamples?.[0]?.content;

    if (!packagePath) {
      console.log(
        `[PluginMetadata] Skipping ${filePath}: no spec.dynamicArtifact`,
      );
      return null;
    }

    console.log(`[PluginMetadata] Loaded metadata for: ${packagePath}`);

    return {
      packagePath,
      pluginConfig: pluginConfig || {},
      packageName: packageName || "",
      sourceFile: filePath,
    };
  } catch (error) {
    console.error(`[PluginMetadata] Error parsing ${filePath}:`, error);
    return null;
  }
}

/**
 * Parses all metadata files in a directory and builds a map of plugin name to config.
 * The plugin name is extracted from the dynamicArtifact path for flexible matching.
 *
 * @param metadataDir Path to the metadata directory
 * @returns Map of plugin name to plugin configuration
 */
export async function parseAllMetadataFiles(
  metadataDir: string,
): Promise<Map<string, PluginMetadata>> {
  const pattern = path.join(metadataDir, "*.yaml");
  const files = await glob(pattern);

  console.log(
    `[PluginMetadata] Found ${files.length} metadata files in ${metadataDir}`,
  );

  const metadataMap = new Map<string, PluginMetadata>();

  for (const file of files) {
    const metadata = await parseMetadataFile(file);
    if (metadata) {
      // Use extracted plugin name as key for flexible matching
      const pluginName = extractPluginName(metadata.packagePath);
      metadataMap.set(pluginName, metadata);
      console.log(
        `[PluginMetadata] Mapped plugin: ${pluginName} <- ${metadata.packagePath}`,
      );
    }
  }

  console.log(
    `[PluginMetadata] Successfully parsed ${metadataMap.size} plugin metadata entries`,
  );

  return metadataMap;
}

/**
 * Plugin entry in dynamic-plugins.yaml
 */
export interface PluginEntry {
  package: string;
  disabled?: boolean;
  pluginConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Dynamic plugins configuration structure
 */
export interface DynamicPluginsConfig {
  plugins?: PluginEntry[];
  includes?: string[];
  [key: string]: unknown;
}

/**
 * Injects plugin configurations from metadata into a dynamic plugins config.
 * Metadata config serves as the base, user-provided pluginConfig overrides it.
 *
 * Matching is done by extracting the plugin name from both the package reference
 * and the metadata's dynamicArtifact, allowing flexible matching across different
 * package formats (local paths, OCI references, etc.).
 *
 * @param dynamicPluginsConfig The dynamic plugins configuration to augment
 * @param metadataMap Map of plugin names to plugin metadata
 * @returns The augmented configuration with injected pluginConfigs
 */
export function injectMetadataConfig(
  dynamicPluginsConfig: DynamicPluginsConfig,
  metadataMap: Map<string, PluginMetadata>,
): DynamicPluginsConfig {
  if (!dynamicPluginsConfig.plugins) {
    return dynamicPluginsConfig;
  }

  const augmentedPlugins = dynamicPluginsConfig.plugins.map((plugin) => {
    // Extract plugin name from package reference for flexible matching
    const pluginName = extractPluginName(plugin.package);
    const metadata = metadataMap.get(pluginName);

    if (!metadata) {
      // No metadata found for this plugin, keep as-is
      console.log(
        `[PluginMetadata] No metadata found for: ${pluginName} (from ${plugin.package})`,
      );
      return plugin;
    }

    console.log(
      `[PluginMetadata] Injecting config for: ${pluginName} (from ${plugin.package})`,
    );

    // Merge: metadata config (base) + user config (override)
    const mergedPluginConfig = deepMerge(
      metadata.pluginConfig,
      plugin.pluginConfig || {},
    );

    return {
      ...plugin,
      pluginConfig: mergedPluginConfig,
    };
  });

  return {
    ...dynamicPluginsConfig,
    plugins: augmentedPlugins,
  };
}

/**
 * Generates a complete dynamic-plugins configuration from metadata files.
 * Iterates through all metadata files and creates plugin entries with:
 * - package: the dynamicArtifact path
 * - disabled: false (enabled by default)
 * - pluginConfig: from appConfigExamples[0].content
 *
 * @param metadataPath Optional custom path to metadata directory (default: ../metadata)
 * @returns Complete dynamic plugins configuration
 * @throws Error if metadata directory not found or no valid metadata files
 */
export async function generateDynamicPluginsConfigFromMetadata(
  metadataPath: string = DEFAULT_METADATA_PATH,
): Promise<DynamicPluginsConfig> {
  // Skip if metadata handling is disabled
  if (!shouldInjectPluginMetadata()) {
    console.log(
      "[PluginMetadata] Returning empty config (metadata handling disabled)",
    );
    return { plugins: [] };
  }

  console.log(
    "[PluginMetadata] No dynamic-plugins config provided, generating from metadata...",
  );

  // Get metadata directory
  const metadataDir = getMetadataDirectory(metadataPath);

  if (!metadataDir) {
    throw new Error(
      `[PluginMetadata] Cannot generate dynamic-plugins config: metadata directory not found at: ${path.resolve(metadataPath)}`,
    );
  }

  // Parse all metadata files
  const metadataMap = await parseAllMetadataFiles(metadataDir);

  if (metadataMap.size === 0) {
    throw new Error(
      `[PluginMetadata] Cannot generate dynamic-plugins config: no valid metadata files found in ${metadataDir}`,
    );
  }

  // If PR number is set, fetch OCI URLs
  const prNumber = process.env.GIT_PR_NUMBER;
  let ociUrls: Map<string, string> | null = null;
  if (prNumber) {
    console.log(
      `[PluginMetadata] PR build detected (PR #${prNumber}), fetching OCI URLs...`,
    );
    const workspacePath = path.resolve(metadataPath, "..");
    ociUrls = await getOCIUrlsForPR(workspacePath, prNumber);
  }

  // Build plugin entries from metadata
  const plugins: PluginEntry[] = [];

  for (const [pluginName, metadata] of metadataMap) {
    let packageRef = metadata.packagePath;

    // Replace with OCI URL if available (required for PR builds)
    if (ociUrls) {
      if (!metadata.packageName) {
        throw new Error(
          `[PluginMetadata] PR build requires packageName in metadata but not found for: ${pluginName}\n` +
            `  Source file: ${metadata.sourceFile}`,
        );
      }

      const displayName = metadata.packageName
        .replace(/^@/, "")
        .replace(/\//g, "-");
      const ociUrl = ociUrls.get(displayName);

      if (!ociUrl) {
        throw new Error(
          `[PluginMetadata] PR build requires OCI URL but not found for: ${displayName}\n` +
            `  Package name: ${metadata.packageName}\n` +
            `  Source file: ${metadata.sourceFile}`,
        );
      }

      console.log(`[PluginMetadata] Replacing ${packageRef} with ${ociUrl}`);
      packageRef = ociUrl;
    }

    console.log(
      `[PluginMetadata] Adding plugin: ${pluginName} (${packageRef})`,
    );

    plugins.push({
      package: packageRef,
      disabled: false,
      pluginConfig: metadata.pluginConfig,
    });
  }

  console.log(
    `[PluginMetadata] Generated dynamic-plugins config with ${plugins.length} plugins`,
  );

  return { plugins };
}

/**
 * Main function to load and inject plugin metadata for PR builds.
 * For non-PR builds (nightly), returns the config unchanged.
 *
 * @param dynamicPluginsConfig The dynamic plugins configuration
 * @param metadataPath Optional custom path to metadata directory (default: ../metadata)
 * @returns Augmented configuration with metadata (for PR) or unchanged (for nightly)
 * @throws Error if PR build but no metadata directory found
 */
export async function loadAndInjectPluginMetadata(
  dynamicPluginsConfig: DynamicPluginsConfig,
  metadataPath: string = DEFAULT_METADATA_PATH,
): Promise<DynamicPluginsConfig> {
  // Skip metadata injection if disabled
  if (!shouldInjectPluginMetadata()) {
    return dynamicPluginsConfig;
  }

  console.log("[PluginMetadata] Loading plugin metadata...");

  // Get metadata directory
  const metadataDir = getMetadataDirectory(metadataPath);

  if (!metadataDir) {
    throw new Error(
      `[PluginMetadata] PR build requires metadata directory but not found at: ${path.resolve(metadataPath)}`,
    );
  }

  // Parse all metadata files
  const metadataMap = await parseAllMetadataFiles(metadataDir);

  if (metadataMap.size === 0) {
    throw new Error(
      `[PluginMetadata] PR build requires plugin metadata but no valid metadata files found in ${metadataDir}`,
    );
  }

  // Inject metadata configs into the dynamic plugins config
  return injectMetadataConfig(dynamicPluginsConfig, metadataMap);
}
