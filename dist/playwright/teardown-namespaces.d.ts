/**
 * Registers a namespace for teardown after all tests in a project complete.
 * Used by consumers who deploy to custom namespaces (not matching the project name).
 */
export declare function registerTeardownNamespace(projectName: string, namespace: string): void;
/**
 * Returns all custom namespaces registered for teardown for a project.
 * Used by the teardown reporter.
 */
export declare function getTeardownNamespaces(projectName: string): string[];
//# sourceMappingURL=teardown-namespaces.d.ts.map