# Secrets API

The `@red-hat-developer-hub/e2e-test-utils/secrets` export provides provider
access and child-process execution for local tests. It does not run from
Playwright global setup.

The same package exposes the standalone `rhdh-e2e-secrets` executable for
single-secret Bitwarden and Google Secret Manager (GSM) rotation. Rotation
updates Bitwarden first, verifies the new value, and then delegates the GSM
write to OpenShift CI's `secret-manager.sh` wrapper.

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

## Rotation

Dry-run validates the selected Bitwarden secure note, the corresponding GSM
metadata, and the replacement input without writing either provider:

```bash
rhdh-e2e-secrets rotate \
  --collection rhdh-qe \
  --path rhdh/test \
  --from-file ./replacement.txt
```

Use exactly one of `--from-file` and `--from-stdin`. Apply mode requires
`--apply`; `--allow-empty` is required for an empty replacement. The GSM
timeout defaults to 600 seconds and can be changed with
`--gsm-timeout-seconds`.

```bash
cat ./replacement.txt | rhdh-e2e-secrets rotate \
  --collection rhdh-qe \
  --path rhdh/test \
  --from-stdin \
  --apply
```

If Bitwarden succeeds and GSM fails or times out, the output operation ID can
resume the same verified value without requesting it again:

```bash
rhdh-e2e-secrets rotate --resume <rotation-id> --apply
```

The three paired collection names are `rhdh-qe`, `rhdh-test-instance`, and
`rhdh-plugin-export-overlays`. The GSM path is derived from the original
Bitwarden path by replacing `.` with `--dot--`; paths containing the encoding
are rejected as ambiguous. `rhdh-aws-credentials` remains GSM-only.

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
readRotationInput(options): Promise<RotationInput>
executeRotation(options): Promise<RotationResult>
new JournalStore(directory?)
```

Profiles contain collection and prefix selectors but never secret values. Only
the approved readable collections are accepted; `rhdh-aws-credentials` is
explicitly denied. Environment destinations preserve legacy `VAULT_*` names
when the profile requests the `legacy-env` transformation.

## Related Pages

- [Global Setup](/guide/core-concepts/global-setup) - Provider-neutral Playwright setup
- [Package Exports](/guide/core-concepts/package-exports) - All package entry points
