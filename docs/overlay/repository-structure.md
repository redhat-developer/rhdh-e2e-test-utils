# Repository Structure

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page explains the structure of the rhdh-plugin-export-overlays repository and where E2E tests fit within it.

## Overlay Repository Overview

The [rhdh-plugin-export-overlays](https://github.com/redhat-developer/rhdh-plugin-export-overlays) repository is a monorepo containing Red Hat Developer Hub plugins from various sources. It uses a workspace-based structure.

```
rhdh-plugin-export-overlays/
├── workspaces/
│   ├── tech-radar/
│   │   ├── plugins/
│   │   │   └── tech-radar/          # Plugin source code
│   │   └── e2e-tests/               # E2E tests for tech-radar
│   ├── another-plugin/
│   │   ├── plugins/
│   │   │   └── another-plugin/
│   │   └── e2e-tests/               # E2E tests for another-plugin
│   └── ...
├── .github/
│   └── workflows/                   # CI/CD pipelines
└── package.json                     # Root package.json
```

## Workspace Structure

Each plugin workspace follows a consistent structure:

```
workspaces/<plugin-name>/
├── metadata/                       # Plugin metadata (Package CRD format)
│   └── plugin.yaml
├── plugins/
│   └── <plugin-name>/              # Plugin source code
│       ├── src/
│       ├── package.json
│       └── ...
└── e2e-tests/                      # E2E tests (optional)
    ├── .env                        # Environment variables
    ├── .yarnrc.yml                 # Yarn configuration
    ├── eslint.config.js            # ESLint configuration
    ├── package.json                # Test dependencies
    ├── playwright.config.ts        # Playwright configuration
    ├── tsconfig.json               # TypeScript configuration
    ├── yarn.lock                   # Dependency lock file
    └── tests/
        ├── config/                 # All files here are OPTIONAL
        └── specs/
            └── <plugin>.spec.ts    # Test specifications
```

## E2E Tests Directory

The `e2e-tests/` directory is a standalone package within the workspace. It:

- Has its own `package.json` and dependencies
- Uses `rhdh-e2e-test-utils` as the primary testing framework
- Is independent from the plugin source code
- Can be run locally or in CI

### Why Separate?

E2E tests are kept separate from plugin source code because:

1. **Different dependencies** - Tests need Playwright, Kubernetes clients, etc.
2. **Different runtime** - Tests run against a deployed RHDH instance
3. **Independent versioning** - Test changes don't require plugin version bumps
4. **CI isolation** - Tests can fail without blocking plugin builds

## Configuration Files Location

::: tip All Configuration Files Are Optional
The `tests/config/` directory can be empty or omitted entirely. The package provides sensible defaults and auto-generates plugin configuration from metadata. Only create files when you need to override defaults.
:::

Configuration files in `tests/config/` are merged with package defaults:

| File | Purpose | When to Create |
|------|---------|----------------|
| `app-config-rhdh.yaml` | RHDH application configuration | Plugin-specific settings needed |
| `rhdh-secrets.yaml` | Kubernetes Secret for env var bridging | Using env vars in RHDH configs |
| `dynamic-plugins.yaml` | Dynamic plugin configuration | Override metadata defaults (rare) |
| `value_file.yaml` | Helm chart values override | Override Helm defaults |
| `subscription.yaml` | Operator subscription config | Override Operator defaults |

See [Configuration Files](./test-structure/configuration-files) for detailed documentation.

## Spec Files Location

Test specifications go in `tests/specs/`:

```
tests/specs/
├── <plugin>.spec.ts           # Main test file
└── another-feature.spec.ts    # Additional test files (optional)
```

## Deployment Scripts (Optional)

Deployment scripts (`.sh` files) can be placed anywhere in the `e2e-tests/` directory - it's up to you. Common locations include:

- `tests/specs/` - alongside spec files
- `tests/scripts/` - dedicated scripts directory
- Root of `e2e-tests/`

The location doesn't matter as long as you reference the correct path in your test code.

## Relationship with rhdh-e2e-test-utils

The overlay E2E tests consume `rhdh-e2e-test-utils` as a dependency:

```
┌─────────────────────────────────────────────────────────┐
│                rhdh-plugin-export-overlays               │
│  ┌─────────────────────────────────────────────────┐    │
│  │           workspaces/<plugin>/e2e-tests         │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │         tests/specs/<plugin>.spec.ts    │    │    │
│  │  │                    │                    │    │    │
│  │  │                imports                  │    │    │
│  │  │                    ▼                    │    │    │
│  │  │           rhdh-e2e-test-utils           │    │    │
│  │  │    ┌───────────────────────────────┐    │    │    │
│  │  │    │ • test fixtures               │    │    │    │
│  │  │    │ • playwright config           │    │    │    │
│  │  │    │ • helpers (UI, Login, API)    │    │    │    │
│  │  │    │ • deployment utilities        │    │    │    │
│  │  │    │ • kubernetes client           │    │    │    │
│  │  │    └───────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Related Pages

- [Directory Layout](./test-structure/directory-layout) - Detailed e2e-tests structure
- [Configuration Files](./test-structure/configuration-files) - YAML configuration details
- [Getting Started](./getting-started) - Set up tests from scratch
