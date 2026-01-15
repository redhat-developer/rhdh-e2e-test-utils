# Basic Test

Minimal working test example.

## Files

### playwright.config.ts

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
import dotenv from "dotenv";

dotenv.config({ path: `${import.meta.dirname}/.env` });

export default defineConfig({
  projects: [
    {
      name: "my-plugin",
    },
  ],
});
```

### .env

```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
SKIP_KEYCLOAK_DEPLOYMENT=true
```

### tests/config/app-config-rhdh.yaml

```yaml
app:
  title: Basic Test Instance
```

### tests/config/dynamic-plugins.yaml

```yaml
includes:
  - dynamic-plugins.default.yaml
```

### tests/config/rhdh-secrets.yaml

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData: {}
```

### tests/specs/basic.spec.ts

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Basic Tests", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "guest" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsGuest();
  });

  test("should load home page", async ({ page }) => {
    await expect(page).toHaveTitle(/Developer Hub/);
  });

  test("should display welcome message", async ({ uiHelper }) => {
    await uiHelper.verifyHeading(/Welcome/);
  });

  test("should navigate to catalog", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await expect(page).toHaveURL(/catalog/);
  });
});
```

## Running

```bash
yarn playwright test
```

## Related Pages

- [Quick Start Guide](/guide/quick-start.md) - Step-by-step setup
- [Guest Authentication Example](./guest-auth-test.md) - More guest auth patterns
- [Keycloak Authentication Example](./keycloak-auth-test.md) - OIDC auth testing
- [UIhelper Guide](/guide/helpers/ui-helper.md) - All UI helper methods
- [Testing Patterns](/guide/core-concepts/testing-patterns.md) - Serial vs parallel testing
