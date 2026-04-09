# Changelog

All notable changes to this project will be documented in this file.

## [1.1.29] - Current

### Changed

- **Pin all dependency versions**: Removed `^` range prefixes from all `dependencies` and `devDependencies` to use exact versions, preventing unexpected breaking changes from transitive updates. `peerDependencies` retain ranges for consumer flexibility.
- **Update all dependencies to latest versions**: Bumped all packages to their latest versions except `@keycloak/keycloak-admin-client` (pinned at 26.5.6 due to broken postinstall in newer versions). Notable major bumps: `eslint` 9→10, `@eslint/js` 9→10, `typescript` 5→6, `otplib` 12→13, `lint-staged` 15→16.
- **Update Yarn to 4.12.0**: Bumped `packageManager` from `yarn@3.8.7` to `yarn@4.12.0`.

### Fixed

- **Migrate `otplib` v12→v13**: Replaced removed `authenticator.generate(secret)` API with `generateSync({ secret })` in `LoginHelper`.
- **Preserve error cause in re-thrown errors**: Added `{ cause: error }` to wrapped errors in `RHDHDeployment` and `KubernetesClientHelper` for better error chain traceability.
- **Use optional chaining in `APIHelper.deleteUserEntityFromAPI`**: Replaced verbose null check with optional chain (`r.metadata?.uid`).

## [1.1.28]

- **APIHelper.createGitHubRepoWithFile**: Ensure file creation happens after repository creation.

### Added

- **`GITHUB_API_ENDPOINTS.getOrg(owner)`**: Get GitHub organization
- **`GITHUB_API_ENDPOINTS.getRepo(owner, repo)`**: Get GitHub repository

## [1.1.27]

### Fixed

- **Pin `@keycloak/keycloak-admin-client` to 26.5.6**: Version 26.6.0 has a broken postinstall script that fails in CI environments with a `packageManager` field. Pinned to last known-good version.

## [1.1.26]

### Fixed

- **OSL operator switched to stable/logic-operator**: Switched from `alpha`/`logic-operator-rhel8` (legacy pre-1.37 package) to `stable`/`logic-operator` (GA package), matching the OS operator channel and avoiding version skew that caused Knative API incompatibilities.

## [1.1.25]

### Added

- **`UIhelper.dismissQuickstartIfVisible()`**: Optionally closes the RHDH quickstart drawer when its **Hide** control is visible, so e2e tests are not blocked by the overlay. Optional `waitHiddenMs` (default `5000`) controls how long to wait for the button to become hidden after click.

## [1.1.24]

### Added

- **Nightly E2E support with metadata-based OCI resolution**: `processPluginsForDeployment` resolves plugin packages to OCI refs using workspace metadata (`spec.dynamicArtifact`). Supports both nightly (metadata refs) and PR (`pr_` tags) flows automatically.
- **`generatePluginsFromMetadata`**: Auto-generates plugin entries from workspace metadata files when no user-provided `dynamic-plugins.yaml` exists.
- **`WorkspacePaths`**: New utility that resolves workspace config file paths relative to `e2e-tests/` directory.
- **Per-project namespace teardown**: `TeardownReporter` now deletes namespaces as soon as all tests in a project finish, freeing cluster resources early instead of waiting for the entire suite.

### Fixed

- **Route readiness race condition**: Added HTTP health check against the RHDH route after pod readiness, closing the gap between pod `Ready=True` and the OpenShift Router serving traffic.
- **Skip restart on fresh helm install**: `scaleDownAndRestart` is now only called on upgrades (existing deployment detected), avoiding unnecessary scale-down/up cycles on first install.
- **Boolean env var handling**: `CI`, `E2E_NIGHTLY_MODE`, and `RHDH_SKIP_PLUGIN_METADATA_INJECTION` now use strict comparison (`=== "true"`) instead of truthy checks, so `"false"` is no longer treated as `true`.
- **PR takes precedence over nightly mode**: `isNightlyJob()` returns `false` when `GIT_PR_NUMBER` is set, preventing broken combinations of PR images with nightly config.

## [1.1.23]

### Fixed

- Fixed popup flow for Keycloak sign in. Before, if the popup opened fast, the "popup" event could fire before the listener was attached resulting in test hanging and timeouts.

## [1.1.22]

### Added

- **disableWrappers option for rhdh.configure**: Allows listing plugins whose wrappers will be disabled in the dynamic plugins config to allow the use of PR images when a wrapper is enabled by default for the same plugin. This option is ignored if the `GIT_PR_NUMBER` environment variable is not set.

## [1.1.21]

### Fixed

- Updated occurrences of `BASE_URL` to `RHDH_BASE_URL`

## [1.1.20]

### Added

- **`OrchestratorPage`**: New page object for orchestrator e2e tests. Provides methods for selecting, running, and re-running Greeting and FailSwitch workflows, validating workflow table columns and row data, inspecting run details and status (Running / Completed / Failed), verifying all-runs filters and status icons, aborting running workflows, and checking entity-workflow integration (Workflows tab and linked workflow names). Exported from `@red-hat-developer-hub/e2e-test-utils/pages`.
- **`workflowsTable` locator helper**: Reusable Playwright locator for the workflows table, shared by `OrchestratorPage`.
- **`RbacApiHelper` — role & policy CRUD methods**: `createRoles(role)`, `getRoles()`, `updateRole(role, oldRole, newRole)`, and `createPolicies(policy)` join the existing delete helpers, giving full CRUD coverage for roles and policies.
- **`Role` interface**: Exported alongside `Policy` from `@red-hat-developer-hub/e2e-test-utils/helpers`.

## [1.1.19]

### Added

- **installOrchestrator(namespace?: string)**: Runs the orchestrator install script via a TypeScript wrapper; creates or reuses the given namespace (default `"orchestrator"`). Exported from `@red-hat-developer-hub/e2e-test-utils/orchestrator`.

## [1.1.18]

### Added

- **KeycloakHelper.createUsersAndGroups(realm: string, options?: { users?: KeycloakUserConfig[]; groups?: KeycloakGroupConfig[];})**: Create users and groups in a realm.
- **KeycloakHelper.deleteUsersAndGroups(realm: string, options?: { users?: Array<KeycloakUserConfig | string>; groups?: Array<KeycloakGroupConfig | string>;})**: Delete users and groups in a realm by their usernames / names or by their KeycloakConfigs. Intended for user and group cleanup in bulk.

### Fixed

- **KeycloakHelper.deleteUser** and **KeycloakHelper.deleteGroup**: Default Keycloak users/groups (see `DEFAULT_USERS` / `DEFAULT_GROUPS`) can no longer be deleted; attempting to delete them throws an error.

## [1.1.17]

### Added

- **KeycloakHelper.getGroupsOfUser(realm, username)**: Returns groups for a user in a realm; the user is resolved by `username` (id is resolved internally). Intended for e2e assertions that compare Backstage UI to Keycloak data (e.g. catalog users page).

## [1.1.16]

### Fixed

- **Duplicate plugin when no user `dynamic-plugins.yaml` (Keycloak auth, PR build)**: When the workspace had no `dynamic-plugins.yaml`, auto-generated config (with OCI URL) was merged with auth config (with local path). Because merge used exact `package` string match, the same plugin appeared twice and the backend failed with `ExtensionPoint with ID 'keycloak.transformer' is already registered`. The merge now uses a normalized plugin key so OCI and local path for the same logical plugin are deduplicated; the metadata-derived entry (e.g. OCI URL) wins.

## [1.1.15]

### Added

- **`RbacApiHelper`**: New HTTP client for the RHDH RBAC permission API (`/api/permission/`). Uses a static `build(token)` factory to asynchronously initialise a Playwright `APIRequestContext`. Provides `getPoliciesByRole()`, `getConditions()`, `getConditionsByRole()`, `deleteRole()`, `deletePolicy()`, and `deleteCondition()` for managing roles, policies, and conditional permission policies — primarily intended for `afterAll` cleanup. Exported from `@red-hat-developer-hub/e2e-test-utils/helpers`.
- **`AuthApiHelper`**: New helper for retrieving Backstage identity tokens from a running RHDH instance via the auth refresh endpoint (`/api/auth/{provider}/refresh`). Accepts an existing Playwright `Page` and exposes a single `getToken(provider?, environment?)` method. Defaults to the `oidc` provider and `production` environment. Typically used in `beforeAll` to obtain a token for `RbacApiHelper.build()`. Exported from `@red-hat-developer-hub/e2e-test-utils/helpers`.
- **`Response`** utility class (exported alongside `RbacApiHelper`): provides `Response.removeMetadataFromResponse(apiResponse)` to strip server-added `metadata` fields from policy arrays before passing them to delete endpoints.

## [1.1.14]

### Added

- **`deploy()` built-in protection**: `rhdh.deploy()` now automatically skips if the deployment already succeeded in the current test run. No code changes needed — existing `beforeAll` patterns work as before, but deployments are no longer repeated when Playwright restarts workers after test failures.
- **`test.runOnce(key, fn)`**: Execute any function exactly once per test run, even across worker restarts. Use for expensive pre-deploy operations (external services, setup scripts, data seeding) that `deploy()` alone doesn't cover. Safe to nest with `deploy()`'s built-in protection.
- **Teardown reporter**: Built-in Playwright reporter that automatically deletes Kubernetes namespaces after all tests complete. Active only in CI (`process.env.CI`).
- **`registerTeardownNamespace(projectName, namespace)`**: Register custom namespaces for automatic cleanup. Import from `@red-hat-developer-hub/e2e-test-utils/teardown`.

### Changed

- Namespace cleanup moved from worker fixture to teardown reporter to prevent premature deletion on test failures.

## [1.1.13]

### Added

- Support for GitHub authentication provider

### Changed

- `LoginHelper.loginAsGithubUser` now pulls default user credentials from the following vault keys: `VAULT_GH_USER_ID`, `VAULT_GH_USER_PASS`, `VAULT_GH_2FA_SECRET`
- `APIHelper.githubRequest` pulls default user token from vault key `VAULT_GITHUB_USER_TOKEN`

### Environment Variables

- `VAULT_GITHUB_OAUTH_OVERLAYS_APP_ID` - ID for GitHub OAuth application used as auth provider
- `VAULT_GITHUB_OAUTH_OVERLAYS_APP_SECRET`- Client secret for GitHub OAuth application
- `VAULT_GH_USER_ID` - GitHub user name
- `VAULT_GH_USER_PASS` - GitHub user password
- `VAULT_GH_2FA_SECRET` - GitHub user secret for 2 factor authentication
- `VAULT_GITHUB_USER_TOKEN` - Github user token

## [1.1.12]

### Changed

- **`deploy()` timeout is now configurable**: `deploy()` accepts an optional `{ timeout }` parameter to control the Playwright test timeout during deployment. Defaults to `600_000` (600s). Pass a custom number to override, `0` for no timeout (infinite), or `null` to skip setting the timeout entirely and let the consumer control it.

## [1.1.11]

### Added

- **`runQuietUnlessFailure()`**: New utility that captures command output silently on success and displays full output on failure for better debugging. Used in Keycloak deployment for `helm repo update` and `helm upgrade --install`.

## [1.1.10]

### Fixed

- **`plugins-list.yaml` parsing**: Parse as proper YAML instead of text splitting, correctly handling entries with build flags (e.g., `--embed-package`, `--suppress-native-package`) and YAML comments.

### Changed

- **Video recording**: Changed mode from `"on"` to `"retain-on-failure"` and reduced size from `1920x1080` to `1280x720` to save disk space.
- **Workers and retries**: Now configurable via `PLAYWRIGHT_WORKERS` (default: `"50%"`) and `PLAYWRIGHT_RETRIES` (default: `0`) environment variables.

## [1.1.9]

### Fixed

- **OCI URL replacement with user-provided `dynamic-plugins.yaml`**: When a workspace provides its own `dynamic-plugins.yaml`, plugin package paths were not replaced with OCI URLs for PR builds. Extracted shared `replaceWithOCIUrls()` function so both `generateDynamicPluginsConfigFromMetadata()` and `loadAndInjectPluginMetadata()` code paths now perform OCI replacement when `GIT_PR_NUMBER` is set.

## [1.1.8]

### Fixed

- Fixed namespace deletion race condition during test retries
- Improved 404 error detection for different Kubernetes client versions

### Changed

- Increased default timeouts (300s → 500s) and test timeout (600s)
- Reduced CI retries from 2 to 1
- Added pod diagnostics logging on timeout and periodic status updates

## [1.1.7]

### Fixed

- **Secrets with control characters**: Fixed `SyntaxError: Bad control character in string literal` when secrets contain newlines or special characters (e.g., GitHub App private keys)

### Dependencies

- Added `lodash.clonedeepwith@^4.5.0` for safe environment variable substitution

## [1.1.6]

### Added

- **"next" tag support**: Both Helm and Operator deployments now support `RHDH_VERSION=next`
  - Helm: Resolves "next" to semantic version by querying `rhdh-hub-rhel9` image tags
  - Operator: Uses `main` branch and `--next` flag instead of release branch

### Changed

- **Default values**: `RHDH_VERSION` defaults to `next` and `INSTALLATION_METHOD` defaults to `helm` when not set

### Environment Variables

- `RHDH_VERSION`: RHDH version to deploy (default: `next`)
- `INSTALLATION_METHOD`: Deployment method - `helm` or `operator` (default: `helm`)

## [1.1.5]

### Added

- **Plugin metadata auto-generation**: When `dynamic-plugins.yaml` doesn't exist, configuration is automatically generated from `metadata/*.yaml` files
- **OCI URL generation for PR builds**: When `GIT_PR_NUMBER` is set, local plugin paths are replaced with OCI URLs (e.g., `oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/my-plugin:pr_1234__1.0.0`)
- Plugin metadata injection into existing `dynamic-plugins.yaml` configurations
- New utilities: `extractPluginName()`, `generatePluginsFromMetadata()`, `processPluginsForDeployment()`, `isNightlyJob()`
- **Early pod failure detection**: `waitForPodsWithFailureDetection()` in KubernetesClientHelper detects CrashLoopBackOff, ImagePullBackOff, init container failures, etc. within seconds instead of waiting for full timeout

### Changed

- Plugin versions for OCI URLs are fetched from source repo's `package.json` using `source.json` commit ref
- Metadata handling disabled for periodic builds (when `JOB_NAME` contains `periodic-`)
- Strict error handling for PR builds (fails if source files missing or fetch fails)
- Improved boxen formatting for YAML output
- RHDH and Keycloak deployments now use early failure detection for faster error reporting

### Environment Variables

- `GIT_PR_NUMBER`: Enables OCI URL generation for PR builds
- `RHDH_SKIP_PLUGIN_METADATA_INJECTION`: Disables all metadata handling

## [1.1.4]

### Fixed

- Keycloak: Use plain HTTP route to avoid certificate issues (#19)

### Security

- Bump `lodash` from 4.17.21 to 4.17.23
- Bump `tar` from 7.5.2 to 7.5.6

## [1.1.3]

### Added

- Comprehensive VitePress documentation site (#14)

### Fixed

- Corepack setup for Yarn 3 in CI workflow (#16)

## [1.1.2]

### Added

- Keycloak integration with modular auth configuration (#8)
- KeycloakHelper class for Keycloak deployment and management
- Support for guest and Keycloak authentication providers
- Automatic Keycloak deployment in global setup
- Default realm, client, groups, and users configuration
- Keycloak integration documentation (#9)

### Changed

- Improved RHDHDeployment class with `configure()` method
- Enhanced configuration merging for auth-specific configs
- Better environment variable handling

## [1.1.1]

### Added

- Playwright helpers: UIHelper, LoginHelper, APIHelper (#7)
- Page objects: CatalogPage, HomePage, CatalogImportPage, ExtensionsPage, NotificationPage

## [1.1.0]

### Added

- Initial release of `@red-hat-developer-hub/e2e-test-utils`
- RHDHDeployment class for RHDH deployment
- Playwright test fixtures (rhdh, uiHelper, loginHelper, baseURL)
- Base Playwright configuration with `defineConfig`
- KubernetesClientHelper for Kubernetes operations
- YAML merging utilities
- Environment variable substitution
- ESLint configuration factory
- TypeScript base configuration
- Support for Helm and Operator deployment methods

### Fixed

- Config file resolution for published package (#6)

## [1.0.0]

### Added

- Initial project setup
- Basic deployment functionality
- Playwright integration

---

## Migration Guides

### Migrating from 1.0.x to 1.1.x

1. **Update imports** - No changes required
2. **Configure authentication** - Use the new `auth` option:
   ```typescript
   await rhdh.configure({ auth: "keycloak" });
   ```
3. **Keycloak auto-deployment** - Keycloak is now automatically deployed unless `SKIP_KEYCLOAK_DEPLOYMENT=true`

### New Authentication Configuration

Before (1.0.x):

```typescript
// Manual Keycloak setup required
await rhdh.deploy();
```

After (1.1.x):

```typescript
// Keycloak is auto-deployed and configured
await rhdh.configure({ auth: "keycloak" });
await rhdh.deploy();
```
