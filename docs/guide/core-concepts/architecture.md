# Architecture Overview

This page explains how the different components of `rhdh-e2e-test-utils` work together to provide a seamless E2E testing experience.

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Your Test Project                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│   │  Test Files     │    │ playwright      │    │ Config Files    │        │
│   │  *.spec.ts      │    │ .config.ts      │    │ app-config.yaml │        │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘        │
│            │                      │                      │                  │
└────────────┼──────────────────────┼──────────────────────┼──────────────────┘
             │                      │                      │
             ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         rhdh-e2e-test-utils                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         Test Fixtures                                │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│   │  │   rhdh   │  │ uiHelper │  │loginHelper│  │ apiHelper│            │  │
│   │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │  │
│   └───────┼─────────────┼────────────┼─────────────┼────────────────────┘  │
│           │             │            │             │                        │
│   ┌───────▼─────────────┼────────────┼─────────────┼────────────────────┐  │
│   │    Deployment       │            │             │                     │  │
│   │  ┌──────────────┐   │            │             │                     │  │
│   │  │RHDHDeployment│   │            │             │                     │  │
│   │  └──────┬───────┘   │            │             │                     │  │
│   │         │           │            │             │                     │  │
│   │  ┌──────▼───────┐   │     ┌──────▼─────────────▼─────────┐          │  │
│   │  │KeycloakHelper│   │     │       Helper Classes          │          │  │
│   │  └──────────────┘   │     │  UIhelper, LoginHelper, etc   │          │  │
│   │                     │     └───────────────────────────────┘          │  │
│   └─────────────────────┼────────────────────────────────────────────────┘  │
│                         │                                                   │
│   ┌─────────────────────▼────────────────────────────────────────────────┐  │
│   │                      Utilities                                        │  │
│   │  ┌────────────────────┐  ┌─────────────┐  ┌────────────────────┐    │  │
│   │  │KubernetesClient    │  │  mergeYaml  │  │     envsubst       │    │  │
│   │  │    Helper          │  │             │  │                    │    │  │
│   │  └─────────┬──────────┘  └──────┬──────┘  └─────────┬──────────┘    │  │
│   └────────────┼────────────────────┼───────────────────┼────────────────┘  │
│                │                    │                   │                   │
└────────────────┼────────────────────┼───────────────────┼───────────────────┘
                 │                    │                   │
                 ▼                    ▼                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         OpenShift Cluster                                   │
├────────────────────────────────────────────────────────────────────────────┤
│   ┌────────────────────┐      ┌────────────────────┐                       │
│   │   RHDH Namespace   │      │ Keycloak Namespace │                       │
│   │  ┌──────────────┐  │      │  ┌──────────────┐  │                       │
│   │  │  Backstage   │◄─┼──────┼──│   Keycloak   │  │                       │
│   │  │   Pod(s)     │  │ OIDC │  │    Pod       │  │                       │
│   │  └──────────────┘  │      │  └──────────────┘  │                       │
│   │  ┌──────────────┐  │      └────────────────────┘                       │
│   │  │  ConfigMaps  │  │                                                    │
│   │  │   Secrets    │  │                                                    │
│   │  └──────────────┘  │                                                    │
│   └────────────────────┘                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Test Fixtures

The package provides Playwright fixtures that are automatically injected into your tests:

| Fixture | Type | Purpose |
|---------|------|---------|
| `rhdh` | `RHDHDeployment` | Deploy and manage RHDH instances |
| `uiHelper` | `UIhelper` | Interact with Material-UI components |
| `loginHelper` | `LoginHelper` | Handle authentication flows |
| `apiHelper` | `APIHelper` | Make Backstage API calls |
| `page` | `Page` | Playwright page object (built-in) |
| `baseURL` | `string` | RHDH instance URL |

### Deployment Layer

Manages the lifecycle of RHDH and Keycloak on OpenShift:

```
Global Setup
    │
    ├── KeycloakHelper.deploy()      ─── Deploys Keycloak via Helm
    │       │
    │       └── configureForRHDH()   ─── Creates realm, client, users
    │
    └── RHDHDeployment.deploy()      ─── Deploys RHDH via Helm/Operator
            │
            ├── mergeConfigurations()  ─── Merges YAML configs
            │
            └── applyToCluster()       ─── Creates K8s resources
```

### Helper Classes

Provide high-level abstractions for common operations:

```
UIhelper
├── verifyHeading()      ─── Check page headings
├── openSidebar()        ─── Navigate via sidebar
├── clickButton()        ─── Click Material-UI buttons
├── verifyRowsInTable()  ─── Verify table contents
└── ... (50+ methods)

LoginHelper
├── loginAsGuest()       ─── Guest authentication
├── loginAsKeycloakUser()─── Keycloak OIDC login
└── signOut()            ─── Logout

APIHelper
├── getEntityByName()    ─── Fetch catalog entities
├── importEntity()       ─── Register catalog entities
└── deleteEntity()       ─── Remove catalog entities
```

### Utilities

Low-level utilities used by the higher-level components:

```
KubernetesClientHelper
├── createNamespace()    ─── Create K8s namespaces
├── applyResource()      ─── Apply K8s manifests
├── waitForDeployment()  ─── Wait for pods to be ready
└── exec()               ─── Execute commands in pods

mergeYaml
├── mergeYamlConfigs()   ─── Merge multiple YAML files
└── deepMerge()          ─── Deep merge objects

envsubst
└── substituteEnv()      ─── Replace ${VAR} in strings
```

## Data Flow

### 1. Test Initialization

```
playwright.config.ts
       │
       ▼
┌──────────────────┐
│   baseConfig     │  ─── Provides default configuration
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   globalSetup    │  ─── Deploys infrastructure before tests
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
Keycloak    RHDH
 deploy    deploy
```

### 2. Configuration Merging

```
Package Default Configs          Your Project Configs
        │                                │
        ▼                                ▼
┌───────────────────┐          ┌───────────────────┐
│ common/           │          │ tests/config/     │
│  app-config.yaml  │          │  app-config.yaml  │
│  dynamic-plugins  │          │  dynamic-plugins  │
│  secrets.yaml     │          │  secrets.yaml     │
└─────────┬─────────┘          └─────────┬─────────┘
          │                              │
          └──────────┬───────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  mergeYaml   │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │   envsubst   │  ─── ${K8S_CLUSTER_URL} → actual value
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │  ConfigMap   │  ─── Applied to OpenShift
              └──────────────┘
```

### 3. Test Execution

```
test("my test", async ({ uiHelper, loginHelper }) => {
  // 1. Login via Keycloak
  await loginHelper.loginAsKeycloakUser();
         │
         ▼
    ┌─────────────────────────────────────────┐
    │  Playwright navigates to RHDH           │
    │  Redirects to Keycloak login            │
    │  Fills credentials, submits             │
    │  Redirects back to RHDH authenticated   │
    └─────────────────────────────────────────┘

  // 2. Interact with UI
  await uiHelper.openSidebar("Catalog");
         │
         ▼
    ┌─────────────────────────────────────────┐
    │  Finds sidebar button by data-testid    │
    │  Clicks to navigate                     │
    │  Waits for page load                    │
    └─────────────────────────────────────────┘

  // 3. Verify results
  await uiHelper.verifyHeading("My Org Catalog");
         │
         ▼
    ┌─────────────────────────────────────────┐
    │  Locates heading element                │
    │  Asserts text matches                   │
    │  Throws if not found                    │
    └─────────────────────────────────────────┘
});
```

## Package Exports

Each export serves a specific purpose:

| Export | Import Path | Purpose |
|--------|------------|---------|
| Test fixtures | `rhdh-e2e-test-utils/test` | Main test API with fixtures |
| Playwright config | `rhdh-e2e-test-utils/playwright-config` | Base Playwright configuration |
| RHDH deployment | `rhdh-e2e-test-utils/rhdh` | RHDHDeployment class |
| Keycloak | `rhdh-e2e-test-utils/keycloak` | KeycloakHelper class |
| Helpers | `rhdh-e2e-test-utils/helpers` | UIhelper, LoginHelper, etc. |
| Page objects | `rhdh-e2e-test-utils/pages` | Page object classes |
| Utilities | `rhdh-e2e-test-utils/utils` | KubernetesClientHelper, etc. |
| ESLint | `rhdh-e2e-test-utils/eslint` | ESLint configuration |
| TypeScript | `rhdh-e2e-test-utils/tsconfig` | TypeScript base config |

## Fixture Dependencies

Understanding the dependencies between fixtures helps when using them directly:

```
rhdh fixture
├── Depends on: KubernetesClientHelper (internal)
├── Depends on: KeycloakHelper (when auth: "keycloak")
└── Provides: baseURL to other fixtures

uiHelper fixture
├── Depends on: page (Playwright Page)
└── Independent of: rhdh, loginHelper

loginHelper fixture
├── Depends on: page (Playwright Page)
├── Depends on: uiHelper (for UI interactions)
└── Uses: baseURL (from environment)

apiHelper fixture
├── Depends on: page (Playwright Page)
└── Uses: baseURL (from environment)
```

## Best Practices

### 1. Use Fixtures, Not Direct Imports

```typescript
// Recommended: Use fixtures
test("example", async ({ uiHelper }) => {
  await uiHelper.openSidebar("Catalog");
});

// Avoid: Direct instantiation (unless needed for serial tests)
import { UIhelper } from "rhdh-e2e-test-utils/helpers";
const helper = new UIhelper(page);
```

### 2. Let Global Setup Handle Deployment

```typescript
// Recommended: Configure in global setup, test focuses on behavior
test("verify catalog", async ({ uiHelper }) => {
  await uiHelper.verifyHeading("Catalog");
});

// Avoid: Deploying in each test file
test.beforeAll(async ({ rhdh }) => {
  await rhdh.deploy(); // This slows down tests
});
```

### 3. Separate Concerns

```
tests/
├── config/              # Configuration files
│   ├── app-config.yaml
│   └── dynamic-plugins.yaml
├── fixtures/            # Custom fixtures (if needed)
├── pages/               # Custom page objects (if needed)
└── specs/               # Test files
    ├── catalog.spec.ts
    └── auth.spec.ts
```

## Related Pages

- [Package Exports](./package-exports.md) - Detailed export documentation
- [Playwright Fixtures](./playwright-fixtures.md) - Fixture deep dive
- [Global Setup](./global-setup.md) - Setup process details
- [RHDH Deployment](../deployment/rhdh-deployment.md) - Deployment options
