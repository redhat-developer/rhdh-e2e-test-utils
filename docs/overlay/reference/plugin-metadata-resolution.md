# Plugin Metadata Resolution

::: tip Overlay Documentation
This page explains how plugin packages are resolved in overlay E2E tests. It is specific to `rhdh-plugin-export-overlays`.
:::

The test framework resolves plugin package references before deploying RHDH. This page explains how the resolution works in each mode, what metadata controls, and the common scenarios you'll encounter.

> **DPDY** refers to `dynamic-plugins.default.yaml` in the catalog index image shipped with RHDH. The list of DPDY packages is defined in [`default.packages.yaml`](https://github.com/redhat-developer/rhdh/blob/main/default.packages.yaml).

## Modes

The system detects the mode from environment variables:

| Mode          | Detection                                                  | Use case            |
| ------------- | ---------------------------------------------------------- | ------------------- |
| **PR check**  | `GIT_PR_NUMBER` is set                                     | CI PR validation    |
| **Nightly**   | `E2E_NIGHTLY_MODE=true` or `JOB_NAME` contains `periodic-` | Daily CI regression |
| **Local dev** | Neither of the above                                       | Development         |

`GIT_PR_NUMBER` always wins — if both it and `E2E_NIGHTLY_MODE` are set, the system runs in PR mode.

## How Resolution Works

Every plugin entry in `dynamic-plugins.yaml` goes through two steps:

### Step 1: Config Injection

Merge `appConfigExamples` from metadata into `pluginConfig`.

- **PR / Local**: metadata config is the base, user `pluginConfig` overrides it (deep merge) for all plugins
- **Nightly**: selective — only plugins NOT in `default.packages.yaml` whose metadata `spec.dynamicArtifact` is an OCI ref get injection. Plugins in `default.packages.yaml` with OCI metadata use `{{inherit}}`, which tells RHDH to resolve both the OCI tag (version) and default config from its built-in DPDY. Wrapper plugins get no injection.
- Disabled locally when `RHDH_SKIP_PLUGIN_METADATA_INJECTION=true` (ignored in CI)

#### Example: Deep Merge Behavior (PR / Local mode)

```yaml
# metadata/backstage-community-plugin-argocd.yaml
spec:
  appConfigExamples:
    - title: Default
      content:
        dynamicPlugins:
          frontend:
            backstage-community.plugin-argocd:
              mountPoints:
                - mountPoint: entity.page.cd/cards
                  importName: ArgoContent
              entityTabs:
                - path: /cd
                  title: CD
```

```yaml
# tests/config/dynamic-plugins.yaml (user override — only changes mountPoints)
plugins:
  - package: oci://ghcr.io/.../backstage-community-plugin-argocd:old!alias
    pluginConfig:
      dynamicPlugins:
        frontend:
          backstage-community.plugin-argocd:
            mountPoints:
              - mountPoint: entity.page.cd/cards
                importName: CustomArgoContent # overrides ArgoContent
```

```yaml
# Result after merge (metadata base + user override)
plugins:
  - package: oci://ghcr.io/.../backstage-community-plugin-argocd:bs_1.49.4__2.4.3!alias
    pluginConfig:
      dynamicPlugins:
        frontend:
          backstage-community.plugin-argocd:
            mountPoints:
              - mountPoint: entity.page.cd/cards
                importName: CustomArgoContent # from user (wins)
            entityTabs:
              - path: /cd
                title: CD # from metadata (preserved)
```

| Scenario                                                    | Result                                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Metadata has config, user has none                          | Metadata config injected as `pluginConfig`                                                                                                   |
| Metadata has config, user has partial override              | Deep merge — user keys win, metadata fills the rest                                                                                          |
| Metadata has config, user overrides same key                | User value wins                                                                                                                              |
| No `appConfigExamples` in metadata                          | No `pluginConfig` injected                                                                                                                   |
| **Nightly — in `default.packages.yaml` + OCI metadata**     | **Skipped** — plugin uses `{{inherit}}`, so RHDH resolves both the OCI tag and default config from its built-in DPDY                         |
| **Nightly — NOT in `default.packages.yaml` + OCI metadata** | **Injected** — metadata `appConfigExamples` merged as base, user `pluginConfig` overrides (these plugins aren't in RHDH's built-in defaults) |
| **Nightly — wrapper**                                       | **Skipped** — user `pluginConfig` preserved as-is                                                                                            |

### Step 2: Package Resolution

Replace the `package` field using metadata as the source of truth.

For each plugin, the resolver checks in order:

```
1. Has metadata?
   No  → keep package unchanged (cross-workspace plugin, npm package, etc.)
   Yes ↓

2. Is GIT_PR_NUMBER set AND this plugin is in the workspace build?
   Yes → replace with PR OCI URL:  oci://ghcr.io/.../plugin:pr_{number}__{version}
   No  ↓

3. Is nightly mode AND plugin is in default.packages.yaml AND metadata spec.dynamicArtifact is OCI?
   Yes → use {{inherit}} tag:  oci://{registry}/plugin:{{inherit}}
         RHDH resolves both the OCI tag (version) and default config from its built-in DPDY.
         Registry: NIGHTLY_DPDY_OCI_REGISTRY_MAP > NIGHTLY_DPDY_OCI_REGISTRY > default registry.access.redhat.com/rhdh
   No  ↓

4. Use metadata's dynamicArtifact as-is
   (OCI ref → OCI ref, wrapper path → wrapper path)
```

Metadata is the source of truth for the package reference, except for plugins in `default.packages.yaml` with OCI metadata in nightly mode — these use `{{inherit}}` so RHDH resolves both the OCI tag and config from its built-in DPDY, testing the exact versions and configuration shipped in the RC.

## Resolution Scenarios

The tables below show what happens to each plugin type in PR check and nightly modes. Local dev behaves the same as PR check (metadata refs + full config injection).

In nightly mode, resolution depends on whether the plugin's npm package name is listed in [`default.packages.yaml`](https://github.com/redhat-developer/rhdh/blob/main/default.packages.yaml) (both `enabled` and `disabled` sections) AND whether its metadata `spec.dynamicArtifact` is an OCI ref. The list is fetched at runtime from the `rhdh` repo using `RELEASE_BRANCH_NAME`.

### PR Check Mode (`GIT_PR_NUMBER` set)

| #   | Scenario                                        | Metadata `dynamicArtifact`                                      | User config `package`                                                | Resolved `package`                                          | Config injection                    |
| --- | ----------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| 1   | Workspace plugin (OCI)                          | `oci://ghcr.io/.../plugin-tekton:bs_1.49.4__3.33.3!alias`       | `oci://ghcr.io/.../plugin-tekton:old_tag!alias`                      | `oci://ghcr.io/.../plugin-tekton:pr_1845__3.33.3!alias`     | Yes (metadata base + user override) |
| 2   | Workspace plugin (wrapper)                      | `./dynamic-plugins/dist/plugin-tech-radar`                      | `./dynamic-plugins/dist/plugin-tech-radar`                           | `oci://ghcr.io/.../plugin-tech-radar:pr_1845__1.13.0!alias` | Yes                                 |
| 3   | Workspace plugin (wrapper, stale OCI in config) | `./dynamic-plugins/dist/plugin-github-org-dynamic`              | `oci://ghcr.io/.../plugin-github-org:bs_1.45.3__0.3.16`              | `oci://ghcr.io/.../plugin-github-org:pr_1845__0.3.20!alias` | Yes                                 |
| 4   | Workspace plugin (OCI, wrapper in config)       | `oci://ghcr.io/.../plugin-tekton:bs_1.49.4__3.33.3!alias`       | `./dynamic-plugins/dist/plugin-tekton`                               | `oci://ghcr.io/.../plugin-tekton:pr_1845__3.33.3!alias`     | Yes                                 |
| 5   | Cross-workspace (local path, no metadata)       | —                                                               | `./dynamic-plugins/dist/plugin-kubernetes-backend-dynamic`           | unchanged                                                   | No (no metadata)                    |
| 6   | Cross-workspace (OCI, no metadata)              | —                                                               | `oci://ghcr.io/.../plugin-dynamic-home-page:bs_1.45.3__1.10.3!alias` | unchanged                                                   | No                                  |
| 7   | npm package (no metadata)                       | —                                                               | `@rhdh/plugin-global-header-test@0.0.2`                              | unchanged                                                   | No                                  |
| 8   | Different registry (quay.io)                    | `oci://quay.io/rhdh/plugin-events@sha256:abc`                   | `oci://ghcr.io/.../plugin-events:old_tag`                            | `oci://ghcr.io/.../plugin-events:pr_1845__0.4.6!alias`      | Yes                                 |
| 9   | Different registry (registry.access.redhat.com) | `oci://registry.access.redhat.com/rhdh/plugin-orch@sha256:f40d` | `oci://ghcr.io/.../plugin-orch:some_tag`                             | `oci://ghcr.io/.../plugin-orch:pr_1845__1.0.0!alias`        | Yes                                 |

### Nightly Mode (`E2E_NIGHTLY_MODE=true`, no `GIT_PR_NUMBER`)

| #   | Scenario                                                     | In DPDY? | Metadata `dynamicArtifact`                                        | User config `package`                                                | Resolved `package`                                                                           | Config injection                                                      |
| --- | ------------------------------------------------------------ | -------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | In `default.packages.yaml`, OCI metadata                     | Yes      | `oci://ghcr.io/.../plugin-tekton:bs_1.49.4__3.33.3!alias`         | `oci://ghcr.io/.../plugin-tekton:old_tag!alias`                      | `oci://registry.access.redhat.com/rhdh/plugin-tekton:{{inherit}}` (default RHEC registry)    | **Skipped** — RHDH resolves both OCI tag and config from DPDY         |
| 2   | DPDY wrapper plugin                                          | Yes      | `./dynamic-plugins/dist/plugin-tech-radar`                        | `./dynamic-plugins/dist/plugin-tech-radar`                           | `./dynamic-plugins/dist/plugin-tech-radar` (from metadata)                                   | **Skipped**                                                           |
| 3   | DPDY wrapper (stale OCI in config)                           | Yes      | `./dynamic-plugins/dist/plugin-github-org-dynamic`                | `oci://ghcr.io/.../plugin-github-org:bs_1.45.3__0.3.16`              | `./dynamic-plugins/dist/plugin-github-org-dynamic` (from metadata)                           | **Skipped**                                                           |
| 4   | NOT in `default.packages.yaml`, OCI metadata                 | No       | `oci://ghcr.io/.../plugin-scorecard:bs_1.49.4__1.0.0!alias`       | `oci://ghcr.io/.../plugin-scorecard:old_tag`                         | `oci://ghcr.io/.../plugin-scorecard:bs_1.49.4__1.0.0!alias` (from metadata)                  | **Yes** — not in RHDH's built-in defaults, needs config from metadata |
| 5   | Non-DPDY wrapper plugin                                      | No       | `./dynamic-plugins/dist/plugin-custom`                            | `./dynamic-plugins/dist/plugin-custom`                               | `./dynamic-plugins/dist/plugin-custom` (from metadata)                                       | **Skipped**                                                           |
| 6   | In `default.packages.yaml`, OCI metadata (wrapper in config) | Yes      | `oci://ghcr.io/.../plugin-tekton:bs_1.49.4__3.33.3!alias`         | `./dynamic-plugins/dist/plugin-tekton`                               | `oci://registry.access.redhat.com/rhdh/plugin-tekton:{{inherit}}`                            | **Skipped** — RHDH resolves both OCI tag and config from DPDY         |
| 7   | Cross-workspace (local path, no metadata)                    | —        | —                                                                 | `./dynamic-plugins/dist/plugin-kubernetes-backend-dynamic`           | unchanged                                                                                    | **Skipped**                                                           |
| 8   | Cross-workspace (OCI, no metadata)                           | —        | —                                                                 | `oci://ghcr.io/.../plugin-dynamic-home-page:bs_1.45.3__1.10.3!alias` | unchanged                                                                                    | **Skipped**                                                           |
| 9   | npm package (no metadata)                                    | —        | —                                                                 | `@rhdh/plugin-global-header-test@0.0.2`                              | unchanged                                                                                    | **Skipped**                                                           |
| 10  | In `default.packages.yaml` (metadata on RHEC)                | Yes      | `oci://registry.access.redhat.com/rhdh/plugin-orch@sha256:f40d`   | `oci://ghcr.io/.../plugin-orch:some_tag`                             | `oci://registry.access.redhat.com/rhdh/plugin-orch:{{inherit}}` (default RHEC)               | **Skipped** — RHDH resolves both OCI tag and config from DPDY         |
| 11  | In `default.packages.yaml` (metadata on ghcr.io)             | Yes      | `oci://ghcr.io/.../plugin-orch:bs_1.49.4__5.7.10!alias`           | `oci://ghcr.io/.../plugin-orch:old`                                  | `oci://registry.access.redhat.com/rhdh/plugin-orch:{{inherit}}` (default RHEC, not metadata) | **Skipped** — RHDH resolves both OCI tag and config from DPDY         |
| 12  | NOT in `default.packages.yaml` (quay.io metadata)            | No       | `oci://quay.io/rhdh/plugin-events@sha256:abc`                     | `oci://ghcr.io/.../plugin-events:old_tag`                            | `oci://quay.io/rhdh/plugin-events@sha256:abc` (from metadata)                                | **Yes** — not in RHDH's built-in defaults                             |
| 13  | NOT in `default.packages.yaml` (RHEC metadata)               | No       | `oci://registry.access.redhat.com/rhdh/plugin-custom@sha256:f40d` | `oci://ghcr.io/.../plugin-custom:some_tag`                           | `oci://registry.access.redhat.com/rhdh/plugin-custom@sha256:f40d` (from metadata)            | **Yes** — not in RHDH's built-in defaults                             |

### Key Takeaways

| Rule                                                            | Explanation                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Metadata always wins**                                        | When metadata exists, `spec.dynamicArtifact` determines the package — the user config's `package` field is overwritten                                                                                                                                                                                     |
| **`default.packages.yaml` + OCI → `{{inherit}}`**               | In nightly, plugins in `default.packages.yaml` with OCI metadata use `{{inherit}}` — RHDH resolves both the OCI tag (version) and default config from its built-in DPDY. No config injection from our side                                                                                                 |
| **Not in `default.packages.yaml` + OCI → full ref + injection** | In nightly, plugins NOT in `default.packages.yaml` with OCI metadata use full metadata refs and get `appConfigExamples` injected — they aren't in RHDH's built-in defaults, so they need config from metadata                                                                                              |
| **Wrappers never get `{{inherit}}`**                            | Wrapper plugins always use the metadata path, regardless of DPDY status                                                                                                                                                                                                                                    |
| **No metadata = passthrough**                                   | Cross-workspace plugins, npm packages, and anything without a metadata match passes through unchanged                                                                                                                                                                                                      |
| **PR mode overrides everything**                                | Even if metadata says wrapper, PR mode builds an OCI URL from `source.json` + `plugins-list.yaml`                                                                                                                                                                                                          |
| **`{{inherit}}` registry is configurable**                      | Default: `registry.access.redhat.com/rhdh`. Override with `NIGHTLY_DPDY_OCI_REGISTRY` (blanket) or `NIGHTLY_DPDY_OCI_REGISTRY_MAP` (per-plugin JSON). The runtime matches by registry prefix, so `{{inherit}}` must use the same registry as the DPDY entry. In PR mode, all PR images come from `ghcr.io` |
| **Row 3 is a common pitfall**                                   | If your config has a stale OCI ref but metadata says wrapper, the resolver uses the wrapper path from metadata. Keep your `dynamic-plugins.yaml` in sync, or better yet, don't create one — let it auto-generate from metadata                                                                             |

### Cross-Workspace Plugins

The resolver only looks at `metadata/` in the **current workspace**. It does not search other workspaces. If your test needs a plugin from another workspace (PR rows 5-6, nightly rows 7-8), there's no metadata match, so the package reference passes through unchanged in all modes.

When using an OCI ref for a cross-workspace plugin, you often need to also **disable the local wrapper** for that plugin (included in `dynamic-plugins.default.yaml`), otherwise both versions load and conflict:

```yaml
plugins:
  # Cross-workspace OCI — passes through as-is
  - package: oci://ghcr.io/.../plugin-dynamic-home-page:bs_1.45.3__1.10.3!alias
    disabled: false

  # Disable the local wrapper to avoid conflicts
  - package: ./dynamic-plugins/dist/plugin-dynamic-home-page
    disabled: true
```

## Auto-Generation (No dynamic-plugins.yaml)

When `tests/config/dynamic-plugins.yaml` doesn't exist, the framework generates the full plugin list from `metadata/*.yaml`:

1. Reads every `*.yaml` in `metadata/`
2. Creates an entry per plugin: `{ package: spec.dynamicArtifact, disabled: false }`
3. Runs the same resolution steps above

This is the recommended approach — most workspaces don't need a `dynamic-plugins.yaml`.

## Common Pitfalls

### Config injection in nightly is selective

In nightly mode, config injection only happens for plugins **NOT in `default.packages.yaml`** whose metadata `spec.dynamicArtifact` is an OCI ref. Plugins in `default.packages.yaml` with OCI metadata use `{{inherit}}`, which tells RHDH to resolve both the OCI tag and default config from its built-in DPDY — so no config injection is needed from our side. Wrapper plugins also get no injection. If your test relies on specific config for a `default.packages.yaml` plugin, provide it explicitly in `app-config-rhdh.yaml` or inline in `pluginConfig`.

### PR mode requires /publish first

PR mode constructs OCI URLs like `pr_1845__3.33.3` but doesn't verify the image exists. You must comment `/publish` on the PR before running tests, otherwise RHDH will fail to pull the image.
