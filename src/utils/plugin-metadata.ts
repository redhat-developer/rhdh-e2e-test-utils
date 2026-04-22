import fs from "fs-extra";
import path from "path";
import yaml from "js-yaml";
import { glob } from "zx";
import { deepMerge } from "./merge-yamls.js";

const OCI_REGISTRY_PREFIX =
  "oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PluginMetadata {
  packagePath: string;
  pluginConfig: Record<string, unknown>;
  packageName: string;
  sourceFile: string;
}

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

export interface PluginEntry {
  package: string;
  disabled?: boolean;
  pluginConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DynamicPluginsConfig {
  plugins?: PluginEntry[];
  includes?: string[];
  [key: string]: unknown;
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Detects if we're running in a nightly/periodic job context.
 * Controls the entire nightly vs PR routing in deployment:
 * - Nightly: uses metadata OCI refs (latest published versions), skips metadata injection
 * - PR/local: uses metadata + OCI URL replacement
 *
 * Returns true when:
 * - JOB_NAME contains "periodic-" (OpenShift CI nightly/periodic jobs), OR
 * - E2E_NIGHTLY_MODE is set (manual override for local testing)
 */
export function isNightlyJob(): boolean {
  // PR check takes precedence over nightly mode
  if (process.env.GIT_PR_NUMBER) {
    return false;
  }

  if (
    process.env.E2E_NIGHTLY_MODE === "true" ||
    process.env.E2E_NIGHTLY_MODE === "1"
  ) {
    console.log("[PluginMetadata] Nightly mode (E2E_NIGHTLY_MODE is set)");
    return true;
  }

  const jobName = process.env.JOB_NAME || "";
  if (jobName.includes("periodic-")) {
    console.log("[PluginMetadata] Nightly mode (periodic job detected)");
    return true;
  }

  return false;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Extracts the plugin name from a package path or OCI reference.
 * Strips the `-dynamic` suffix so local paths and OCI refs for the same
 * logical plugin produce the same key.
 *
 * Handles various formats:
 * - Local path: ./dynamic-plugins/dist/backstage-community-plugin-tech-radar-dynamic
 * - OCI with alias: oci://quay.io/rhdh/plugin@sha256:...!backstage-community-plugin-tech-radar
 * - OCI without alias: oci://quay.io/rhdh/backstage-community-plugin-tech-radar:tag
 */
export function extractPluginName(packageRef: string): string {
  const ref = packageRef.includes("!") ? packageRef.split("!")[0] : packageRef;
  const match = ref.match(/\/([^/:@]+)(?:[:@].*)?$/);
  return (match?.[1] || packageRef).replace(/-dynamic$/, "");
}

/**
 * Derives the displayName from a packageName.
 *   @backstage-community/plugin-tech-radar → backstage-community-plugin-tech-radar
 */
function toDisplayName(packageName: string): string {
  return packageName.replace(/^@/, "").replace(/\//g, "-");
}

// ── Metadata Loading ──────────────────────────────────────────────────────────

export const DEFAULT_METADATA_PATH = "../metadata";

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

export async function parseMetadataFile(
  filePath: string,
): Promise<PluginMetadata> {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = yaml.load(content) as PackageCRD;

  const packagePath = parsed?.spec?.dynamicArtifact;
  const packageName = parsed?.spec?.packageName;
  const pluginConfig = parsed?.spec?.appConfigExamples?.[0]?.content;

  if (!packagePath) {
    throw new Error(
      `[PluginMetadata] Missing required field spec.dynamicArtifact in ${filePath}`,
    );
  }
  if (!packageName) {
    throw new Error(
      `[PluginMetadata] Missing required field spec.packageName in ${filePath}`,
    );
  }

  return {
    packagePath,
    pluginConfig: pluginConfig || {},
    packageName,
    sourceFile: filePath,
  };
}

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
    const pluginName = extractPluginName(metadata.packagePath);
    metadataMap.set(pluginName, metadata);
    console.log(
      `[PluginMetadata] Mapped plugin: ${pluginName} <- ${metadata.packagePath}`,
    );
  }

  console.log(
    `[PluginMetadata] Successfully parsed ${metadataMap.size} plugin metadata entries`,
  );

  return metadataMap;
}

/**
 * Loads and validates metadata from the workspace metadata directory.
 * @throws Error if metadata directory not found or no valid metadata files
 */
async function loadMetadata(
  metadataPath: string,
): Promise<[string, Map<string, PluginMetadata>]> {
  const metadataDir = getMetadataDirectory(metadataPath);

  if (!metadataDir) {
    throw new Error(
      `[PluginMetadata] Metadata directory not found at: ${path.resolve(metadataPath)}`,
    );
  }

  const metadataMap = await parseAllMetadataFiles(metadataDir);

  if (metadataMap.size === 0) {
    throw new Error(
      `[PluginMetadata] No valid metadata files found in ${metadataDir}`,
    );
  }

  return [metadataDir, metadataMap];
}

/**
 * Tries to load metadata, returns empty map if not available.
 * Used by processPluginsForDeployment where metadata is optional.
 */
async function tryLoadMetadata(
  metadataPath: string,
): Promise<Map<string, PluginMetadata>> {
  const metadataDir = getMetadataDirectory(metadataPath);
  if (!metadataDir) return new Map();
  return await parseAllMetadataFiles(metadataDir);
}

// ── PR: Fetch OCI URLs ───────────────────────────────────────────────────────

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

  const match = repo.match(/github\.com\/(.+?)(?:\.git)?$/);
  if (!match) {
    throw new Error(
      `[PluginMetadata] Failed to parse GitHub repo from source.json: ${repo}`,
    );
  }
  const ownerRepo = match[1];

  const pluginsListContent = await fs.readFile(pluginsListPath, "utf-8");
  const pluginsListData = yaml.load(pluginsListContent) as Record<
    string,
    unknown
  > | null;

  if (!pluginsListData || typeof pluginsListData !== "object") {
    throw new Error(
      `[PluginMetadata] plugins-list.yaml is empty or invalid: ${pluginsListPath}`,
    );
  }

  const pluginPaths = Object.keys(pluginsListData);
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
    const displayName = toDisplayName(name);
    // TODO(RHDHBUGS-2530): Remove !alias suffix once Konflux builds include
    // io.backstage.dynamic-packages annotation.
    const ociUrl = `${OCI_REGISTRY_PREFIX}/${displayName}:pr_${prNumber}__${version}!${displayName}`;

    ociUrls.set(displayName, ociUrl);
    console.log(`[PluginMetadata] ${displayName} -> ${ociUrl}`);
  }

  return ociUrls;
}

// ── Core: Unified Plugin Processing ──────────────────────────────────────────

/**
 * Resolves plugin package references to their target OCI URLs where applicable.
 *
 * Resolution priority for each plugin:
 * 1. PR OCI URL — if GIT_PR_NUMBER set and a PR image was published for this plugin
 * 2. Metadata OCI ref — uses dynamicArtifact from metadata (latest published version)
 * 3. Unchanged — local paths, npm packages, or other formats kept as-is
 */
/**
 * Returns a stable merge key for a plugin entry so OCI and local path for the same
 * logical plugin match when merging dynamic-plugins configs. Strips a trailing
 * "-dynamic" so e.g. backstage-community-plugin-catalog-backend-module-keycloak-dynamic
 * and ...-keycloak (from OCI) map to the same key.
 */
export function getNormalizedPluginMergeKey(entry: {
  package?: string;
}): string {
  const pkg = entry?.package;
  if (pkg === undefined || pkg === "") {
    return "";
  }
  return extractPluginName(pkg);
}

async function resolvePluginPackages(
  plugins: PluginEntry[],
  metadataMap: Map<string, PluginMetadata>,
  metadataPath: string,
): Promise<PluginEntry[]> {
  // Build PR OCI URLs if applicable
  const prNumber = process.env.GIT_PR_NUMBER;
  let prOciUrls: Map<string, string> | null = null;
  if (prNumber) {
    console.log(
      `[PluginMetadata] PR build detected (PR #${prNumber}), fetching OCI URLs...`,
    );
    const workspacePath = path.resolve(metadataPath, "..");
    prOciUrls = await getOCIUrlsForPR(workspacePath, prNumber);
  }

  return plugins.map((plugin) => {
    const pkg = plugin.package;
    const pluginName = extractPluginName(pkg);
    const metadata = metadataMap.get(pluginName);

    // 1. With metadata: resolve to PR OCI URL or metadata's dynamicArtifact
    if (metadata?.packageName) {
      const displayName = toDisplayName(metadata.packageName);

      // PR: use PR-specific OCI URL if this plugin is part of the PR build
      if (prOciUrls) {
        const prUrl = prOciUrls.get(displayName);
        if (prUrl) {
          console.log(`[PluginMetadata] PR: ${pkg} → ${prUrl}`);
          return { ...plugin, package: prUrl };
        }
      }

      // Use metadata's dynamicArtifact directly (latest published version).
      // This is more accurate than {{inherit}} because metadata is updated daily
      // while the DPDY in the catalog index may lag behind.
      if (metadata.packagePath.startsWith("oci://")) {
        console.log(`[PluginMetadata] ${pkg} → ${metadata.packagePath}`);
        return { ...plugin, package: metadata.packagePath };
      }

      return plugin;
    }

    // 2. Local paths (./dynamic-plugins/dist/...) and other formats — keep as-is.
    // Local paths reference plugins bundled in the RHDH container image and work
    // without OCI resolution. When the catalog index moves all plugins to OCI refs,
    // they'll be handled by step 1 or 2 above automatically.
    return plugin;
  });
}

/**
 * Injects plugin configurations from metadata into a dynamic plugins config.
 * Metadata config serves as the base, user-provided pluginConfig overrides it.
 */
function injectMetadataConfig(
  dynamicPluginsConfig: DynamicPluginsConfig,
  metadataMap: Map<string, PluginMetadata>,
): DynamicPluginsConfig {
  if (!dynamicPluginsConfig.plugins) {
    return dynamicPluginsConfig;
  }

  const augmentedPlugins = dynamicPluginsConfig.plugins.map((plugin) => {
    const pluginName = extractPluginName(plugin.package);
    const metadata = metadataMap.get(pluginName);

    if (!metadata) {
      console.log(
        `[PluginMetadata] No metadata found for: ${pluginName} (from ${plugin.package})`,
      );
      return plugin;
    }

    console.log(
      `[PluginMetadata] Injecting config for: ${pluginName} (from ${plugin.package})`,
    );

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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates dynamic-plugins configuration for wrapper plugins
 * that need to be disabled. Each plugin entry contains:
 *  - package: ./dynamic-plugins/dist/$plugin-name
 *  - disabled: true
 *
 * @param plugins list of wrapper plugin names
 * @returns Dynamic plugins configuration that disables listed wrapper plugins
 */
export function disablePluginWrappers(plugins: string[]): DynamicPluginsConfig {
  const pluginConfig: DynamicPluginsConfig = {
    plugins: [],
  };
  for (const plugin of plugins) {
    pluginConfig.plugins!.push({
      package: `./dynamic-plugins/dist/${plugin}`,
      disabled: true,
    });
  }
  return pluginConfig;
}

/**
 * Auto-generates plugin entries from workspace metadata files.
 * Creates raw entries with local paths and disabled: false.
 * Does NOT include pluginConfig — that's handled by processPluginsForDeployment.
 *
 * @param metadataPath Optional custom path to metadata directory
 * @returns Plugin entries discovered from metadata
 */
export async function generatePluginsFromMetadata(
  metadataPath: string = DEFAULT_METADATA_PATH,
): Promise<DynamicPluginsConfig> {
  console.log(
    "[PluginMetadata] Auto-generating plugin entries from metadata...",
  );

  const [, metadataMap] = await loadMetadata(metadataPath);

  const plugins: PluginEntry[] = [];

  for (const [pluginName, metadata] of metadataMap) {
    console.log(
      `[PluginMetadata] Adding plugin: ${pluginName} (${metadata.packagePath})`,
    );
    plugins.push({
      package: metadata.packagePath,
      disabled: false,
    });
  }

  console.log(
    `[PluginMetadata] Generated ${plugins.length} plugin entries from metadata`,
  );

  return { plugins };
}

/**
 * Processes a dynamic plugins configuration for deployment.
 * Single entry point for both PR and nightly flows.
 *
 * Operations (in order):
 * 1. Inject appConfigExamples from metadata (PR mode only, unless RHDH_SKIP_PLUGIN_METADATA_INJECTION is set)
 * 2. Resolve all packages to OCI references:
 *    - PR with GIT_PR_NUMBER: workspace plugins in PR build → pr_ tags, rest unchanged
 *    - PR without GIT_PR_NUMBER: OCI plugins with metadata → metadata refs, rest unchanged
 *    - Nightly: OCI plugins with metadata → metadata refs, rest unchanged
 *
 * @param config The merged dynamic plugins configuration
 * @param metadataPath Optional custom path to metadata directory
 * @returns Processed configuration ready for deployment
 */
export async function processPluginsForDeployment(
  config: DynamicPluginsConfig,
  metadataPath: string = DEFAULT_METADATA_PATH,
): Promise<DynamicPluginsConfig> {
  if (!config.plugins) return config;

  const metadataMap = await tryLoadMetadata(metadataPath);

  let result = { ...config };

  // Inject appConfigExamples from metadata (PR mode only)
  if (
    !isNightlyJob() &&
    process.env.RHDH_SKIP_PLUGIN_METADATA_INJECTION !== "true" &&
    metadataMap.size > 0
  ) {
    console.log("[PluginMetadata] Injecting metadata configs...");
    result = injectMetadataConfig(result, metadataMap);
  }

  // Resolve all packages to OCI references
  console.log("[PluginMetadata] Resolving plugin packages to OCI...");
  result = {
    ...result,
    plugins: await resolvePluginPackages(
      result.plugins!,
      metadataMap,
      metadataPath,
    ),
  };

  return result;
}
