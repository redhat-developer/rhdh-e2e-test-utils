# Getting Started

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This guide shows how to write E2E tests for plugins in the overlay repository.

## The Playwright Config

Create `playwright.config.ts`:

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

The package provides all Playwright settings, timeouts, and reporter configuration. You just specify your project name.

## The Test

Create `tests/specs/my-plugin.spec.ts`:

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Test my-plugin", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  test("Verify plugin loads", async ({ uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");
    await uiHelper.verifyHeading("My Plugin");
  });

  test("Verify feature works", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");
    await uiHelper.clickButton("Get Started");
    await expect(page.locator("text=Success")).toBeVisible();
  });
});
```

**That's a complete E2E test.** The framework handles:
- Deploying RHDH to your cluster
- Configuring Keycloak authentication
- Plugin configuration from metadata
- Login and session management

## Run It

```bash
yarn test
```

## What Happens Automatically

When you run tests, the framework:

1. **Deploys Keycloak** (if needed) for authentication
2. **Creates a namespace** for your test
3. **Reads plugin metadata** from `../metadata/*.yaml`
4. **Generates plugin configuration** automatically
5. **Deploys RHDH** with your plugins enabled
6. **Runs your tests** with automatic login
7. **Cleans up** the namespace (in CI)

You don't need to configure any of this manually.

## Plugin Configuration (Usually Automatic)

The package reads your plugin's metadata files and auto-generates the configuration:

```
workspaces/my-plugin/
├── metadata/                    # Your plugin metadata
│   └── plugin.yaml              # Package CRD format
├── e2e-tests/                   # Your test project
│   ├── playwright.config.ts     # ← You write this
│   └── tests/specs/
│       └── my-plugin.spec.ts    # ← You write this
└── plugins/
    └── my-plugin/               # Plugin source
```

**No `dynamic-plugins.yaml` needed** - it's generated from metadata.

## When You Need Configuration

Only create configuration files if your plugin needs:

- **External service URLs** → Create `app-config-rhdh.yaml`
- **Secrets in RHDH configs** → Create `rhdh-secrets.yaml`
- **Custom plugin settings** → Override with `dynamic-plugins.yaml`

See [Configuration Files](./test-structure/configuration-files) for details.

## Full Project Setup

The examples above show the important files. For complete project setup including `package.json`, `tsconfig.json`, and other boilerplate, see:

- [New Workspace Tutorial](./tutorials/new-workspace) - Step-by-step project setup
- [Directory Layout](./test-structure/directory-layout) - Full file structure

## Next Steps

- [Spec Files](./test-structure/spec-files) - Writing test specifications
- [Tech Radar Example](./examples/tech-radar) - Complete working example
- [Running Tests Locally](./tutorials/running-locally) - Development workflow
