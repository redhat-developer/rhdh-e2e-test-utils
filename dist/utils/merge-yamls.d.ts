import yaml from "js-yaml";
/**
 * Merge multiple YAML files into one object.
 *
 * @param paths List of YAML file paths (base first, overlays last)
 * @returns Merged YAML object
 */
export declare function mergeYamlFiles(paths: string[]): Promise<Record<string, unknown>>;
/**
 * Merge multiple YAML files if they exist.
 *
 * @param paths List of YAML file paths
 * @returns Merged YAML object
 */
export declare function mergeYamlFilesIfExists(paths: string[]): Promise<Record<string, unknown>>;
/**
 * Merge multiple YAML files and write the result to an output file.
 *
 * @param inputPaths List of input YAML files
 * @param outputPath Output YAML file path
 * @param options Optional dump formatting
 */
export declare function mergeYamlFilesToFile(inputPaths: string[], outputPath: string, options?: yaml.DumpOptions): Promise<void>;
//# sourceMappingURL=merge-yamls.d.ts.map