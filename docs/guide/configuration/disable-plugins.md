# Disabling Default Plugins

Some plugins are included in RHDH's default plugins list (DPDY) and are enabled by default.

When the plugin metadata is injected from overlays for such a plugin, it will lead to duplicate plugin configuration.

For example, older RHDH releases may list a wrapper like this in `dynamic-plugins.default.yaml`:
```yaml
  - package: ./dynamic-plugins/dist/red-hat-developer-hub-backstage-plugin-adoption-insights
    disabled: false
    ...
```

RHDH 1.11+ often uses an OCI DPDY entry instead:
```yaml
  - package: oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-adoption-insights:{{inherit}}
    disabled: false
    ...
```

Plugin metadata injection might generate a PR OCI entry such as:
```yaml
  - package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-adoption-insights:pr_1967__0.6.2!red-hat-developer-hub-backstage-plugin-adoption-insights
  disabled: false
  ...
```

Both entries configure the same plugin, but since the sources are different, one does not override the other, leading to conflicts (for example duplicate `mountPoints`) and initContainer failure. For the deployment to run successfully using the latest OCI image, the default entry must be explicitly disabled.

## Configuring Plugins to Disable

The `disablePlugins` option disables default plugins by name:

```typescript
await rhdh.configure({
  auth: "keycloak",
  disablePlugins: [
    "red-hat-developer-hub-backstage-plugin-global-header",
    "./dynamic-plugins/dist/backstage-plugin-kubernetes-dynamic",
    "oci://registry.access.redhat.com/rhdh/backstage-community-plugin-tekton:{{inherit}}",
  ],
});
await rhdh.deploy();
```

Accepted forms (all normalized to the same display name):
- bare display name: `backstage-plugin-kubernetes`
- local wrapper path: `./dynamic-plugins/dist/backstage-plugin-kubernetes-dynamic`
- OCI ref: `oci://registry.access.redhat.com/rhdh/...:{{inherit}}`

For each unique name, `disablePlugins` emits **both**:
- `./dynamic-plugins/dist/$plugin-name` with `disabled: true` (wrapper-based DPDY)
- `oci://registry.access.redhat.com/rhdh/$plugin-name:{{inherit}}` with `disabled: true` (OCI-based DPDY on RHDH 1.11+)

Override the OCI registry with `NIGHTLY_DPDY_OCI_REGISTRY` when needed.

Note that this option is ignored outside of PR checks (`GIT_PR_NUMBER`), since there is no metadata injection enabled in such case.