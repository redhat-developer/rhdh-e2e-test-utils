# Changelog

All notable changes to this project will be documented in this file.

## [1.1.9] - Current

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
- New utilities: `shouldInjectPluginMetadata()`, `generateDynamicPluginsConfigFromMetadata()`, `loadAndInjectPluginMetadata()`, `extractPluginName()`
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
- Initial release of `rhdh-e2e-test-utils`
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
