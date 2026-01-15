# Package Exports

The package provides multiple entry points for different use cases. Each export is designed for a specific purpose.

## Export Summary

| Export Path | Description |
|-------------|-------------|
| `rhdh-e2e-test-utils/test` | Playwright test fixtures with RHDH deployment |
| `rhdh-e2e-test-utils/playwright-config` | Base Playwright configuration |
| `rhdh-e2e-test-utils/rhdh` | RHDH deployment class and types |
| `rhdh-e2e-test-utils/keycloak` | Keycloak deployment helper |
| `rhdh-e2e-test-utils/utils` | Utility functions (bash, YAML, Kubernetes) |
| `rhdh-e2e-test-utils/helpers` | UI, API, and login helper classes |
| `rhdh-e2e-test-utils/pages` | Page object classes for common RHDH pages |
| `rhdh-e2e-test-utils/eslint` | ESLint configuration factory |
| `rhdh-e2e-test-utils/tsconfig` | Base TypeScript configuration |

## Detailed Exports

### Test Fixtures (`/test`)

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
```

Provides extended Playwright test with RHDH-specific fixtures:
- `rhdh` - RHDHDeployment instance
- `uiHelper` - UIhelper instance
- `loginHelper` - LoginHelper instance
- `baseURL` - RHDH instance URL

### Playwright Configuration (`/playwright-config`)

```typescript
import { defineConfig, baseConfig } from "rhdh-e2e-test-utils/playwright-config";
```

- `defineConfig(options)` - Create Playwright config with defaults
- `baseConfig` - Raw base configuration object

### RHDH Deployment (`/rhdh`)

```typescript
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";
import type { DeploymentOptions, DeploymentConfig } from "rhdh-e2e-test-utils/rhdh";
```

- `RHDHDeployment` - Class for managing RHDH deployments
- Type definitions for deployment options

### Keycloak Helper (`/keycloak`)

```typescript
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";
import type { KeycloakDeploymentOptions } from "rhdh-e2e-test-utils/keycloak";
```

- `KeycloakHelper` - Class for Keycloak deployment and management
- Type definitions for Keycloak configuration

### Utilities (`/utils`)

```typescript
import { $, KubernetesClientHelper, envsubst, mergeYamlFiles } from "rhdh-e2e-test-utils/utils";
```

- `$` - Bash command execution via zx
- `KubernetesClientHelper` - Kubernetes API wrapper
- `envsubst` - Environment variable substitution
- `mergeYamlFiles` - YAML file merging

### Helpers (`/helpers`)

```typescript
import { UIhelper, LoginHelper, APIHelper, setupBrowser } from "rhdh-e2e-test-utils/helpers";
```

- `UIhelper` - Material-UI component interactions
- `LoginHelper` - Authentication flows
- `APIHelper` - GitHub and Backstage API operations
- `setupBrowser` - Shared browser context setup

### Pages (`/pages`)

```typescript
import {
  CatalogPage,
  HomePage,
  CatalogImportPage,
  ExtensionsPage,
  NotificationPage,
} from "rhdh-e2e-test-utils/pages";
```

Page object classes for common RHDH pages.

### ESLint Configuration (`/eslint`)

```typescript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";
```

Factory function for creating ESLint flat config with Playwright and TypeScript rules.

### TypeScript Configuration (`/tsconfig`)

```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig"
}
```

Base TypeScript configuration to extend in your project.

## Usage Patterns

### Minimal Test Setup

```typescript
// playwright.config.ts
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
export default defineConfig({ projects: [{ name: "my-plugin" }] });

// tests/my-plugin.spec.ts
import { test, expect } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  await rhdh.deploy();
});

test("example", async ({ page }) => {
  await page.goto("/");
});
```

### Advanced Usage with Helpers

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { CatalogPage } from "rhdh-e2e-test-utils/pages";
import { APIHelper } from "rhdh-e2e-test-utils/helpers";

test("catalog test", async ({ page, uiHelper, loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const catalogPage = new CatalogPage(page);
  await catalogPage.go();
  await catalogPage.search("my-component");

  await uiHelper.verifyRowsInTable(["my-component"]);
});
```

### Direct Deployment Control

```typescript
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";

const keycloak = new KeycloakHelper();
await keycloak.deploy();
await keycloak.configureForRHDH();

const rhdh = new RHDHDeployment("my-namespace");
await rhdh.configure({ auth: "keycloak" });
await rhdh.deploy();
```
