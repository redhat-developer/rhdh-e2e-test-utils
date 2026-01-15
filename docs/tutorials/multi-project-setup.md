# Multi-Project Setup

Configure multiple Playwright projects for different test scenarios.

## Why Multiple Projects?

- Test different plugins separately
- Use different authentication methods
- Isolate test environments
- Run subsets of tests

## Configuration

**playwright.config.ts:**
```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
import dotenv from "dotenv";

dotenv.config({ path: `${import.meta.dirname}/.env` });

export default defineConfig({
  projects: [
    {
      name: "tech-radar",
      testDir: "./tests/tech-radar",
      testMatch: "**/*.spec.ts",
    },
    {
      name: "catalog",
      testDir: "./tests/catalog",
      testMatch: "**/*.spec.ts",
    },
    {
      name: "topology",
      testDir: "./tests/topology",
      testMatch: "**/*.spec.ts",
    },
  ],
});
```

## Directory Structure

```
e2e-tests/
├── playwright.config.ts
├── .env
└── tests/
    ├── tech-radar/
    │   ├── config/
    │   │   ├── app-config-rhdh.yaml
    │   │   └── dynamic-plugins.yaml
    │   └── specs/
    │       └── tech-radar.spec.ts
    ├── catalog/
    │   ├── config/
    │   │   ├── app-config-rhdh.yaml
    │   │   └── dynamic-plugins.yaml
    │   └── specs/
    │       └── catalog.spec.ts
    └── topology/
        ├── config/
        │   ├── app-config-rhdh.yaml
        │   └── dynamic-plugins.yaml
        └── specs/
            └── topology.spec.ts
```

## Project-Specific Configuration

Each project gets its own namespace derived from the project name:

- `tech-radar` → namespace `tech-radar`
- `catalog` → namespace `catalog`
- `topology` → namespace `topology`

## Test Files

**tests/tech-radar/specs/tech-radar.spec.ts:**
```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({
    auth: "keycloak",
    appConfig: "tests/tech-radar/config/app-config-rhdh.yaml",
    dynamicPlugins: "tests/tech-radar/config/dynamic-plugins.yaml",
  });
  await rhdh.deploy();
});

test("tech radar test", async ({ uiHelper }) => {
  await uiHelper.openSidebar("Tech Radar");
  await uiHelper.verifyHeading("Tech Radar");
});
```

## Running Projects

```bash
# Run all projects
yarn playwright test

# Run specific project
yarn playwright test --project=tech-radar

# Run multiple projects
yarn playwright test --project=tech-radar --project=catalog
```

## Parallel Execution

Projects run in parallel by default. Each project:

- Gets its own namespace
- Has its own RHDH deployment
- Is isolated from other projects

## Shared Configuration

Create shared config that all projects use:

**tests/shared/config/base-app-config.yaml:**
```yaml
app:
  title: E2E Test Instance

backend:
  cors:
    origin: "*"
```

Then import in project configs:

**tests/tech-radar/config/app-config-rhdh.yaml:**
```yaml
# Extends base config
app:
  title: Tech Radar E2E Tests

techRadar:
  url: "http://${TECH_RADAR_URL}/data"
```

## Project Dependencies

Run projects in sequence:

```typescript
export default defineConfig({
  projects: [
    {
      name: "setup",
      testMatch: /setup\.ts/,
    },
    {
      name: "tests",
      dependencies: ["setup"],
      testMatch: "**/*.spec.ts",
    },
  ],
});
```

## Best Practices

1. **Keep projects focused** - One plugin/feature per project
2. **Share common code** - Use shared helpers and utilities
3. **Use consistent naming** - Project name = namespace
4. **Isolate configurations** - Separate config per project
