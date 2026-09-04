# Secrets API

The `@red-hat-developer-hub/e2e-test-utils/secrets` export provides provider
access and child-process execution for local tests. It does not run from
Playwright global setup.

## Local Command

```bash
export BW_SESSION="<session-from-an-unlocked-bw-cli>"
rhdh-e2e-secrets exec \
  --profile e2e-secrets.profile.json \
  --workspace tech-radar \
  -- yarn playwright test
```

The `bw` executable must be installed locally and available on `PATH`. The
tool does not log in, unlock, lock, or persist the Bitwarden session.

## Public Functions

```typescript
parseProfile(value: unknown): SecretProfile
expandProfile(profile: SecretProfile, workspaces?: readonly string[]): ExpandedSecretProfile
getCollectionMapping(collection: string): CollectionMapping
new BitwardenClient(options?: BitwardenClientOptions)
executeCommand(options: ExecuteCommandOptions): Promise<number>
materializeEnvironment(secrets, selectors, parent?): NodeJS.ProcessEnv
```

Profiles contain collection and prefix selectors but never secret values. Only
the approved readable collections are accepted; `rhdh-aws-credentials` is
explicitly denied. Environment destinations preserve legacy `VAULT_*` names
when the profile requests the `legacy-env` transformation.

## Related Pages

- [Global Setup](/guide/core-concepts/global-setup) - Provider-neutral Playwright setup
- [Package Exports](/guide/core-concepts/package-exports) - All package entry points
