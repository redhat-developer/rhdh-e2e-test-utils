# Installation

## Package Installation

Install via npm:

```bash
npm install rhdh-e2e-test-utils
```

Or via yarn:

```bash
yarn add rhdh-e2e-test-utils
```

Or directly from GitHub (for development versions):

```bash
npm install github:redhat-developer/rhdh-e2e-test-utils#main
```

## Peer Dependencies

The package requires `@playwright/test` as a peer dependency:

```bash
npm install @playwright/test
```

## Verifying Installation

After installation, you can verify by importing the package:

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";

// If these imports work without errors, installation is successful
```

## Project Setup

### 1. Create E2E Test Directory

```bash
mkdir e2e-tests && cd e2e-tests
yarn init -y
```

### 2. Install Dependencies

```bash
yarn add @playwright/test rhdh-e2e-test-utils typescript
```

### 3. Create Configuration Files

Create the following files in your project:

**playwright.config.ts**
```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig({
  projects: [
    {
      name: "my-plugin",
    },
  ],
});
```

**tsconfig.json**
```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "include": ["tests/**/*.ts"]
}
```

**eslint.config.js**
```javascript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

export default createEslintConfig(import.meta.dirname);
```

### 4. Create Test Directory Structure

```bash
mkdir -p tests/config tests/specs
```

Your project structure should look like:

```
e2e-tests/
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── eslint.config.js
├── .env                          # Environment variables
└── tests/
    ├── config/
    │   ├── app-config-rhdh.yaml  # RHDH app configuration
    │   ├── dynamic-plugins.yaml  # Plugin configuration
    │   └── rhdh-secrets.yaml     # Secrets template
    └── specs/
        └── my-plugin.spec.ts     # Test files
```

## Next Steps

- [Requirements](/guide/requirements) - Check system and cluster requirements
- [Quick Start](/guide/quick-start) - Create your first test
