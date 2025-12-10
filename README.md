# rhdh-e2e-test-utils

A comprehensive test utility package for Red Hat Developer Hub (RHDH) end-to-end testing. This package provides a unified framework for deploying RHDH instances, running Playwright tests, and managing Kubernetes resources in OpenShift environments.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Requirements](#requirements)
- [Package Exports](#package-exports)
- [Quick Start](#quick-start)
- [Detailed Usage](#detailed-usage)
  - [Playwright Test Fixtures](#playwright-test-fixtures)
  - [Playwright Configuration](#playwright-configuration)
  - [RHDH Deployment](#rhdh-deployment)
  - [Utilities](#utilities)
  - [ESLint Configuration](#eslint-configuration)
  - [TypeScript Configuration](#typescript-configuration)
- [Configuration Files](#configuration-files)
- [Environment Variables](#environment-variables)
- [Examples](#examples)
- [Development](#development)
  - [Testing Local Changes in Consumer Projects](#testing-local-changes-in-consumer-projects)

## Overview

`rhdh-e2e-test-utils` simplifies end-to-end testing for RHDH plugins by providing:

- **Automated RHDH Deployment**: Deploy RHDH instances via Helm or the RHDH Operator
- **Playwright Integration**: Custom test fixtures that manage deployment lifecycle
- **Kubernetes Utilities**: Helper functions for managing namespaces, ConfigMaps, Secrets, and Routes
- **Configuration Merging**: YAML merging with environment variable substitution
- **Standardized ESLint Rules**: Pre-configured linting for Playwright tests

## Features

- Deploy RHDH using Helm charts or the RHDH Operator
- Automatic namespace creation and cleanup
- Dynamic plugin configuration
- Helpers for UI, API and common Utils
- Kubernetes client helper for OpenShift resources
- Pre-configured Playwright settings optimized for RHDH testing
- ESLint configuration with Playwright and TypeScript best practices

## Installation

```bash
npm install rhdh-e2e-test-utils
```

Or directly from GitHub:

```bash
npm install github:redhat-developer/rhdh-e2e-test-utils#main
```

## Requirements

### System Requirements

- **Node.js**: >= 22
- **Yarn**: >= 3 (this project uses Yarn 3 with Corepack)

### OpenShift Cluster

You must be logged into an OpenShift cluster with sufficient permissions to:

- Create and delete namespaces
- Create ConfigMaps and Secrets
- Install Helm charts or use the RHDH Operator
- Read cluster ingress configuration

## Package Exports

The package provides multiple entry points for different use cases:

| Export Path | Description |
|-------------|-------------|
| `rhdh-e2e-test-utils/test` | Playwright test fixtures with RHDH deployment |
| `rhdh-e2e-test-utils/playwright-config` | Base Playwright configuration |
| `rhdh-e2e-test-utils/rhdh` | RHDH deployment class and types |
| `rhdh-e2e-test-utils/utils` | Utility functions (bash, YAML, Kubernetes) |
| `rhdh-e2e-test-utils/eslint` | ESLint configuration factory |
| `rhdh-e2e-test-utils/tsconfig` | Base TypeScript configuration |

## Quick Start

### 1. Set Up Your E2E Test Project

```bash
mkdir e2e-tests && cd e2e-tests
yarn init -y
yarn add @playwright/test rhdh-e2e-test-utils
```

### 2. Create Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";
import { createPlaywrightConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig(
  createPlaywrightConfig({
    projects: [
      {
        name: "my-plugin",
      },
    ],
  })
);
```

### 3. Create Your Test

```typescript
// tests/my-plugin.spec.ts
import { test, expect } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  await rhdh.deploy();
});

test("my plugin test", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Red Hat Developer Hub/);
});
```

### 4. Create Configuration Files

Create a `config/` directory with your RHDH configuration:

```
config/
├── app-config-rhdh.yaml    # App configuration
├── dynamic-plugins.yaml     # Dynamic plugins configuration
└── rhdh-secrets.yaml        # Secrets (with env var placeholders)
```

### 5. Set Environment Variables

```bash
export RHDH_VERSION="1.5"              # RHDH version
export INSTALLATION_METHOD="helm"       # "helm" or "operator"
```

### 6. Run Tests

```bash
yarn playwright test
```

## Detailed Usage

### Playwright Test Fixtures

The package extends Playwright's test with RHDH-specific fixtures:

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
```

#### Available Fixtures

| Fixture | Scope | Description |
|---------|-------|-------------|
| `rhdh` | worker | Shared RHDHDeployment across all tests in a worker |
| `baseURL` | test | Automatically set to the RHDH instance URL |

#### Fixture Behavior

- **Automatic Namespace**: The namespace is derived from the Playwright project name
- **Auto-cleanup**: In CI environments, namespaces are automatically deleted after tests
- **Shared Deployment**: All tests in a worker share the same RHDH deployment

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
test.beforeAll(async ({ rhdh }) => {
  // Configure RHDH (creates namespace, and optional DeploymentOptions)
  await rhdh.configure();

  // Perform any pre-deployment setup
  // ...

  // Deploy RHDH
  await rhdh.deploy();
});

test("example test", async ({ page, rhdh }) => {
  // page.goto("/") will use rhdh.rhdhUrl as base
  await page.goto("/");

  // Access deployment info
  console.log(`Namespace: ${rhdh.deploymentConfig.namespace}`);
  console.log(`URL: ${rhdh.rhdhUrl}`);

  // Perform any deployment/config update
  // ...
  await rhdh.rolloutRestart();
  // ...
});
```

### Playwright Configuration

Use `createPlaywrightConfig` for sensible defaults:

```typescript
import { defineConfig } from "@playwright/test";
import { createPlaywrightConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig(
  createPlaywrightConfig({
    projects: [
      {
        name: "tech-radar",  // Also used as namespace
      },
      {
        name: "catalog",
      },
    ],
  })
);
```

#### Base Configuration Defaults

| Setting | Value |
|---------|-------|
| `testDir` | `./tests` |
| `timeout` | 90,000ms |
| `retries` | 2 in CI, 0 locally |
| `workers` | 50% of CPUs |
| `viewport` | 1920x1080 |
| `video` | Always on |
| `trace` | Retain on failure |
| `screenshot` | Only on failure |

### RHDH Deployment

#### RHDHDeployment Class

The core class for managing RHDH deployments:

```typescript
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";

const deployment = new RHDHDeployment({
  namespace: "my-test-namespace",
  version: "1.5",                              // Optional, uses RHDH_VERSION env
  method: "helm",                              // Optional, uses INSTALLATION_METHOD env
  appConfig: "config/app-config-rhdh.yaml",    // Optional
  secrets: "config/rhdh-secrets.yaml",         // Optional
  dynamicPlugins: "config/dynamic-plugins.yaml", // Optional
  valueFile: "config/value_file.yaml",         // Optional & Helm only
  subscription: "config/subscription.yaml",    // Optional & Operator only
});
```

#### Deployment Options

```typescript
type DeploymentOptions = {
  namespace: string;              // Required: Kubernetes namespace
  version?: string;               // RHDH version (e.g., "1.5", "1.5.1-CI")
  method?: "helm" | "operator";   // Installation method
  appConfig?: string;             // Path to app-config YAML
  secrets?: string;               // Path to secrets YAML
  dynamicPlugins?: string;        // Path to dynamic-plugins YAML
  valueFile?: string;             // Helm values file (helm only)
  subscription?: string;          // Backstage CR file (operator only)
};
```

#### Deployment Methods

##### Helm Deployment

```typescript
const rhdh = new RHDHDeployment({
  namespace: "my-plugin-tests",
  method: "helm",
  valueFile: "config/value_file.yaml",
});

await rhdh.deploy();
```

##### Operator Deployment

```typescript
const rhdh = new RHDHDeployment({
  namespace: "my-plugin-tests",
  method: "operator",
  subscription: "config/subscription.yaml",
});

await rhdh.deploy();
```

#### RHDHDeployment API

| Method | Description |
|--------|-------------|
| `configure(options?)` | Create namespace and prepare for deployment |
| `deploy()` | Full deployment (configs, secrets, plugins, RHDH) |
| `waitUntilReady(timeout?)` | Wait for deployment to be ready |
| `rolloutRestart()` | Restart the RHDH deployment |
| `teardown()` | Delete the namespace and all resources |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `rhdhUrl` | `string` | The RHDH instance URL |
| `deploymentConfig` | `DeploymentConfig` | Current deployment configuration |
| `k8sClient` | `KubernetesClientHelper` | Kubernetes client instance |

### Utilities

#### Bash Command Execution

Execute shell commands using `zx`:

```typescript
import { $ } from "rhdh-e2e-test-utils/utils";

// Execute commands
await $`oc get pods -n my-namespace`;

// With variables
const namespace = "my-namespace";
await $`oc get pods -n ${namespace}`;

// Capture output
const result = await $`oc get pods -o json`;
console.log(result.stdout);
```

#### Kubernetes Client Helper

```typescript
import { KubernetesClientHelper } from "rhdh-e2e-test-utils/utils";

const k8sClient = new KubernetesClientHelper();

// Create namespace
await k8sClient.createNamespaceIfNotExists("my-namespace");

// Apply ConfigMap from object
await k8sClient.applyConfigMapFromObject(
  "my-config",
  { key: "value" },
  "my-namespace"
);

// Apply Secret from object
await k8sClient.applySecretFromObject(
  "my-secret",
  { stringData: { TOKEN: "secret-value" } },
  "my-namespace"
);

// Get route URL
const url = await k8sClient.getRouteLocation("my-namespace", "my-route");

// Get cluster ingress domain
const domain = await k8sClient.getClusterIngressDomain();

// Delete namespace
await k8sClient.deleteNamespace("my-namespace");
```

#### Environment Variable Substitution

```typescript
import { envsubst } from "rhdh-e2e-test-utils/utils";

// Simple substitution
const result = envsubst("Hello $USER");

// With default values
const result = envsubst("Port: ${PORT:-8080}");

// With braces
const result = envsubst("API: ${API_URL}");
```

### ESLint Configuration

Pre-configured ESLint rules for Playwright tests:

```javascript
// eslint.config.js
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

export default createEslintConfig(import.meta.dirname);
```


### TypeScript Configuration

Extend the base tsconfig:

```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "include": ["tests/**/*.ts"]
}
```

## Configuration Files

### Default Configuration Structure

The package includes default configurations that are merged with your project configs:

```
src/deployment/rhdh/
├── config/
│   ├── app-config-rhdh.yaml    # Base app configuration
│   ├── dynamic-plugins.yaml     # Default dynamic plugins
│   └── rhdh-secrets.yaml        # Base secrets template
├── helm/
│   └── value_file.yaml          # Default Helm values
└── operator/
    └── subscription.yaml        # Default Backstage CR
```

### Project Configuration

Create these files in your project's `config/` directory:

#### app-config-rhdh.yaml

```yaml
app:
  title: My RHDH Test Instance

backend:
  reading:
    allow:
      - host: ${MY_BACKEND_HOST}

auth:
  environment: development
  providers:
    guest:
      dangerouslyAllowOutsideDevelopment: true

# Plugin-specific config
techRadar:
  url: "http://${DATA_SOURCE_URL}/tech-radar"
```

#### dynamic-plugins.yaml

```yaml
includes:
  - dynamic-plugins.default.yaml

plugins:
  - package: ./dynamic-plugins/dist/my-frontend-plugin
    disabled: false
  - package: ./dynamic-plugins/dist/my-backend-plugin-dynamic
    disabled: false
```

#### rhdh-secrets.yaml

Secrets support environment variable substitution (`$VAR` or `${VAR}` syntax).

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  GITHUB_TOKEN: $GITHUB_TOKEN
  MY_API_KEY: $MY_API_KEY
```

- **Local development**: Define secrets in a `.env` file at your project root
- **CI**: Set environment variables directly in your CI pipeline
- **Runtime secrets**: Set `process.env.MY_SECRET` before calling `rhdh.deploy()`

## Environment Variables

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `RHDH_VERSION` | RHDH version to deploy (e.g., "1.5") |
| `INSTALLATION_METHOD` | Deployment method ("helm" or "operator") |

### Auto-Generated Environment Variables

| Variable | Description |
|----------|-------------|
| `K8S_CLUSTER_ROUTER_BASE` | OpenShift ingress domain (set by global setup) |
| `RHDH_BASE_URL` | Full RHDH URL (set during deployment) |

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `CI` | If set, namespaces are auto-deleted after tests |
| `CHART_URL` | Custom Helm chart URL (default: `oci://quay.io/rhdh/chart`) |


## Examples

### Custom Deployment Configuration

```typescript
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";

test.beforeAll(async ({ rhdh }) => {
  rhdh.configure({
    namespace: "custom-test-ns",
    version: "1.5",
    method: "helm",
    appConfig: "custom/app-config.yaml",
    secrets: "custom/secrets.yaml",
    dynamicPlugins: "custom/plugins.yaml",
    valueFile: "custom/values.yaml",
  });

  await rhdh.deploy();

});
```


## Development

### Setup

This project uses Yarn 3 with Corepack. To get started:

```bash
# Enable Corepack (if not already enabled)
corepack enable

# Install dependencies
yarn install

# Build the project
yarn build
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `yarn build` | Clean and build the TypeScript project |
| `yarn check` | Run typecheck, lint, and prettier checks |
| `yarn lint:check` | Check for ESLint issues |
| `yarn lint:fix` | Auto-fix ESLint issues |
| `yarn prettier:check` | Check code formatting |
| `yarn prettier:fix` | Auto-fix code formatting |

### Testing Local Changes in Consumer Projects

When developing features or fixes in `rhdh-e2e-test-utils`, you can test your local changes in a consumer project (e.g., a plugin's e2e-tests) before publishing.

#### 1. Build your local changes

```bash
cd /path/to/rhdh-e2e-test-utils
yarn build
```

#### 2. Update the consumer project's package.json

In your e2e-tests project, update the dependency to point to your local package using the `file:` protocol:

```json
"rhdh-e2e-test-utils": "file:/path/to/rhdh-e2e-test-utils"
```

Example:
```json
"rhdh-e2e-test-utils": "file:/Users/yourname/Documents/rhdh/rhdh-e2e-test-utils"
```

#### 3. Install dependencies in the consumer project

```bash
yarn install
```

#### 4. Run tests with NODE_PRESERVE_SYMLINKS

When running tests with a local symlinked package, you **must** set the `NODE_PRESERVE_SYMLINKS` environment variable:

```bash
NODE_PRESERVE_SYMLINKS=1 yarn test
NODE_PRESERVE_SYMLINKS=1 yarn test:headed
NODE_PRESERVE_SYMLINKS=1 yarn test:ui
```

> **Why is NODE_PRESERVE_SYMLINKS needed?**
>
> When using local packages via `file:` protocol, the package manager creates a symlink. Node.js follows symlinks by default and tries to resolve peer dependencies (like `@playwright/test`) from the original package location. This causes duplicate Playwright instances which fails with:
> ```
> Error: Requiring @playwright/test second time
> ```
> Setting `NODE_PRESERVE_SYMLINKS=1` tells Node.js to resolve dependencies from the symlink location (your project's `node_modules`) instead of the original package location.

#### 5. Rebuild after making changes

When you make further changes to `rhdh-e2e-test-utils`, rebuild before running tests:

```bash
cd /path/to/rhdh-e2e-test-utils
yarn build
```

Then run your tests again in the consumer project (no need to reinstall).

#### 6. Restore the published version

After testing, restore the published version in the consumer project's `package.json`:

```json
"rhdh-e2e-test-utils": "^1.0.0"
```

Then run:
```bash
yarn install
```

You can now run tests normally without `NODE_PRESERVE_SYMLINKS`.

### CI/CD

The project includes GitHub Actions workflows:

- **PR Build and Check**: Runs on pull requests to `main`. Executes linting, type checking, and build verification.
- **Publish to NPM**: Manual workflow dispatch to publish the package to npm registry.

## License

Apache-2.0
