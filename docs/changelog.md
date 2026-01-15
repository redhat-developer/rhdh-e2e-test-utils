# Changelog

All notable changes to this project will be documented in this file.

## [1.1.2] - Current

### Added
- Keycloak integration with modular auth configuration
- KeycloakHelper class for Keycloak deployment and management
- Support for guest and Keycloak authentication providers
- Automatic Keycloak deployment in global setup
- Default realm, client, groups, and users configuration

### Changed
- Improved RHDHDeployment class with `configure()` method
- Enhanced configuration merging for auth-specific configs
- Better environment variable handling

## [1.1.0]

### Added
- Initial release of `rhdh-e2e-test-utils`
- RHDHDeployment class for RHDH deployment
- Playwright test fixtures (rhdh, uiHelper, loginHelper, baseURL)
- Base Playwright configuration with `defineConfig`
- UIhelper class for Material-UI interactions
- LoginHelper class for authentication
- APIHelper class for GitHub and Backstage APIs
- Page objects (CatalogPage, HomePage, CatalogImportPage, ExtensionsPage, NotificationPage)
- KubernetesClientHelper for Kubernetes operations
- YAML merging utilities
- Environment variable substitution
- ESLint configuration factory
- TypeScript base configuration
- Support for Helm and Operator deployment methods

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
