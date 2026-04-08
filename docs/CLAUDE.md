# Documentation Guide for Claude

This file contains essential information for maintaining and extending the VitePress documentation for `@red-hat-developer-hub/e2e-test-utils`.

For package-level architecture, source code structure, and build system details, see the root `CLAUDE.md`.

## Documentation Structure

The docs serve two audiences with distinct sections:

```
docs/
├── .vitepress/
│   └── config.ts              # VitePress configuration (nav, sidebar, theme)
├── snippets/                  # Reusable code snippets (included via <!--@include:-->)
├── guide/                     # Package documentation (for any consumer)
│   ├── core-concepts/         # Architecture, fixtures, patterns, global setup
│   ├── deployment/            # RHDH, Keycloak, Helm, Operator
│   ├── helpers/               # UIhelper, LoginHelper, APIHelper
│   ├── page-objects/          # CatalogPage, HomePage, etc.
│   ├── utilities/             # Kubernetes client, bash, YAML merging, plugin metadata
│   └── configuration/         # Config files, ESLint, TypeScript, env vars
├── api/                       # API reference (method signatures, types)
│   ├── deployment/            # RHDHDeployment, KeycloakHelper
│   ├── playwright/            # Fixtures, base config, global setup
│   ├── helpers/               # Helper class APIs
│   ├── pages/                 # Page object APIs
│   ├── utils/                 # Utility APIs (including plugin metadata)
│   └── eslint/                # ESLint config API
├── overlay/                   # Overlay-specific docs (for rhdh-plugin-export-overlays)
│   ├── test-structure/        # Directory layout, config files, spec files
│   ├── tutorials/             # New workspace, running locally, CI pipeline, secrets
│   ├── examples/              # Tech radar, basic plugin
│   └── reference/             # Env vars, run-e2e.sh, OCI testing, scripts, patterns
├── tutorials/                 # Step-by-step learning guides (package-level)
├── examples/                  # Copy-paste ready code examples
├── index.md                   # Home page
└── changelog.md               # Version history
```

### Two Documentation Audiences

| Section | Audience | Scope |
|---------|----------|-------|
| **Guide + API + Tutorials + Examples** | Any project using `@red-hat-developer-hub/e2e-test-utils` | Package features, API, patterns |
| **Overlay** (`/overlay/`) | Contributors writing tests in `rhdh-plugin-export-overlays` | Overlay-specific workflows, CI, run-e2e.sh |

Overlay pages include a `::: tip Overlay Documentation` banner to indicate scope.

## Key Conventions

### Naming Conventions
- **Class name**: `UIhelper` (capital U, lowercase h) - matches source code
- **Fixture variable**: `uiHelper` (camelCase) - used in test fixtures
- **Method names**: Follow source exactly (e.g., `verifyTextinCard` not `verifyTextInCard`)
- **Project name in examples**: Use `"my-plugin"` consistently

### Code Examples
- Use TypeScript for all code examples
- Include imports at the top of code blocks
- Use the fixture pattern (recommended) over direct instantiation
- Standard test structure:
  ```typescript
  import { test, expect } from "@red-hat-developer-hub/e2e-test-utils/test";

  test.describe("Feature", () => {
    test.beforeAll(async ({ rhdh }) => {
      await rhdh.configure({ auth: "keycloak" });
      await rhdh.deploy();
    });
    test.beforeEach(async ({ loginHelper }) => { /* login */ });
    test("should...", async ({ uiHelper }) => { /* test */ });
  });
  ```

### Reusable Snippets
Located in `docs/snippets/`. Include them using:
```markdown
<!--@include: @/snippets/keycloak-credentials.md-->
```

Available snippets:
- `playwright-config.ts` - Base Playwright config
- `env-example.env` - Environment variables
- `basic-test.ts` - Basic test template
- `keycloak-test.ts` - Keycloak auth test
- `guest-test.ts` - Guest auth test
- `global-setup.ts` - Global setup template
- `app-config-rhdh.yaml` - RHDH config template
- `keycloak-credentials.md` - Default user credentials table
- `error-handling.ts` - Error handling patterns
- `serial-vs-parallel.ts` - Testing patterns comparison

### Cross-References
Always add "Related Pages" section at the end of documentation pages:
```markdown
## Related Pages

- [Page Name](/path/to/page) - Brief description
```

### Guide vs API vs Tutorial vs Example vs Overlay

| Section | Purpose | Content Style |
|---------|---------|---------------|
| **Guide** | Explain concepts | Detailed prose, multiple examples, best practices |
| **API** | Reference | Method signatures, parameter tables, brief examples |
| **Tutorial** | Teach step-by-step | Sequential steps, explanations, learning-focused |
| **Example** | Copy-paste code | Minimal prose, complete working code |
| **Overlay** | Overlay-specific workflows | Mix of reference and tutorial, always with `::: tip` banner |

## Important Architectural Concepts to Document Correctly

These are frequently misunderstood. When writing or updating docs, ensure accuracy:

### Plugin Metadata Is Internal
Plugin metadata functions (`processPluginsForDeployment`, `isNightlyJob`, `generatePluginsFromMetadata`) are NOT part of the public `./utils` export. They are internal to `RHDHDeployment.deploy()`. Document them as automatic behavior, not as functions consumers call.

### Three Execution Modes
| Mode | Detection | Plugin Resolution |
|------|-----------|-------------------|
| PR check | `GIT_PR_NUMBER` set | PR-built OCI images + metadata config injection |
| Nightly | `E2E_NIGHTLY_MODE=true` | Released OCI refs from metadata; no config injection |
| Local dev | Neither set | Local paths as-is; metadata config injection |

Priority: `GIT_PR_NUMBER` > `E2E_NIGHTLY_MODE` > `JOB_NAME`

### WorkspacePaths
Resolves config paths from `test.info().project.testDir` (not CWD). This enables tests to work from both workspace level (`yarn test`) and repo root (`run-e2e.sh`). The worker fixture also does `process.chdir(e2eRoot)` as a complementary measure.

### Teardown Reporter (Not afterAll)
Namespace cleanup uses a custom Playwright Reporter, not `afterAll` hooks or fixture teardown. This is because `afterAll` and fixture cleanup fire on worker restart (before retries), which would delete the namespace while tests still need it.

### Configuration Merging
3-level cascade: package defaults -> auth-specific -> user overrides. Arrays use "replace" strategy by default. Plugin arrays use `byKey: "package"` with normalized keys (strips `-dynamic` suffix).

### deploy() Has Built-in Protection
`rhdh.deploy()` uses `runOnce()` internally — it executes exactly once per test run, even across worker restarts. No wrapping needed unless there's other expensive setup (use `test.runOnce("key", fn)` for that).

### E2E_NIGHTLY_MODE Accepts Both Values
The code checks `=== "true" || === "1"`. Document both.

## VitePress Configuration

### Adding New Pages
1. Create the `.md` file in the appropriate directory
2. Update `docs/.vitepress/config.ts` to add to sidebar:
   ```typescript
   {
     text: "Section Name",
     items: [
       { text: "Page Title", link: "/path/to/page" },
     ],
   }
   ```

### Sidebar Structure
The sidebar has 5 top-level sections, each keyed by URL prefix:
- `/guide/` — Package guide (7 subsections)
- `/api/` — API reference (6 subsections)
- `/tutorials/` — Package tutorials
- `/examples/` — Code examples
- `/overlay/` — Overlay testing (5 subsections)

Settings:
- `collapsed: false` — Section expanded by default
- `collapsed: true` — Section collapsed by default
- Items without `collapsed` are always visible

### Version Updates
1. Update version in `docs/.vitepress/config.ts` nav dropdown text
2. Update `docs/changelog.md` with changes

## Source Code Locations

When documenting, reference these source files:

| Component | Source Path |
|-----------|-------------|
| UIhelper | `src/playwright/helpers/ui-helper.ts` |
| LoginHelper | `src/playwright/helpers/common.ts` |
| APIHelper | `src/playwright/helpers/api-helper.ts` |
| AuthApiHelper | `src/playwright/helpers/auth-api-helper.ts` |
| RbacApiHelper | `src/playwright/helpers/rbac-api-helper.ts` |
| AccessibilityHelper | `src/playwright/helpers/accessibility.ts` |
| RHDHDeployment | `src/deployment/rhdh/deployment.ts` |
| Deployment Types | `src/deployment/rhdh/types.ts` |
| Deployment Constants | `src/deployment/rhdh/constants.ts` |
| KeycloakHelper | `src/deployment/keycloak/deployment.ts` |
| Page Objects | `src/playwright/pages/*.ts` |
| Fixtures | `src/playwright/fixtures/test.ts` |
| Base Config | `src/playwright/base-config.ts` |
| Global Setup | `src/playwright/global-setup.ts` |
| runOnce | `src/playwright/run-once.ts` |
| Teardown Reporter | `src/playwright/teardown-reporter.ts` |
| Teardown Namespaces | `src/playwright/teardown-namespaces.ts` |
| Plugin Metadata | `src/utils/plugin-metadata.ts` |
| WorkspacePaths | `src/utils/workspace-paths.ts` |
| KubernetesClientHelper | `src/utils/kubernetes-client.ts` |
| YAML Merging | `src/utils/merge-yamls.ts` |
| Bash ($) | `src/utils/bash.ts` |
| envsubst | `src/utils/common.ts` |
| Config Templates | `src/deployment/rhdh/config/{common,auth,helm,operator}/` |

## Common Tasks

### Update API Documentation
1. Read the source file to get accurate method signatures
2. Update both Guide (`/guide/`) and API (`/api/`) sections
3. Ensure method names match source exactly
4. Check that documented functions are actually exported (verify via `src/*/index.ts`)

### Add New Feature Documentation
1. Add to Guide section with detailed explanation
2. Add to API section with method signatures
3. Add example to Examples section if applicable
4. If overlay-specific, add to Overlay section with `::: tip` banner
5. Update Related Pages in relevant files
6. Add to sidebar in `config.ts`

### Add Overlay Documentation
1. Create page in appropriate `overlay/` subdirectory
2. Add `::: tip Overlay Documentation` banner at top
3. Add sidebar entry in `config.ts` under the `/overlay/` section
4. Cross-reference from related guide/API pages where relevant

### Update Environment Variables
Environment variables are documented in multiple places — keep them in sync:
- `docs/guide/configuration/environment-variables.md` — Package-level env vars
- `docs/overlay/reference/environment-variables.md` — Overlay-specific env vars (superset)
- Individual feature pages that reference specific vars

## Standalone Documentation

The docs are a standalone package, independent of the root project. This allows:
- Separate dependency management
- Faster CI builds (no need to install root dependencies)
- Easier local development

### Setup

```bash
corepack enable  # Enable Yarn 3 via Corepack (one-time setup)
cd docs
yarn install
```

### Build Commands

Run from the `docs/` directory:

```bash
yarn dev      # Start dev server (http://localhost:5173)
yarn build    # Build for production
yarn preview  # Preview production build
```

### Package Structure

```
docs/
├── package.json          # Standalone dependencies (vitepress only)
├── node_modules/         # Local dependencies (gitignored)
├── .vitepress/
│   ├── config.ts         # VitePress configuration
│   ├── cache/            # Build cache (gitignored)
│   └── dist/             # Build output (gitignored)
└── ...
```

## GitHub Pages Deployment

The documentation automatically deploys via `.github/workflows/deploy-docs.yml` when:
- Changes are pushed to `main` branch in `docs/` directory
- Manually triggered via workflow_dispatch

The workflow:
1. Checks out the repository
2. Runs `yarn install` in `docs/` directory
3. Runs `yarn build` in `docs/` directory
4. Deploys `.vitepress/dist` to GitHub Pages

Base URL is configured as `/rhdh-e2e-test-utils/` in `config.ts`.

## Package Exports Reference

| Export | Import Path | Description |
|--------|-------------|-------------|
| Test fixtures | `@red-hat-developer-hub/e2e-test-utils/test` | `test`, `expect`, fixtures |
| Playwright config | `@red-hat-developer-hub/e2e-test-utils/playwright-config` | `defineConfig`, `baseConfig` |
| RHDH deployment | `@red-hat-developer-hub/e2e-test-utils/rhdh` | `RHDHDeployment` |
| Keycloak | `@red-hat-developer-hub/e2e-test-utils/keycloak` | `KeycloakHelper` |
| Helpers | `@red-hat-developer-hub/e2e-test-utils/helpers` | `UIhelper`, `LoginHelper`, etc. |
| Page objects | `@red-hat-developer-hub/e2e-test-utils/pages` | `CatalogPage`, `HomePage`, etc. |
| Utilities | `@red-hat-developer-hub/e2e-test-utils/utils` | `$`, `KubernetesClientHelper`, `WorkspacePaths`, etc. |
| Teardown | `@red-hat-developer-hub/e2e-test-utils/teardown` | `registerTeardownNamespace` |
| Orchestrator | `@red-hat-developer-hub/e2e-test-utils/orchestrator` | `installOrchestrator` |
| ESLint | `@red-hat-developer-hub/e2e-test-utils/eslint` | `createEslintConfig` |
| TypeScript | `@red-hat-developer-hub/e2e-test-utils/tsconfig` | Base TSConfig (JSON) |
