/**
 * Guards against a lane that believes it is running the new frontend system
 * while the deployed instance is running the legacy shell.
 *
 * That combination is the worst failure this harness can produce, because it is
 * not a failure: the legacy suite re-runs, every assertion passes, and the only
 * thing the lane exists to prove — that the plugin works under NFS — was never
 * exercised. Nothing errors and nothing is red.
 *
 * The checks here are deliberately cluster-free. They run on the configuration
 * this library is about to apply, which is where the two reachable causes live.
 */

/**
 * The secret entries that actually switch RHDH to the new frontend system.
 *
 * Mirrors `config/new-frontend-system/secrets.yaml`. `APP_CONFIG_app_packageName`
 * selects the `app-next` bundle; `ENABLE_STANDARD_MODULE_FEDERATION` is what stops
 * RHDH overriding the dynamic-features service away from standard module federation.
 *
 * Entries rather than an object because these are external environment-variable
 * names, not JavaScript identifiers — writing them as property names would fight
 * the repo's camelCase rule everywhere they appear.
 */
export const NFS_SECRET_MARKERS: ReadonlyArray<readonly [string, string]> = [
  ["APP_CONFIG_app_packageName", "app-next"],
  ["ENABLE_STANDARD_MODULE_FEDERATION", "true"],
];

export type DroppedMarker = {
  key: string;
  expected: string;
  /** `undefined` when the key is absent rather than overwritten. */
  actual: string | undefined;
};

/**
 * Markers that did not survive the secret merge.
 *
 * The NFS layer is merged *before* the workspace's own `rhdh-secrets.yaml`, so a
 * workspace that sets either key for its own reasons silently wins and the lane
 * boots legacy. That ordering is intentional — a workspace must be able to override
 * defaults — which is exactly why the outcome has to be checked rather than assumed.
 */
export function findDroppedNfsMarkers(
  stringData: Record<string, unknown> | undefined,
): DroppedMarker[] {
  const dropped: DroppedMarker[] = [];
  for (const [key, expected] of NFS_SECRET_MARKERS) {
    const raw = stringData?.[key];
    const actual = raw === undefined ? undefined : String(raw);
    if (actual !== expected) dropped.push({ key, expected, actual });
  }
  return dropped;
}

/**
 * Throws when the applied secret would not turn NFS on after all.
 *
 * @param stringData - the merged `stringData` about to be applied
 * @param namespace - named in the message, because the reader is looking at one
 *   lane's output among many
 */
export function assertNfsMarkersSurvived(
  stringData: Record<string, unknown> | undefined,
  namespace: string,
): void {
  const dropped = findDroppedNfsMarkers(stringData);
  if (dropped.length === 0) return;

  const detail = dropped
    .map(({ key, expected, actual }) =>
      actual === undefined
        ? `  ${key} is missing (expected "${expected}")`
        : `  ${key} is "${actual}" (expected "${expected}")`,
    )
    .join("\n");

  throw new Error(
    `[nfs] "${namespace}" is configured for the new frontend system, but the ` +
      `secret about to be applied would not enable it:\n${detail}\n` +
      `The workspace's own tests/config/rhdh-secrets.yaml is merged after the NFS ` +
      `defaults, so setting either key there overrides them. Remove it, or set it ` +
      `to the value above. Without this the lane boots the legacy shell and passes ` +
      `while proving nothing about NFS.`,
  );
}

/**
 * A stated intent that contradicts the namespace it is deployed into.
 *
 * `-app-next` is one of the three ways a lane says it wants NFS, and it is the one
 * that also names the Kubernetes namespace, so a lane called `<ws>-app-next` running
 * legacy is indistinguishable from a working one in any report. An explicit
 * `useNewFrontendSystem: false` is the only way to reach that state, so it is worth
 * naming rather than honouring silently.
 *
 * Only this direction is checkable. The converse — a lane *not* named `-app-next`
 * that resolves to NFS — is legitimate: `USE_NEW_FRONTEND_SYSTEM=true` may turn it
 * on globally, and `configure({ useNewFrontendSystem: true })` is a supported way
 * to opt in without renaming the project.
 *
 * @returns the message to warn with, or `undefined` when there is no contradiction
 */
export function describeNfsIntentConflict(
  namespace: string,
  explicitChoice: boolean | undefined,
): string | undefined {
  if (explicitChoice !== false) return undefined;
  if (!namespace.endsWith("-app-next")) return undefined;
  return (
    `[nfs] "${namespace}" is named -app-next but was configured with ` +
    `useNewFrontendSystem: false, so it will deploy the legacy shell under a ` +
    `name that reads as an NFS lane. Rename the project or drop the override.`
  );
}

/**
 * Which of the three mechanisms decided this lane's frontend, for the deploy log.
 *
 * There is no single documented way to enable NFS (RHIDP-16461), so a lane's output
 * has to say which one fired — otherwise "is this lane NFS?" is answered by reading
 * three different files.
 */
export function describeNfsSource(
  namespace: string,
  explicitChoice: boolean | undefined,
): string {
  if (explicitChoice !== undefined) {
    return `configure({ useNewFrontendSystem: ${explicitChoice} })`;
  }
  if (namespace.endsWith("-app-next")) return `the -app-next project name`;
  if (process.env.USE_NEW_FRONTEND_SYSTEM === "true") {
    return `USE_NEW_FRONTEND_SYSTEM=true`;
  }
  return `nothing — the default is the legacy shell`;
}
