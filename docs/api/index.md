# API Reference

Complete API documentation for all exports from `rhdh-e2e-test-utils`.

## Exports Overview

| Export | Description |
|--------|-------------|
| [`/test`](/api/playwright/test-fixtures) | Playwright test fixtures |
| [`/playwright-config`](/api/playwright/base-config) | Base Playwright configuration |
| [`/rhdh`](/api/deployment/rhdh-deployment) | RHDHDeployment class |
| [`/keycloak`](/api/deployment/keycloak-helper) | KeycloakHelper class |
| [`/utils`](/api/utils/kubernetes-client) | Utility functions |
| [`/helpers`](/api/helpers/ui-helper) | Helper classes |
| [`/pages`](/api/pages/catalog-page) | Page object classes |
| [`/eslint`](/api/eslint/create-eslint-config) | ESLint configuration |

## Categories

### Deployment

- [RHDHDeployment](/api/deployment/rhdh-deployment) - RHDH deployment management
- [Deployment Types](/api/deployment/deployment-types) - Type definitions
- [KeycloakHelper](/api/deployment/keycloak-helper) - Keycloak management
- [Keycloak Types](/api/deployment/keycloak-types) - Type definitions

### Playwright

- [Test Fixtures](/api/playwright/test-fixtures) - Custom Playwright fixtures
- [Base Config](/api/playwright/base-config) - Playwright configuration
- [Global Setup](/api/playwright/global-setup) - Pre-test setup

### Helpers

- [UIhelper](/api/helpers/ui-helper) - UI interaction methods
- [LoginHelper](/api/helpers/login-helper) - Authentication methods
- [APIHelper](/api/helpers/api-helper) - API interaction methods

### Page Objects

- [CatalogPage](/api/pages/catalog-page) - Catalog interactions
- [HomePage](/api/pages/home-page) - Home page interactions
- [CatalogImportPage](/api/pages/catalog-import-page) - Component registration
- [ExtensionsPage](/api/pages/extensions-page) - Plugin management
- [NotificationPage](/api/pages/notification-page) - Notifications

### Utilities

- [KubernetesClientHelper](/api/utils/kubernetes-client) - Kubernetes API
- [Bash ($)](/api/utils/bash) - Shell command execution
- [YAML Merging](/api/utils/merge-yamls) - YAML utilities
- [envsubst](/api/utils/common) - Environment substitution

### ESLint

- [createEslintConfig](/api/eslint/create-eslint-config) - ESLint factory
