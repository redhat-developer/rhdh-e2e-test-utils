# Disabling Conflicting Wrappers

Some plugins are included as wrappers in RHDH and are enabled by default.

When the plugin metadata is injected from overlays for such plugin, it will lead to duplicate plugin configuration.

For example, if the `dynamic-plugins.default.yaml` file contains a wrapper config like this:
```yaml
  - package: ./dynamic-plugins/dist/red-hat-developer-hub-backstage-plugin-adoption-insights
    disabled: false
    ...
```

The plugin metadata injection might generate a plugin entry such as:
```yaml
  - package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/red-hat-developer-hub-backstage-plugin-adoption-insights:pr_1967__0.6.2!red-hat-developer-hub-backstage-plugin-adoption-insights
  disabled: false
  ...
```

Both entries configure the same plugin, but since the sources are different, one does not override the other, leading to conflicts and initContainer failure. For the deployment to run successfully using the latest oci image, the wrapper must be explicitly disabled.

## Configuring Wrappers to Disable

The `disableWrappers` option can be used to disable wrapper plugins:

```typescript
await rhdh.configure({
    auth: "keycloak",
    disableWrappers: ['wrapper-plugin-1', 'wrapper-plugin-2', etc],
  });
await rhdh.deploy();
```

Wrapper plugin packages are defined as `./dynamic-plugins/dist/$plugin-name`. Use the `$plugin-name` in `disableWrappers` list.
Make sure that the plugin name matches the dynamic plugins default config.

Note that this option is ignored outside of PR checks, since there is no metadata injection enabled in such case.