# Secrets API

The `@red-hat-developer-hub/e2e-test-utils/secrets` export provides provider
access and child-process execution for local tests. It does not run from
Playwright global setup.

The same package exposes the standalone `rhdh-e2e-secrets` executable for
paired Bitwarden and Google Secret Manager (GSM) operations. Mutations update
Bitwarden first and then delegate the GSM operation to OpenShift CI's
`secret-manager.sh` wrapper.

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

## Mutations

Mutation commands apply by default. Add `--dry-run` to validate both providers,
read the input, and print the value-free plan without writing either provider.

`--from-file` creates or updates an attachment-backed Bitwarden item;
`--from-stdin` creates or updates a note-backed item. Use exactly one input
source. `--allow-empty` is required for an empty value.

### Create

```bash
rhdh-e2e-secrets create \
  --collection rhdh-qe \
  rhdh/test \
  --from-file ./replacement.txt
```

Create requires the path to be absent from both providers. `--force` reconciles
an existing or partially-created target: missing entries are created and
existing entries are updated. GSM's native create command prompts for its
non-secret metadata.

```bash
cat ./replacement.txt | rhdh-e2e-secrets create \
  --collection rhdh-qe \
  rhdh/test \
  --from-stdin \
  --force \
  --dry-run
```

### Update

```bash
rhdh-e2e-secrets update \
  --collection rhdh-qe \
  rhdh/test \
  --from-stdin
```

Update requires the target to exist in both providers and preserves the
Bitwarden item's current storage form.

### Delete

```bash
rhdh-e2e-secrets delete \
  --collection rhdh-qe \
  rhdh/test
```

Delete requires both providers to contain the target. Bitwarden items are
moved to Trash, while GSM deletes the secret. `--force` deletes whichever
provider entries exist and skips entries that are already absent.

If a provider operation fails after the other provider was changed, retry the
same command. Use `--force` for `create` or `delete` when the first attempt
created or removed only one side. There is no resume journal or stored secret
value.

## GSM Read Commands

`describe` shows GSM metadata without reading Bitwarden or exposing the secret
value:

```bash
rhdh-e2e-secrets describe --collection rhdh-qe rhdh/test --output json
```

`list` shows the supported paired collections, or GSM paths within one paired
collection:

```bash
rhdh-e2e-secrets list
rhdh-e2e-secrets list --collection rhdh-qe --output json
```

Both commands support `--output text|json` and do not require `BW_SESSION`.

## GSM Authentication

Before GSM operations, authenticate through the cached OpenShift CI wrapper:

```bash
rhdh-e2e-secrets gsm-login
rhdh-e2e-secrets gsm-clean
```

The wrapper is refreshed from the OpenShift `release` repository's `main`
branch, with a validated local cache used when refresh is unavailable. GSM
values are always passed with `--from-file`; the CLI never uses
`--from-literal`.

## Public Functions

```typescript
parseProfile(value: unknown): SecretProfile
expandProfile(profile: SecretProfile, workspaces?: readonly string[]): ExpandedSecretProfile
getCollectionMapping(collection: string): CollectionMapping
new BitwardenClient(options?: BitwardenClientOptions)
executeCommand(options: ExecuteCommandOptions): Promise<number>
materializeEnvironment(secrets, selectors, parent?): NodeJS.ProcessEnv
readSecretInput(options): Promise<SecretInput>
executeMutation(options): Promise<MutationResult>
new GsmClient(options?: GsmClientOptions)
```

Profiles contain collection and prefix selectors but never secret values. Only
the approved paired collections are accepted; `rhdh-aws-credentials` is
explicitly denied for Bitwarden operations.

## Related Pages

- [Global Setup](/guide/core-concepts/global-setup) - Provider-neutral Playwright setup
- [Package Exports](/guide/core-concepts/package-exports) - All package entry points
