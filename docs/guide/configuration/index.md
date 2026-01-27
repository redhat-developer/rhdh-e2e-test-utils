# Configuration Overview

The package provides configuration tools for ESLint, TypeScript, and RHDH deployment.

## Configuration Topics

| Topic | Description |
|-------|-------------|
| [Configuration Files](/guide/configuration/config-files) | YAML configuration structure |
| [ESLint Configuration](/guide/configuration/eslint-config) | Pre-configured ESLint rules |
| [TypeScript Configuration](/guide/configuration/typescript-config) | Base TypeScript settings |
| [Environment Variables](/guide/configuration/environment-variables) | All environment variables |

## Project Configuration

A typical E2E test project includes these configuration files:

```
e2e-tests/
├── playwright.config.ts      # Playwright configuration
├── tsconfig.json            # TypeScript configuration
├── eslint.config.js         # ESLint configuration
├── .env                     # Environment variables
└── tests/
    └── config/
        ├── app-config-rhdh.yaml   # RHDH app config
        ├── dynamic-plugins.yaml   # Plugin configuration
        ├── rhdh-secrets.yaml      # Secrets template
        └── value_file.yaml        # Helm values (optional)
```

## Quick Setup

### TypeScript

```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "include": ["tests/**/*.ts"]
}
```

### ESLint

```javascript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

export default createEslintConfig(import.meta.dirname);
```

### Playwright

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig({
  projects: [{ name: "my-plugin" }],
});
```

## Configuration Merging

RHDH configurations are merged in layers:

1. **Package defaults** - Base configurations included with the package
2. **Auth-specific** - Configurations for guest or Keycloak auth
3. **Project configs** - Your custom configurations

This allows you to override only what you need while using sensible defaults.

## Plugin Metadata Injection

For PR builds, the package can automatically inject plugin configurations from metadata files. See [Plugin Metadata Injection](/guide/configuration/config-files#plugin-metadata-injection) for details.
