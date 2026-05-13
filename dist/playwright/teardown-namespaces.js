import fs from "fs";
import path from "path";
import os from "os";
// Workers use process.ppid (Playwright runner PID)
// Reporter (main process) uses process.pid
// Both resolve to the same directory.
const TEARDOWN_DIR = path.join(os.tmpdir(), `playwright-teardown-${process.ppid || process.pid}`);
const TEARDOWN_FILE = path.join(TEARDOWN_DIR, "namespaces.json");
function read() {
    if (!fs.existsSync(TEARDOWN_FILE))
        return {};
    return JSON.parse(fs.readFileSync(TEARDOWN_FILE, "utf-8"));
}
/**
 * Registers a namespace for teardown after all tests in a project complete.
 * Used by consumers who deploy to custom namespaces (not matching the project name).
 */
export function registerTeardownNamespace(projectName, namespace) {
    fs.mkdirSync(TEARDOWN_DIR, { recursive: true });
    const registry = read();
    const namespaces = registry[projectName] ?? [];
    if (!namespaces.includes(namespace)) {
        namespaces.push(namespace);
        registry[projectName] = namespaces;
        fs.writeFileSync(TEARDOWN_FILE, JSON.stringify(registry));
    }
}
/**
 * Returns all custom namespaces registered for teardown for a project.
 * Used by the teardown reporter.
 */
export function getTeardownNamespaces(projectName) {
    return read()[projectName] ?? [];
}
