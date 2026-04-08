# Unified Test Runner (run-e2e.sh)

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using @red-hat-developer-hub/e2e-test-utils in external projects, see the [Guide](/guide/).
:::

The `run-e2e.sh` script orchestrates E2E test execution across multiple workspaces. It handles workspace discovery, dependency installation, Playwright configuration generation, and parallel test execution.

## Usage

```bash
# Run all workspace tests
./run-e2e.sh

# List discovered projects (dry run)
./run-e2e.sh --list

# Run specific workspaces
./run-e2e.sh -w tech-radar
./run-e2e.sh -w backstage -w quickstart

# Control parallelism
./run-e2e.sh --workers=4

# Run specific project
./run-e2e.sh --project=acr

# Filter tests by name
./run-e2e.sh --grep="Quick"

# Combine flags
./run-e2e.sh -w backstage --workers=2

# List projects in a workspace
./run-e2e.sh -w backstage --list

# Use a local build of e2e-test-utils
E2E_TEST_UTILS_PATH=/path/to/rhdh-e2e-test-utils ./run-e2e.sh -w tech-radar

# Pin a specific npm version of e2e-test-utils
E2E_TEST_UTILS_VERSION=1.1.24 ./run-e2e.sh -w tech-radar
```

## Workspace Selection

Use the `-w` or `--workspace` flag to filter which workspaces to test. Without this flag, all workspaces with E2E tests are included.

A workspace is discovered when it has a `workspaces/<name>/e2e-tests/` directory containing both `package.json` and `playwright.config.ts`.

```bash
# Single workspace
./run-e2e.sh -w tech-radar

# Multiple workspaces
./run-e2e.sh -w tech-radar -w keycloak -w github-actions
```

## Environment Variables

### RHDH Deployment

| Variable | Description | Default |
|----------|-------------|---------|
| `RHDH_VERSION` | RHDH version to deploy (e.g., `1.10`, `next`) | `1.10` |
| `INSTALLATION_METHOD` | Deployment method: `helm` or `operator` | `helm` |
| `SKIP_KEYCLOAK_DEPLOYMENT` | Set `true` to skip Keycloak deployment | - |
| `CATALOG_INDEX_IMAGE` | Override the default catalog index image baked into the RHDH chart | - |

### Test Framework

| Variable | Description | Default |
|----------|-------------|---------|
| `CI` | Enables CI mode (forbidOnly, namespace teardown) | `true` |
| `PLAYWRIGHT_VERSION` | Pin `@playwright/test` version | `1.57.0` |
| `E2E_TEST_UTILS_PATH` | Absolute path to a local `e2e-test-utils` build (for testing unpublished changes) | - |
| `E2E_TEST_UTILS_VERSION` | Pin `@red-hat-developer-hub/e2e-test-utils` npm version | `latest` (nightly), empty otherwise |

### Plugin Resolution

| Variable | Description | Default |
|----------|-------------|---------|
| `E2E_NIGHTLY_MODE` | When `true`, uses released OCI images from metadata; defaults `E2E_TEST_UTILS_VERSION` to `latest` | `false` |
| `GIT_PR_NUMBER` | PR number for OCI URL generation (uses PR-built images) | - |
| `JOB_NAME` | CI job name; if contains `periodic-`, disables metadata injection | - |

## How It Works

The script performs these steps in order:

### 1. Validate Prerequisites

Checks for `node`, `yarn`, `jq`, and verifies cluster login (`oc whoami`). Cluster login is skipped for `--list` mode.

### 2. Discover Workspaces

Scans `workspaces/*/e2e-tests/` for directories containing both `package.json` and `playwright.config.ts`. Applies `-w` filter if provided.

### 3. Generate Root `package.json`

Creates a root `package.json` with:
- **Yarn workspaces** pointing to selected `workspaces/*/e2e-tests` directories
- **Resolutions** to pin `@playwright/test` and optionally `@red-hat-developer-hub/e2e-test-utils`

```json
{
  "workspaces": ["workspaces/tech-radar/e2e-tests", "workspaces/keycloak/e2e-tests"],
  "resolutions": {
    "@playwright/test": "1.57.0",
    "@red-hat-developer-hub/e2e-test-utils": "1.1.24"
  }
}
```

### 4. Install Dependencies

Cleans all `node_modules` and `yarn.lock` to ensure fresh resolution, then runs `yarn install`.

### 5. Generate Root `playwright.config.ts`

Extracts `projects: [...]` blocks from each workspace's `playwright.config.ts` using `sed` text processing. Injects `testDir` into each project pointing to the workspace's `tests/` directory.

::: info Why sed Instead of Import?
Importing workspace configs would execute their top-level code (e.g., `dotenv.config()`, `process.env` mutations), which can pollute the environment for other workspaces. Text extraction avoids this.
:::

The generated config imports `baseConfig` from the test utils package, which provides reporters, timeouts, video/screenshot/trace settings, and global setup.

### 6. Run Tests

Runs `npx playwright test` with any additional arguments passed through. All arguments not recognized as `-w`/`--workspace` are forwarded directly to Playwright.

### 7. Display Summary

Parses `playwright-report/results.json` and displays:
- Duration, passed/failed/flaky/skipped counts
- Overall status (PASSED/FAILED)
- Report file location

## Version Pinning

There are two ways to control which version of `@red-hat-developer-hub/e2e-test-utils` is used:

### Local Build (Development)

Use `E2E_TEST_UTILS_PATH` to point to a local checkout. The script builds it before installing:

```bash
E2E_TEST_UTILS_PATH=/home/user/rhdh-e2e-test-utils ./run-e2e.sh -w tech-radar
```

### Specific npm Version

Use `E2E_TEST_UTILS_VERSION` to pin a published version:

```bash
E2E_TEST_UTILS_VERSION=1.1.24 ./run-e2e.sh -w tech-radar
```

::: info Nightly Default
When `E2E_NIGHTLY_MODE=true`, `E2E_TEST_UTILS_VERSION` defaults to `latest` to pick up the most recent published version. This ensures nightly runs always use the latest test utilities.
:::

### Priority

`E2E_TEST_UTILS_PATH` takes precedence over `E2E_TEST_UTILS_VERSION`. If neither is set, the version declared in each workspace's `package.json` is used (after resolution).

## List Mode

Use `--list` to preview discovered test projects without running them:

```bash
./run-e2e.sh --list
./run-e2e.sh -w backstage --list
```

This generates a lightweight config that skips `globalSetup` and `teardown` reporters, so no cluster connection is needed.

## Playwright Arguments

All arguments not recognized as `-w`/`--workspace` are forwarded directly to Playwright:

```bash
# Control workers
./run-e2e.sh --workers=1

# Run specific project
./run-e2e.sh --project=tech-radar

# Filter by test name
./run-e2e.sh --grep="catalog"

# Combine multiple flags
./run-e2e.sh -w backstage --workers=2 --retries=1 --project=backstage-kubernetes
```

## Generated Files

The script generates these temporary files in the repository root:

| File | Purpose |
|------|---------|
| `package.json` | Root workspace config with resolutions |
| `.yarnrc.yml` | Yarn node-modules linker config |
| `playwright.config.ts` | Combined Playwright config with all workspace projects |
| `playwright.list.config.ts` | Lightweight config for `--list` mode (when used) |

These files are generated fresh on each run.

## Path Resolution

Running tests from the repo root changes the working directory relative to each workspace. The package handles this transparently:

- **WorkspacePaths** resolves all config file paths (app-config, secrets, dynamic-plugins, metadata) from Playwright's `test.info().project.testDir` — an absolute path — instead of `process.cwd()`. This works correctly regardless of where the process was launched.
- **Worker fixture** sets `process.chdir()` to the workspace's `e2e-tests/` directory when the test worker starts, so relative paths in shell scripts and `fs` calls also resolve correctly.

No changes to test code are needed. The same spec files work both with `yarn test` from the workspace and `./run-e2e.sh` from the repo root. See [Path Resolution](/overlay/test-structure/directory-layout#path-resolution-workspacepaths) for details.

## Design Decisions

### Why Single Root Playwright (Not Per-Workspace Parallel)

Two strategies were evaluated for running all workspace tests in CI:

| | Single root Playwright | Per-workspace shell parallel |
|---|---|---|
| **Parallelism** | Worker-level — Playwright auto-balances across all projects | Workspace-level — a large workspace bottlenecks while small ones sit idle |
| **Keycloak** | `globalSetup` runs once, no races | Multiple processes deploy simultaneously, causing races |
| **Reporting** | Single report with traces/screenshots/videos | Blob merge step needed, adds a failure point |
| **Dependency validation** | Yarn resolutions validates upgrades across all workspaces in one run | No way to test a dependency upgrade across all workspaces at once |
| **CLI** | Standard Playwright flags work (`--project`, `--grep`, `--shard`) | Flags must be forwarded per-process |

The single root approach requires [WorkspacePaths](#path-resolution) to resolve config paths correctly, but this change is backward-compatible and benefits all execution modes.

### Why Yarn Workspaces Is Required

Playwright errors out if `@playwright/test` is loaded from more than one file path in a process. With separate `node_modules` per workspace, each workspace resolves the package from a different path. Yarn workspaces hoists all dependencies to a single root `node_modules`, ensuring one copy. This is the primary reason yarn workspaces is used — not just for convenience.

::: info No Impact on Existing Workflows
Nothing is committed to the repo. `package.json`, `playwright.config.ts`, and `.yarnrc.yml` are generated at runtime. Workspace `yarn.lock` files are bypassed (fresh resolution at root), which is fine for nightly — PR checks still use `--immutable` per workspace. Fresh resolution in nightly actually catches dependency regressions early.
:::

## Related Pages

- [Running Tests Locally](/overlay/tutorials/running-locally) - Individual workspace testing
- [CI/CD Pipeline](/overlay/tutorials/ci-pipeline) - How run-e2e.sh is used in OpenShift CI
- [Environment Variables](/overlay/reference/environment-variables) - All supported variables
- [Package.json Scripts](/overlay/reference/scripts) - Workspace-level test scripts
