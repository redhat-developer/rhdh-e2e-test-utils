# Directory Layout

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page documents the standard directory layout for E2E tests in overlay workspaces.

## Standard Structure

```
workspaces/<plugin>/e2e-tests/
├── .env                        # Environment variables (optional)
├── .yarn/                      # Yarn PnP cache (auto-generated)
├── .yarnrc.yml                 # Yarn configuration
├── eslint.config.js            # ESLint configuration
├── package.json                # Dependencies and scripts
├── playwright.config.ts        # Playwright configuration
├── tsconfig.json               # TypeScript configuration
├── yarn.lock                   # Dependency lock file
└── tests/
    ├── config/                 # All files here are OPTIONAL
    └── specs/
        └── <plugin>.spec.ts    # Main test specification
```

::: tip Configuration Files Are Optional
The `tests/config/` directory can be empty. Configuration is auto-generated from plugin metadata. See [Configuration Files](./configuration-files) for when to create specific files.
:::


## Root Files

### package.json

Defines the test package with dependencies and scripts:

```json
{
  "name": "<plugin>-e2e-tests",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22",
    "yarn": ">=3"
  },
  "packageManager": "yarn@3.8.7",
  "scripts": {
    "test": "playwright test",
    "report": "playwright show-report",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "lint:check": "eslint .",
    "lint:fix": "eslint . --fix",
    "prettier:check": "prettier --check .",
    "prettier:fix": "prettier --write .",
    "check": "tsc --noEmit && yarn lint:check && yarn prettier:check"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.2",
    "@playwright/test": "1.57.0",
    "@types/node": "^24.10.1",
    "dotenv": "^16.4.7",
    "eslint": "^9.39.2",
    "eslint-plugin-check-file": "^3.3.1",
    "eslint-plugin-playwright": "^2.4.0",
    "prettier": "^3.7.4",
    "rhdh-e2e-test-utils": "1.1.8",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.50.0"
  }
}
```

### playwright.config.ts

Extends the base configuration from `rhdh-e2e-test-utils`:

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
import dotenv from "dotenv";

dotenv.config({ path: `${import.meta.dirname}/.env` });

export default defineConfig({
  projects: [
    {
      name: "<plugin>",
    },
  ],
});
```

### tsconfig.json

Extends TypeScript configuration from the package:

```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "include": ["**/*.ts"]
}
```

### eslint.config.js

Uses the ESLint configuration factory:

```javascript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

export default createEslintConfig(import.meta.dirname);
```

### .yarnrc.yml

Configures Yarn to use node_modules (required for compatibility):

```yaml
nodeLinker: node-modules
```

### .env

Optional file for environment variables. Can contain:

```bash
# Cluster configuration (usually set in CI)
# RHDH_VERSION=1.5
# INSTALLATION_METHOD=helm

# Plugin-specific variables
# MY_PLUGIN_API_KEY=xxx
```

## tests/config/ Directory

Contains YAML configuration files that are merged with defaults when deploying RHDH.

::: tip All Files Are Optional
**All configuration files in this directory are optional.** The package provides sensible defaults. Only create files when you need to override or extend defaults.
:::

| File | Purpose | When to Create |
|------|---------|----------------|
| `app-config-rhdh.yaml` | RHDH configuration | Plugin-specific settings needed |
| `rhdh-secrets.yaml` | Kubernetes secrets | Using env vars in RHDH configs |
| `dynamic-plugins.yaml` | Plugin configuration | **Usually not needed** - auto-generated |
| `value_file.yaml` | Helm values | Override Helm defaults |
| `subscription.yaml` | Operator config | Override Operator defaults |

See [Configuration Files](./configuration-files) for complete details on each file.

## tests/specs/ Directory

Contains test specification files and optional deployment scripts.

### \<plugin\>.spec.ts

Main test file using Playwright and rhdh-e2e-test-utils fixtures:

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Test <plugin>", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  test("Verify functionality", async ({ uiHelper }) => {
    // Test implementation
  });
});
```

### deploy-\*.sh (Optional)

Bash scripts for deploying external services:

```bash
#!/bin/bash
set -e

deploy_external_service() {
  local project=$1
  echo "Deploying service in namespace ${project}"
  # Deployment logic
}

deploy_external_service "$1"
```

## File Naming Conventions

| File Type | Convention | Example |
|-----------|-----------|---------|
| Spec files | `<plugin-name>.spec.ts` | `tech-radar.spec.ts` |
| Deployment scripts | `deploy-<service>.sh` | `deploy-customization-provider.sh` |
| Config files | Standard names | `app-config-rhdh.yaml` |

## Related Pages

- [Configuration Files](./configuration-files) - Detailed YAML configuration
- [Spec Files](./spec-files) - Writing test specifications
- [Pre-requisite Services](/overlay/tutorials/custom-deployment) - Deploy dependencies before RHDH
