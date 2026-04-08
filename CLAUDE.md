# CLAUDE.md

This file provides guidance to AI coding tools when working with the `@red-hat-developer-hub/e2e-test-utils` package.

## Package Purpose

A shared npm package (`@red-hat-developer-hub/e2e-test-utils`) that provides everything needed to write and run E2E tests for Red Hat Developer Hub (RHDH) plugins. It handles:

- Deploying RHDH to OpenShift (Helm or Operator)
- Deploying Keycloak for authentication
- Playwright test fixtures, helpers, and page objects
- Dynamic plugin configuration with metadata-based OCI resolution
- Config file merging (common defaults + auth + user overrides)
- Kubernetes API operations
- Per-project namespace teardown in CI

Published to npm under `@red-hat-developer-hub` scope. Primary consumers are overlay workspaces in `rhdh-plugin-export-overlays`.

## Project Structure

```
src/
├── deployment/
│   ├── rhdh/                # RHDHDeployment class — core deployment orchestration
│   │   ├── deployment.ts    # Main class (configure, deploy, waitUntilReady, teardown)
│   │   ├── types.ts         # DeploymentOptions, DeploymentConfig
│   │   ├── constants.ts     # Config paths, auth providers, chart URLs
│   │   └── config/          # YAML templates (common/, auth/, helm/, operator/)
│   ├── keycloak/            # KeycloakHelper — Keycloak Helm deployment + OIDC setup
│   └── orchestrator/        # Workflow orchestrator installer
├── playwright/
│   ├── fixtures/test.ts     # Custom fixtures: rhdh, uiHelper, loginHelper, baseURL
│   ├── base-config.ts       # Base Playwright config (reporters, timeouts, video/trace)
│   ├── global-setup.ts      # Pre-test: check binaries, detect cluster, deploy Keycloak
│   ├── run-once.ts          # Cross-worker one-time execution with file locking
│   ├── teardown-reporter.ts # Per-project namespace cleanup (CI only)
│   ├── teardown-namespaces.ts # Custom namespace registry for teardown
│   ├── helpers/             # LoginHelper, UIhelper, APIHelper, RbacApiHelper, etc.
│   ├── pages/               # Page objects: CatalogPage, HomePage, ExtensionsPage, etc.
│   └── page-objects/        # Shared element selectors/constants
├── utils/
│   ├── plugin-metadata.ts   # Plugin discovery, OCI resolution, PR/nightly modes
│   ├── workspace-paths.ts   # Path resolution from Playwright testDir (not CWD)
│   ├── kubernetes-client.ts # KubernetesClientHelper (K8s API wrapper)
│   ├── merge-yamls.ts       # Deep merge with array strategies (replace, concat, byKey)
│   ├── bash.ts              # zx shell wrapper ($, runQuietUnlessFailure)
│   └── common.ts            # envsubst, requireEnv helpers
└── eslint/
    └── base.config.ts       # createEslintConfig() factory for consumers
```

## Package Exports

| Import Path           | What It Provides                                                               |
| --------------------- | ------------------------------------------------------------------------------ |
| `./test`              | `test`, `expect` — Playwright fixtures with RHDH-specific fixtures             |
| `./playwright-config` | `defineConfig`, `baseConfig` — base Playwright configuration                   |
| `./rhdh`              | `RHDHDeployment` — deployment orchestration class                              |
| `./utils`             | `$`, `KubernetesClientHelper`, `WorkspacePaths`, `envsubst`, `mergeYamlFiles`  |
| `./helpers`           | `UIhelper`, `LoginHelper`, `APIHelper`, `RbacApiHelper`, `AccessibilityHelper` |
| `./pages`             | `CatalogPage`, `HomePage`, `ExtensionsPage`, etc.                              |
| `./keycloak`          | `KeycloakHelper` — Keycloak deployment and OIDC configuration                  |
| `./teardown`          | `registerTeardownNamespace` — custom namespace cleanup registration            |
| `./orchestrator`      | `installOrchestrator` — workflow orchestrator deployment                       |
| `./eslint`            | `createEslintConfig` — ESLint config factory                                   |
| `./tsconfig`          | Base TypeScript configuration (JSON, not code)                                 |

## Build System

```bash
yarn build     # Clean + tsc + copy config YAML files + copy shell scripts to dist/
yarn test      # node --test "dist/**/*.test.js" (must build first)
yarn check     # typecheck + lint + prettier
```

- **TypeScript**: ES2022 target, ESNext modules, strict mode
- **Module system**: ESM (`"type": "module"`)
- **Build output**: `dist/` (JS + .d.ts declarations + config YAMLs)
- **Config files**: Copied as-is from `src/deployment/*/config/` to `dist/` during build
- **Package manager**: Yarn v3.8.7, Node >= 22.18.0

## Key Architectural Concepts

### Configuration Merging (3-level cascade)

```
Package defaults (config/common/)
  ↓ deep merge
Auth-specific (config/auth/{keycloak|guest|github}/)
  ↓ deep merge
User config (workspace's tests/config/*.yaml)
  ↓
= Final merged config
```

Array merge uses "replace" strategy by default. Plugin arrays use `byKey: "package"` with normalized keys (strips trailing `-dynamic`).

### Plugin Metadata Resolution

`RHDHDeployment.deploy()` internally calls `processPluginsForDeployment()` which operates in two modes:

| Mode          | Detection                                                  | Behavior                                                                                      |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **PR check**  | `GIT_PR_NUMBER` is set                                     | Injects metadata configs + resolves to PR-built OCI URLs (`pr_{number}__{version}`)           |
| **Nightly**   | `E2E_NIGHTLY_MODE=true` or `JOB_NAME` contains `periodic-` | Resolves to released OCI refs from `spec.dynamicArtifact` in metadata; skips config injection |
| **Local dev** | Neither set                                                | Uses local paths as-is; injects metadata configs                                              |

Priority: `GIT_PR_NUMBER` (forces PR mode) > `E2E_NIGHTLY_MODE` > `JOB_NAME`

When no `dynamic-plugins.yaml` exists in the workspace, plugins are auto-generated from `metadata/*.yaml` files.

### WorkspacePaths

Static utility that resolves config file paths from `test.info().project.testDir` (Playwright-provided absolute path) instead of `process.cwd()`. This is critical because tests can run from two contexts:

- Workspace level: `cd workspaces/tech-radar/e2e-tests && yarn test`
- Repo root: `./run-e2e.sh -w tech-radar`

The worker fixture also does `process.chdir(e2eRoot)` as a complementary safety net.

### Playwright Fixtures

Worker fixture creates `RHDHDeployment(projectName)` from the Playwright project name (which becomes the K8s namespace) and sets CWD to the workspace e2e-tests directory. Test-scoped fixtures (`uiHelper`, `loginHelper`, `baseURL`) are created fresh per test. See the [consumer code example](#typical-test-structure) for usage.

### runOnce — Cross-Worker Deduplication

`deploy()` uses `runOnce()` internally to execute exactly once per test run, even when Playwright restarts workers after test failures. Uses file-based flags with `proper-lockfile` in `/tmp/playwright-once-{ppid}/`.

### Teardown Reporter

Custom Playwright reporter that deletes namespaces per-project (not per-suite) as tests complete. Only active when `CI=true`. Needed because:

- `afterAll` hooks fire on worker restart (before retries can run)
- Worker fixture teardown has the same problem
- `globalTeardown` has no visibility into which projects ran

### Global Setup

Runs once before all tests:

1. Checks required binaries (`oc`, `kubectl`, `helm`)
2. Auto-detects cluster domain (`K8S_CLUSTER_ROUTER_BASE`)
3. Deploys Keycloak (unless `SKIP_KEYCLOAK_DEPLOYMENT=true`)

### RHDHDeployment.deploy() Flow

1. Merges config files (common + auth + user)
2. Injects plugin metadata into dynamic plugins config (PR/local mode)
3. Applies ConfigMaps (app-config, dynamic-plugins)
4. Applies Secrets (with `envsubst` for environment variable substitution)
5. Installs RHDH via Helm or Operator
6. Waits for readiness: pod `Ready=True` + route HTTP health check
7. Sets `RHDH_BASE_URL` environment variable

Helm upgrades perform `scaleDownAndRestart()` to avoid `MigrationLocked` errors. Fresh installs skip this.

## Key Environment Variables

| Variable                              | Purpose                                          | Default  |
| ------------------------------------- | ------------------------------------------------ | -------- |
| `RHDH_VERSION`                        | RHDH version to deploy                           | `"next"` |
| `INSTALLATION_METHOD`                 | `"helm"` or `"operator"`                         | `"helm"` |
| `GIT_PR_NUMBER`                       | PR number — triggers PR-mode OCI resolution      | -        |
| `E2E_NIGHTLY_MODE`                    | `"true"` or `"1"` — nightly mode                 | -        |
| `JOB_NAME`                            | CI job name; `periodic-` prefix triggers nightly | -        |
| `SKIP_KEYCLOAK_DEPLOYMENT`            | Skip Keycloak in global setup                    | -        |
| `K8S_CLUSTER_ROUTER_BASE`             | Cluster domain (auto-detected)                   | -        |
| `CI`                                  | Enables `forbidOnly`, teardown reporter          | -        |
| `RHDH_SKIP_PLUGIN_METADATA_INJECTION` | Skip metadata config injection in PR mode        | -        |
| `CATALOG_INDEX_IMAGE`                 | Override catalog index image                     | -        |

## Consumer Perspective (Overlay Workspaces)

Changes to this package affect ~67 overlay workspaces. Understanding how they use the package is critical before modifying APIs.

### Typical Test Structure

```typescript
import { test, expect } from "@red-hat-developer-hub/e2e-test-utils/test";
import { $ } from "@red-hat-developer-hub/e2e-test-utils/utils";

test.describe("My Plugin", () => {
  test.beforeAll(async ({ rhdh }) => {
    // 1. Pre-deployment setup (external services, K8s resources)
    await $`bash ${setupScript} ${rhdh.deploymentConfig.namespace}`;
    process.env.SERVICE_URL = await rhdh.k8sClient.getRouteLocation(
      namespace,
      "my-svc",
    );

    // 2. Configure + deploy RHDH
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  test("verify feature", async ({ uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");
    await uiHelper.verifyHeading("Expected Title");
  });
});
```

### Consumer Gotchas

- **Config paths are workspace-relative** — `appConfig: "tests/config/app-config.yaml"` resolves from the workspace's `e2e-tests/` directory via `WorkspacePaths`, not from `process.cwd()`.
- **`$` shell is for setup, not assertions** — used in `beforeAll` for deployment scripts. Use `$({ stdio: "pipe" })` to capture output.
- **`rhdh.configure()` must precede `rhdh.deploy()`** — every workspace follows this order.
- **`defineConfig` only needs `projects`** — base config handles reporters, timeouts, video/trace, global setup. Consumers just specify project names (which become K8s namespaces).

### What Consumers Use vs What's Internal

| Consumer-facing (public API)                    | Internal (used by deploy())     |
| ----------------------------------------------- | ------------------------------- |
| `test`, `expect` fixtures                       | `processPluginsForDeployment()` |
| `rhdh.configure()`, `rhdh.deploy()`             | `isNightlyJob()`                |
| `UIhelper`, `LoginHelper`, `APIHelper`          | `generatePluginsFromMetadata()` |
| `$`, `WorkspacePaths`, `KubernetesClientHelper` | `injectMetadataConfig()`        |
| `defineConfig` from `./playwright-config`       | `resolvePluginPackages()`       |
| `registerTeardownNamespace` from `./teardown`   | `disablePluginWrappers()`       |

## Testing

Tests use Node.js built-in `node:test` module (not Playwright):

```bash
yarn build && yarn test
```

Test files:

- `src/deployment/rhdh/deployment.test.ts` — plugin merge behavior
- `src/utils/merge-yamls.test.ts` — YAML merge strategies
- `src/utils/tests/plugin-metadata.*.test.ts` — metadata resolution (PR, nightly, fixtures)

## Naming Conventions

- **Class**: `UIhelper` (capital U, lowercase h) — matches source code
- **Fixture**: `uiHelper` (camelCase) — used in test fixtures
- **Method names**: Follow source exactly (e.g., `verifyTextinCard` not `verifyTextInCard`)

## Documentation

VitePress docs in `docs/` — standalone package with its own `package.json`. See `docs/CLAUDE.md` for documentation-specific guidance.

```bash
cd docs && yarn install && yarn dev  # http://localhost:5173
```

Deployed to GitHub Pages via `.github/workflows/deploy-docs.yml` on pushes to `main`.

## Common Tasks

### Adding a New Export Path

1. Add the entry to `package.json` `exports` with `types` and `default`
2. Create the source file and its `index.ts` barrel export
3. Document in the VitePress docs (guide + API sections)

### Adding a New Auth Provider

1. Create config files in `src/deployment/rhdh/config/auth/<provider>/`
2. Add the provider to the `AUTH_PROVIDERS` constant in `constants.ts`
3. Update the `auth` type in `types.ts`

### Modifying Config Merging

Config merge order is defined in `deployment.ts` `_buildDeploymentConfig()`. Array merge strategies are in `merge-yamls.ts`. Plugin-specific merging uses `getNormalizedPluginMergeKey()` to deduplicate entries with/without `-dynamic` suffix.

### Updating Plugin Metadata Logic

All in `src/utils/plugin-metadata.ts`. Key functions:

- `isNightlyJob()` — mode detection
- `processPluginsForDeployment()` — unified entry point for PR + nightly
- `generatePluginsFromMetadata()` — auto-generate from metadata files
- `resolvePluginPackages()` — OCI URL resolution
- `injectMetadataConfig()` — merge metadata configs into plugin entries
- `disablePluginWrappers()` — disable local wrappers when using OCI images

Test thoroughly — changes affect all overlay workspaces. Run `yarn build && yarn test` to verify.
