# Playwright Configuration

The package provides a pre-configured Playwright setup optimized for RHDH testing.

## Using `defineConfig`

```typescript
// playwright.config.ts
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";

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
| `expect.timeout` | 30,000ms | Assertion timeout |
| `retries` | 2 (CI), 0 (local) | Test retries |
| `workers` | 50% of CPUs | Parallel workers |
| `fullyParallel` | `true` | Parallel test execution |

### Reporter Settings

| Setting | Value |
|---------|-------|
| `reporter` | `[["list"], ["html"]]` |

### Browser Settings

| Setting | Value |
|---------|-------|
| `viewport` | `{ width: 1920, height: 1080 }` |
| `video` | `"on"` |
| `trace` | `"retain-on-failure"` |
| `screenshot` | `"only-on-failure"` |

## Global Setup

The base configuration includes a global setup that runs before all tests:

1. **Binary Validation**: Checks for `oc`, `kubectl`, `helm`
2. **Cluster Configuration**: Fetches OpenShift ingress domain
3. **Keycloak Deployment**: Automatically deploys Keycloak (unless skipped)

## Customizing Configuration

You can override any setting by passing it to `defineConfig`:

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig({
  // Override timeout
  timeout: 120000,

  // Override retries
  retries: 3,

  // Override workers
  workers: 2,

  // Add projects
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

  // Add custom reporter
  reporter: [["list"], ["html"], ["json", { outputFile: "results.json" }]],
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
# Affects retries (2 in CI, 0 locally)
CI=true

# Custom test directory
# (set via defineConfig, not env var)
```

## Using Base Config Directly

For advanced customization, you can access the raw base config:

```typescript
import { baseConfig } from "rhdh-e2e-test-utils/playwright-config";
import { defineConfig as playwrightDefineConfig } from "@playwright/test";

export default playwrightDefineConfig({
  ...baseConfig,
  // Your complete custom configuration
  timeout: 60000,
  projects: [{ name: "custom" }],
});
```

## Loading Environment Variables

Use `dotenv` to load environment variables from a `.env` file:

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
import dotenv from "dotenv";

// Load .env file
dotenv.config({ path: `${import.meta.dirname}/.env` });

export default defineConfig({
  projects: [{ name: "my-plugin" }],
});
```

Create a `.env` file:

```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
SKIP_KEYCLOAK_DEPLOYMENT=false
GITHUB_TOKEN=ghp_xxxxx
```

## Example: Full Configuration

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
import dotenv from "dotenv";

dotenv.config({ path: `${import.meta.dirname}/.env` });

export default defineConfig({
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
    video: "on",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
```
