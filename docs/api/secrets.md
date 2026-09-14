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

Callers that need to discover which secret variables were selected can opt in
to name-only metadata:

```bash
rhdh-e2e-secrets exec \
  --profile e2e-secrets.profile.json \
  --expose-secret-names \
  -- yarn playwright test
```

The `bw` executable must be installed locally and available on `PATH`. The
tool does not log in, unlock, lock, or persist the Bitwarden session.

## CLI Help and Options

Root and subcommand help are provider-free and support both `-h` and
`--help`:

```bash
rhdh-e2e-secrets --help
rhdh-e2e-secrets create --help
rhdh-e2e-secrets update -h
```

Supported option pairs are:

- `-c`, `--collection` - paired secret collection
- `-f`, `--from-file` - read an attachment-backed value from a file
- `-i`, `--from-stdin` - read a note-backed value from stdin
- `-o`, `--output` - `text` or `json`, case-insensitive
- `-p`, `--profile` - `exec` profile JSON file
- `-w`, `--workspace` - repeatable `exec` workspace selector
- `--expose-secret-names` - add selected variable names to the child environment

The CLI intentionally does not support GSM's `-l/--from-literal`, because
secret values should not be exposed in process arguments. Local-only controls
such as `--allow-empty`, `--force`, and `--dry-run` remain long-only.

Mutation commands accept `--gsm-timeout-seconds`; it must be between `1` and
`2147483`, matching Node.js's maximum timer delay. The effective maximum is
`2147483000` milliseconds.

`--from-stdin` requires piped input and exits immediately when stdin is an
interactive terminal. For `create`, the secret is read from the pipe first and
GSM's metadata prompts are then read from the controlling terminal, so run it
from an interactive shell even when the value is piped.

For `exec`, arguments after `--` belong to the child command. For example,
`rhdh-e2e-secrets exec -p profile.json -- node --help` forwards `--help` to
Node instead of displaying this CLI's help.

With `--expose-secret-names`, the child receives
`RHDH_E2E_SECRET_NAMES` as a deterministically sorted JSON array. The array is
generated from the same filtered, transformed, and validated secret set as the
child environment. It contains names only, never values or Bitwarden provider
credentials. The variable is not added when the flag is absent, and the CLI
does not print its contents.

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

Note-backed updates validate the item returned by Bitwarden's edit operation.
Attachment updates and storage conversions perform an additional sync/read
verification because the attachment is a separate provider object.

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
JSON output is limited to `create-time`, `jira-project`,
`rotation-instructions`, and `request-information`. A path containing a dot
uses GSM's `--dot--` encoding, for example
`rhdh/certificate--dot--pem`.

## GSM Authentication

Before GSM operations, authenticate through the cached OpenShift CI wrapper:

```bash
rhdh-e2e-secrets gsm-login
rhdh-e2e-secrets gsm-clean
```

The CLI maintains its own wrapper and Google ADC cache. Authenticating a
different `secret-manager.sh` copy does not authenticate `rhdh-e2e-secrets`;
run `gsm-login` through this CLI.
`gsm-clean` removes the local Google ADC directory directly, so it does not
need to download or execute the wrapper.

The wrapper is refreshed from the OpenShift `release` repository's `main`
branch, with a validated local cache used when refresh is unavailable. GSM
values are always passed with `--from-file`; the CLI never uses
`--from-literal`.

The wrapper cache defaults to
`$XDG_CACHE_HOME/rhdh-e2e-secrets/gsm` or
`~/.cache/rhdh-e2e-secrets/gsm`. Mutation locks default to
`$XDG_STATE_HOME/rhdh-e2e-secrets` or
`~/.local/state/rhdh-e2e-secrets`. In networks requiring an environment proxy
or an additional CA, start Node with `NODE_USE_ENV_PROXY=1` and/or set
`NODE_EXTRA_CA_CERTS` before invoking the CLI.

## Public Functions

```typescript
parseProfile(value: unknown): SecretProfile
expandProfile(profile: SecretProfile, workspaces?: readonly string[]): ExpandedSecretProfile
getCollectionMapping(collection: string): CollectionMapping
COLLECTIONS: readonly CollectionMapping[]
READABLE_COLLECTIONS: readonly ReadableCollectionId[]
new BitwardenClient(options?: BitwardenClientOptions)
executeCommand(options: ExecuteCommandOptions): Promise<number>
materializeEnvironment(secrets, selectors, parent?): NodeJS.ProcessEnv
readSecretInput(options): Promise<SecretInput>
executeMutation(options): Promise<MutationResult>
new GsmClient(options?: GsmClientOptions)
new GsmWrapper(options?: GsmWrapperOptions)
```

Profiles contain collection and prefix selectors but never secret values. Only
the approved paired collections are accepted; `rhdh-aws-credentials` is
explicitly denied for Bitwarden operations.

`ExecuteCommandOptions.exposeSecretNames` enables the same opt-in metadata for
programmatic callers. It reuses the validated result of the single provider
read performed by `executeCommand()`.

## Related Pages

- [Global Setup](/guide/core-concepts/global-setup) - Provider-neutral Playwright setup
- [Package Exports](/guide/core-concepts/package-exports) - All package entry points
