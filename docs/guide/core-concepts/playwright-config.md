# Playwright Configuration

The package provides a pre-configured Playwright setup optimized for RHDH testing.

## Using `defineConfig`

```typescript
// playwright.config.ts
import { defineConfig } from "@red-hat-developer-hub/e2e-test-utils/playwright-config";

export default defineConfig({
  projects: [
    {
      name: "my-plugin",
    },
  ],
});
```

The `defineConfig` function extends your configuration with sensible defaults for RHDH testing.

## Base Configuration Defaults

| Setting | Value | Description |
|---------|-------|-------------|
| `testDir` | `./tests` | Test files location |
| `timeout` | 90,000ms | Test timeout |
| `expect.timeout` | 10,000ms | Assertion timeout |
| `retries` | `0` (configurable via `PLAYWRIGHT_RETRIES`) | Test retries |
| `workers` | `"50%"` (configurable via `PLAYWRIGHT_WORKERS`) | Parallel workers |
| `outputDir` | `node_modules/.cache/e2e-test-results` | Playwright artifacts |

### Reporter Settings

| Setting | Value |
|---------|-------|
| `reporter` | `[["list"], ["html"], ["json"]]` |

### Browser Settings

| Setting | Value |
|---------|-------|
| `ignoreHTTPSErrors` | `true` |
| `trace` | `"retain-on-failure"` |
| `screenshot` | `"only-on-failure"` |
| `viewport` | `{ width: 1920, height: 1080 }` |
| `video` | `"retain-on-failure"` at `1280x720` |
| `actionTimeout` | 10,000ms |
| `navigationTimeout` | 50,000ms |

## Global Setup

The base configuration includes a global setup that runs before all tests:

1. **Binary Validation**: Checks for `oc`, `kubectl`, `helm`
2. **Cluster Configuration**: Fetches OpenShift ingress domain
3. **Keycloak Deployment**: Automatically deploys Keycloak (unless skipped)

## Customizing Configuration

`defineConfig` only accepts `projects` overrides. To change other settings, use `baseConfig` with Playwright's `defineConfig`.

```typescript
import { defineConfig } from "@red-hat-developer-hub/e2e-test-utils/playwright-config";

export default defineConfig({
  projects: [
    {
      name: "my-plugin",
      testMatch: "**/*.spec.ts",
    },
    {
      name: "another-plugin",
      testMatch: "**/another-*.spec.ts",
    },
  ],
});
```

## Project Configuration

Each project in Playwright becomes a separate namespace in OpenShift:

```typescript
export default defineConfig({
  projects: [
    {
      name: "tech-radar",    // Namespace: tech-radar
    },
    {
      name: "catalog",       // Namespace: catalog
    },
    {
      name: "topology",      // Namespace: topology
    },
  ],
});
```

### Project-Specific Settings

```typescript
export default defineConfig({
  projects: [
    {
      name: "my-plugin",
      testDir: "./tests/my-plugin",
      testMatch: "**/*.spec.ts",
      use: {
        // Project-specific browser settings
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
```

## Environment Variables for Configuration

```bash
# Enables forbidOnly and auto-cleanup
CI=true

# Configure retries (default: 0)
PLAYWRIGHT_RETRIES=2

# Configure parallel workers (default: "50%")
PLAYWRIGHT_WORKERS=4
```

## Using Base Config Directly

For advanced customization, you can access the raw base config:

```typescript
import { baseConfig } from "@red-hat-developer-hub/e2e-test-utils/playwright-config";
import { defineConfig as playwrightDefineConfig } from "@playwright/test";

export default playwrightDefineConfig({
  ...baseConfig,
  // Your complete custom configuration
  timeout: 60000,
  projects: [{ name: "custom" }],
});
```

## Loading Environment Variables

Environment variables from `.env` files are automatically loaded by the global setup. Place a `.env` file in your `e2e-tests/` directory:


```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
SKIP_KEYCLOAK_DEPLOYMENT=false
GITHUB_TOKEN=ghp_xxxxx
```

## Example: Full Configuration

```typescript
import { baseConfig } from "@red-hat-developer-hub/e2e-test-utils/playwright-config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...baseConfig,
  // Test settings
  timeout: 120000,
  retries: process.env.CI ? 3 : 0,
  workers: process.env.CI ? 4 : 2,

  // Reporter
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],

  // Projects
  projects: [
    {
      name: "tech-radar",
      testDir: "./tests/tech-radar",
    },
    {
      name: "catalog",
      testDir: "./tests/catalog",
    },
  ],

  // Browser settings
  use: {
    viewport: { width: 1920, height: 1080 },
    video: { mode: "retain-on-failure", size: { width: 1280, height: 720 } },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
```
