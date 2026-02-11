# Tech Radar Plugin Example

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This is a complete annotated example of E2E tests for the Tech Radar plugin in the overlay repository.

## Overview

The Tech Radar plugin displays technology choices in a radar visualization. The E2E tests verify that:
- The plugin loads correctly
- The radar displays expected sections
- Specific technologies appear in the correct sections

## Directory Structure

```
workspaces/tech-radar/e2e-tests/
├── .env
├── .yarnrc.yml
├── eslint.config.js
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── yarn.lock
└── tests/
    ├── config/
    │   ├── app-config-rhdh.yaml
    │   └── rhdh-secrets.yaml
    └── specs/
        ├── tech-radar.spec.ts
        └── deploy-customization-provider.sh
```

## Configuration Files

### package.json

```json
{
  "name": "tech-radar-e2e-tests",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22",
    "yarn": ">=3"
  },
  "packageManager": "yarn@3.8.7",
  "description": "E2E tests for Tech Radar plugin",
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

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
import dotenv from "dotenv";

dotenv.config({ path: `${import.meta.dirname}/.env` });

/**
 * Tech Radar plugin e2e test configuration.
 * Extends the base config from rhdh-e2e-test-utils.
 */
export default defineConfig({
  projects: [
    {
      name: "tech-radar",
    },
  ],
});
```

### tsconfig.json

```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "include": ["**/*.ts"]
}
```

### eslint.config.js

```javascript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

export default createEslintConfig(import.meta.dirname);
```

### .yarnrc.yml

```yaml
nodeLinker: node-modules
```

## RHDH Configuration

### tests/config/app-config-rhdh.yaml

This file configures RHDH to use the Tech Radar plugin with a custom data URL:

```yaml
# rhdh app config file
# this file is used to merge with the default values of the rhdh app config

app:
  title: RHDH Tech Radar Test Instance

backend:
  reading:
    allow:
      - host: ${TECH_RADAR_DATA_URL}

techRadar:
  url: "http://${TECH_RADAR_DATA_URL}/tech-radar"
```

**Key points:**
- `app.title` - Custom title for the test instance
- `backend.reading.allow` - Allows RHDH to fetch from the data provider
- `techRadar.url` - URL to the Tech Radar JSON data

### tests/config/rhdh-secrets.yaml

Kubernetes Secret for environment variable substitution:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  TECH_RADAR_DATA_URL: $TECH_RADAR_DATA_URL
```

## Deployment Script

### tests/specs/deploy-customization-provider.sh

This script deploys a data provider service that serves Tech Radar JSON:

```bash
#!/bin/bash
set -e

deploy_test_backstage_customization_provider() {
  local project=$1
  echo "Deploying test-backstage-customization-provider in namespace ${project}"

  # Check if the buildconfig already exists (idempotent)
  if ! oc get buildconfig test-backstage-customization-provider -n "${project}" > /dev/null 2>&1; then
    # Get latest nodejs UBI9 tag from cluster, fallback to 18-ubi8
    local nodejs_tag
    nodejs_tag=$(oc get imagestream nodejs -n openshift -o jsonpath='{.spec.tags[*].name}' 2> /dev/null \
      | tr ' ' '\n' | grep -E '^[0-9]+-ubi9$' | sort -t'-' -k1 -n | tail -1)
    nodejs_tag="${nodejs_tag:-18-ubi8}"
    echo "Creating new app for test-backstage-customization-provider using nodejs:${nodejs_tag}"
    oc new-app "openshift/nodejs:${nodejs_tag}~https://github.com/janus-qe/test-backstage-customization-provider" --namespace="${project}"
  else
    echo "BuildConfig for test-backstage-customization-provider already exists in ${project}. Skipping new-app creation."
  fi

  echo "Exposing service for test-backstage-customization-provider"
  oc expose svc/test-backstage-customization-provider --namespace="${project}" 2>&1 || echo "Route already exists, continuing..."
}


deploy_test_backstage_customization_provider "$1"
```

**Key points:**
- Idempotent - checks if resources exist before creating
- Dynamic Node.js version detection from cluster
- Fallback to known working version
- Exposes service via OpenShift Route

## Test Specification

### tests/specs/tech-radar.spec.ts

Complete test file with annotations:

```typescript
import { test, expect, Page } from "rhdh-e2e-test-utils/test";
import { $ } from "rhdh-e2e-test-utils/utils";
import path from "path";

// Path to the deployment script (relative to this file)
const setupScript = path.join(
  import.meta.dirname,
  "deploy-customization-provider.sh",
);

test.describe("Test tech-radar plugin", () => {
  // beforeAll runs once per worker before any tests
  test.beforeAll(async ({ rhdh }) => {
    // Get the namespace from deployment config
    const project = rhdh.deploymentConfig.namespace;

    // Configure RHDH with Keycloak authentication
    await rhdh.configure({ auth: "keycloak" });

    // Deploy the external data provider service
    await $`bash ${setupScript} ${project}`;

    // Get the route URL and set as environment variable
    // Remove http:// prefix as the config expects just the host
    process.env.TECH_RADAR_DATA_URL = (
      await rhdh.k8sClient.getRouteLocation(
        project,
        "test-backstage-customization-provider",
      )
    ).replace("http://", "");

    // Now deploy RHDH (will use the TECH_RADAR_DATA_URL env var)
    await rhdh.deploy();
  });

  // beforeEach runs before each test
  test.beforeEach(async ({ loginHelper }) => {
    // Login as default Keycloak user (test1/test1@123)
    await loginHelper.loginAsKeycloakUser();
  });

  // Main test case
  test("Verify tech-radar", async ({ page, uiHelper }) => {
    // Navigate to Tech Radar via sidebar
    await uiHelper.openSidebar("Tech Radar");

    // Verify main headings are present
    await uiHelper.verifyHeading("Tech Radar");
    await uiHelper.verifyHeading("Company Radar");

    // Verify specific content in radar sections
    await verifyRadarDetails(page, "Languages", "JavaScript");
    await verifyRadarDetails(page, "Frameworks", "React");
    await verifyRadarDetails(page, "Infrastructure", "GitHub Actions");
  });
});

// Helper function to verify content within a radar section
async function verifyRadarDetails(page: Page, section: string, text: string) {
  // Find the section heading, then look for the text within its parent container
  const sectionLocator = page
    .locator(`h2:has-text("${section}")`)
    .locator("xpath=ancestor::*")
    .locator(`text=${text}`);

  // Scroll into view and verify visibility
  await sectionLocator.scrollIntoViewIfNeeded();
  await expect(sectionLocator).toBeVisible();
}
```

**Key points:**
- Uses `rhdh` fixture for deployment management
- Uses `$` utility for bash command execution
- Gets route URL via `k8sClient.getRouteLocation()`
- Sets env var before `rhdh.deploy()` for substitution
- Uses `uiHelper` for common UI interactions
- Custom helper function for repeated assertions

## Running the Tests

### Local Execution

```bash
cd workspaces/tech-radar/e2e-tests

# Install dependencies
yarn install
npx playwright install

# Login to cluster
oc login <cluster-url>

# Run tests
yarn test

# View report
yarn report
```

### CI Execution

Tests run automatically when changes are made to `workspaces/tech-radar/`.

## Test Flow

```
1. beforeAll
   ├── Get namespace from rhdh config
   ├── Configure RHDH with Keycloak auth
   ├── Run deploy-customization-provider.sh
   ├── Get service route URL
   ├── Set TECH_RADAR_DATA_URL env var
   └── Deploy RHDH (with merged configs)

2. beforeEach
   └── Login as Keycloak user

3. test "Verify tech-radar"
   ├── Navigate to Tech Radar sidebar
   ├── Verify "Tech Radar" heading
   ├── Verify "Company Radar" heading
   ├── Verify "JavaScript" in Languages
   ├── Verify "React" in Frameworks
   └── Verify "GitHub Actions" in Infrastructure
```

## Related Pages

- [Basic Plugin Test](./basic-plugin) - Simpler example
- [Spec Files](/overlay/test-structure/spec-files) - Writing tests
- [Pre-requisite Services](/overlay/tutorials/custom-deployment) - Deploy dependencies before RHDH
