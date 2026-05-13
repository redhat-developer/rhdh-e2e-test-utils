/**
 * Shared test helpers for plugin-metadata tests.
 */
import fs from "fs-extra";
import path from "path";
import os from "os";
import yaml from "js-yaml";
/** Saves and restores process.env around each test. */
export function withCleanEnv() {
    let savedEnv;
    return {
        save() {
            savedEnv = { ...process.env };
        },
        restore() {
            for (const key of Object.keys(process.env)) {
                if (!(key in savedEnv))
                    delete process.env[key];
            }
            Object.assign(process.env, savedEnv);
        },
    };
}
/** Creates a temporary metadata directory with Package CRD YAML files. */
export async function createMetadataFixture(plugins) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "metadata-test-"));
    for (const plugin of plugins) {
        const content = {
            apiVersion: "extensions.backstage.io/v1alpha1",
            kind: "Package",
            metadata: { name: plugin.name },
            spec: {
                packageName: plugin.packageName,
                dynamicArtifact: plugin.dynamicArtifact,
                ...(plugin.appConfigExamples
                    ? {
                        appConfigExamples: [
                            { title: "Default", content: plugin.appConfigExamples },
                        ],
                    }
                    : {}),
            },
        };
        await fs.writeFile(path.join(tmpDir, `${plugin.name}.yaml`), yaml.dump(content));
    }
    return tmpDir;
}
/**
 * Creates a workspace-like directory structure with metadata, source.json,
 * and plugins-list.yaml. Used for tests that trigger PR OCI URL fetching.
 */
export async function createWorkspaceFixture(plugins) {
    const wsDir = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-test-"));
    const metadataDir = path.join(wsDir, "metadata");
    await fs.mkdir(metadataDir);
    /* eslint-disable @typescript-eslint/naming-convention */
    await fs.writeFile(path.join(wsDir, "source.json"), JSON.stringify({
        repo: "https://github.com/test/repo",
        "repo-ref": "main",
        "repo-flat": false,
    }));
    /* eslint-enable @typescript-eslint/naming-convention */
    await fs.writeFile(path.join(wsDir, "plugins-list.yaml"), "{}");
    for (const plugin of plugins) {
        const content = {
            apiVersion: "extensions.backstage.io/v1alpha1",
            kind: "Package",
            metadata: { name: plugin.name },
            spec: {
                packageName: plugin.packageName,
                dynamicArtifact: plugin.dynamicArtifact,
                ...(plugin.appConfigExamples
                    ? {
                        appConfigExamples: [
                            { title: "Default", content: plugin.appConfigExamples },
                        ],
                    }
                    : {}),
            },
        };
        await fs.writeFile(path.join(metadataDir, `${plugin.name}.yaml`), yaml.dump(content));
    }
    return { wsDir, metadataDir };
}
