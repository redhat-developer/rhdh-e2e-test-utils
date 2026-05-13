import yaml from "js-yaml";
/**
 * Array merge strategy options for YAML merging.
 */
export type ArrayMergeStrategy = "replace" | "concat" | {
    byKey: string;
    /** Optional: normalize key for matching so different values (e.g. OCI vs local path) map to the same entry. Source wins when merging. */
    normalizeKey?: (item: unknown) => string;
};
/**
 * Options for YAML merging.
 */
export interface MergeOptions {
    /**
     * Strategy for merging arrays.
     * - "replace": Replace arrays entirely (default)
     * - "concat": Concatenate arrays
     * - { byKey: "keyName" }: Merge arrays of objects by a specific key
     * - { byKey: "keyName", normalizeKey }: Same, but match by normalized key (e.g. for plugin deduplication)
     */
    arrayMergeStrategy?: ArrayMergeStrategy;
}
/**
 * Deeply merges two YAML-compatible objects.
 * Array handling is controlled by the arrayMergeStrategy option.
 */
export declare function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>, options?: MergeOptions): Record<string, unknown>;
/**
 * Merge multiple YAML files into one object.
 *
 * @param paths List of YAML file paths (base first, overlays last)
 * @param options Optional merge options (e.g., arrayMergeStrategy)
 * @returns Merged YAML object
 */
export declare function mergeYamlFiles(paths: string[], options?: MergeOptions): Promise<Record<string, unknown>>;
/**
 * Merge multiple YAML files if they exist.
 *
 * @param paths List of YAML file paths
 * @param options Optional merge options (e.g., arrayMergeStrategy)
 * @returns Merged YAML object
 */
export declare function mergeYamlFilesIfExists(paths: string[], options?: MergeOptions): Promise<Record<string, unknown>>;
/**
 * Merge multiple YAML files and write the result to an output file.
 *
 * @param inputPaths List of input YAML files
 * @param outputPath Output YAML file path
 * @param dumpOptions Optional dump formatting
 * @param mergeOptions Optional merge options (e.g., arrayMergeStrategy)
 */
export declare function mergeYamlFilesToFile(inputPaths: string[], outputPath: string, dumpOptions?: yaml.DumpOptions, mergeOptions?: MergeOptions): Promise<void>;
//# sourceMappingURL=merge-yamls.d.ts.map