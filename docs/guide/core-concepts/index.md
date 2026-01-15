# Core Concepts

This section covers the fundamental concepts you need to understand when using `rhdh-e2e-test-utils`.

## Package Architecture

The package is organized into several modules, each with a specific purpose:

```
rhdh-e2e-test-utils
├── /test           → Playwright fixtures
├── /playwright-config → Base Playwright configuration
├── /rhdh           → RHDH deployment class
├── /keycloak       → Keycloak deployment helper
├── /utils          → Utility functions
├── /helpers        → UI, Login, API helpers
├── /pages          → Page object classes
├── /eslint         → ESLint configuration
└── /tsconfig       → TypeScript configuration
```

## Key Concepts

### 1. Playwright Fixtures

The package extends Playwright's test framework with custom fixtures:

- **`rhdh`** - Manages RHDH deployment lifecycle
- **`uiHelper`** - Provides UI interaction methods
- **`loginHelper`** - Handles authentication
- **`baseURL`** - Automatically set to RHDH URL

[Learn more about Playwright Fixtures →](/guide/core-concepts/playwright-fixtures)

### 2. Deployment Lifecycle

Tests follow a deployment lifecycle:

1. **Configure** - Set deployment options (auth, plugins, configs)
2. **Deploy** - Create namespace, apply configs, install RHDH
3. **Test** - Run Playwright tests
4. **Cleanup** - Delete namespace (in CI)

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

### 3. Configuration Merging

Configurations are merged in layers:

1. **Common configs** - Base configurations included with the package
2. **Auth configs** - Provider-specific configs (guest, keycloak)
3. **Project configs** - Your custom configurations

This allows you to override only what you need while using sensible defaults.

### 4. Namespace Management

- Namespaces are derived from Playwright project names
- Each worker gets its own namespace
- Automatic cleanup in CI environments

### 5. Authentication Providers

Two authentication providers are supported:

| Provider | Use Case |
|----------|----------|
| `guest` | Development and simple testing |
| `keycloak` | OIDC authentication testing |

## In This Section

- [Package Exports](/guide/core-concepts/package-exports) - All available exports
- [Playwright Fixtures](/guide/core-concepts/playwright-fixtures) - Custom fixtures
- [Playwright Configuration](/guide/core-concepts/playwright-config) - Configuration options
- [Global Setup](/guide/core-concepts/global-setup) - Pre-test setup behavior
