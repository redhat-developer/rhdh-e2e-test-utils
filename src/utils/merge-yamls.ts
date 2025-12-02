import fs from "fs-extra";
import yaml from "js-yaml";
import mergeWith from "lodash.mergewith";

/**
 * Deeply merges two YAML-compatible objects.
 * Arrays are replaced (not concatenated) — this mimics Kustomize-style merging.
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  return mergeWith(target, source, (objValue: unknown, srcValue: unknown) => {
    if (Array.isArray(objValue) && Array.isArray(srcValue)) {
      return srcValue; // Replace arrays instead of merging
    }
  });
}

/**
 * Merge multiple YAML files into one object.
 *
 * @param paths List of YAML file paths (base first, overlays last)
 * @returns Merged YAML object
 */
export async function mergeYamlFiles(
  paths: string[],
): Promise<Record<string, unknown>> {
  let merged: Record<string, unknown> = {};

  for (const path of paths) {
    const content = await fs.readFile(path, "utf8");
    const parsed = (yaml.load(content) || {}) as Record<string, unknown>;
    merged = deepMerge(merged, parsed);
  }

  return merged;
}

/**
 * Merge multiple YAML files if they exist.
 *
 * @param paths List of YAML file paths
 * @returns Merged YAML object
 */
export async function mergeYamlFilesIfExists(
  paths: string[],
): Promise<Record<string, unknown>> {
  return await mergeYamlFiles(
    paths.filter((path) => {
      const exists = fs.existsSync(path);
      if (!exists) console.log(`YAML file ${path} does not exist`);
      return exists;
    }),
  );
}

/**
 * Merge multiple YAML files and write the result to an output file.
 *
 * @param inputPaths List of input YAML files
 * @param outputPath Output YAML file path
 * @param options Optional dump formatting
 */
export async function mergeYamlFilesToFile(
  inputPaths: string[],
  outputPath: string,
  options: yaml.DumpOptions = { lineWidth: -1 },
): Promise<void> {
  const merged = await mergeYamlFiles(inputPaths);
  const yamlString = yaml.dump(merged, options);
  await fs.outputFile(outputPath, yamlString);
  console.log(`Merged ${inputPaths.length} YAML files into ${outputPath}`);
}
