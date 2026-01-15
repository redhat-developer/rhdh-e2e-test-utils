# Base Config

Playwright configuration utilities for RHDH testing.

## Import

```typescript
import { defineConfig, baseConfig } from "rhdh-e2e-test-utils/playwright-config";
```

## `defineConfig()`

```typescript
function defineConfig(config: PlaywrightTestConfig): PlaywrightTestConfig
```

Creates a Playwright configuration with RHDH defaults.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `PlaywrightTestConfig` | Playwright configuration options |

### Returns

`PlaywrightTestConfig` - Merged configuration with defaults.

### Example

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig({
  projects: [
    { name: "my-plugin" },
  ],
});
```

## `baseConfig`

```typescript
const baseConfig: PlaywrightTestConfig
```

Raw base configuration object. Use for advanced customization.

### Defaults

```typescript
{
  testDir: "./tests",
  timeout: 90000,
  expect: {
    timeout: 30000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: "50%",
  reporter: [["list"], ["html"]],
  use: {
    viewport: { width: 1920, height: 1080 },
    video: "on",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  globalSetup: require.resolve("./global-setup"),
}
```

### Example

```typescript
import { baseConfig } from "rhdh-e2e-test-utils/playwright-config";
import { defineConfig as playwrightDefineConfig } from "@playwright/test";

export default playwrightDefineConfig({
  ...baseConfig,
  timeout: 120000,
  projects: [{ name: "custom" }],
});
```

## Default Values

| Setting | Value |
|---------|-------|
| `testDir` | `"./tests"` |
| `timeout` | `90000` |
| `expect.timeout` | `30000` |
| `fullyParallel` | `true` |
| `retries` | `2` (CI), `0` (local) |
| `workers` | `"50%"` |
| `viewport` | `1920x1080` |
| `video` | `"on"` |
| `trace` | `"retain-on-failure"` |
| `screenshot` | `"only-on-failure"` |

## Customization Examples

### Override Timeout

```typescript
export default defineConfig({
  timeout: 120000,
  projects: [{ name: "my-plugin" }],
});
```

### Custom Reporters

```typescript
export default defineConfig({
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "results.xml" }],
  ],
  projects: [{ name: "my-plugin" }],
});
```

### Multiple Projects

```typescript
export default defineConfig({
  projects: [
    { name: "tech-radar", testDir: "./tests/tech-radar" },
    { name: "catalog", testDir: "./tests/catalog" },
  ],
});
```
