import { describe, it } from "node:test";
import assert from "node:assert";
import {
  NFS_SECRET_MARKERS,
  assertNfsMarkersSurvived,
  assertNfsIntentMatches,
  describeNfsIntentConflict,
  describeNfsSource,
  findDroppedNfsMarkers,
} from "./nfs-guard.js";

const [PACKAGE_NAME_KEY] = NFS_SECRET_MARKERS[0];
const [MF_KEY] = NFS_SECRET_MARKERS[1];

/** A merged secret in which both markers survived, plus unrelated workspace data. */
const intact = (): Record<string, unknown> => ({
  ...Object.fromEntries(NFS_SECRET_MARKERS),
  ["SOME_TOKEN"]: "x",
});

describe("nfs secret markers", () => {
  it("finds nothing dropped when both markers survive the merge", () => {
    assert.deepStrictEqual(findDroppedNfsMarkers(intact()), []);
  });

  it("reports a marker the workspace overwrote", () => {
    // tests/config/rhdh-secrets.yaml merges after the NFS defaults, so this is
    // what a workspace setting the key for its own reasons produces.
    const dropped = findDroppedNfsMarkers({
      ...intact(),
      [PACKAGE_NAME_KEY]: "app",
    });
    assert.deepStrictEqual(dropped, [
      { key: PACKAGE_NAME_KEY, expected: "app-next", actual: "app" },
    ]);
  });

  it("reports a marker that is absent, distinctly from one that is wrong", () => {
    const rest = intact();
    delete rest[MF_KEY];
    const dropped = findDroppedNfsMarkers(rest);
    assert.strictEqual(dropped.length, 1);
    assert.strictEqual(dropped[0].actual, undefined);
  });

  it("accepts an unquoted YAML true rather than raising a false alarm", () => {
    // A typing mistake in the workspace's YAML, not a different value — the intent is
    // plainly the same. Comparing without coercing would fail a working lane.
    const dropped = findDroppedNfsMarkers({ ...intact(), [MF_KEY]: true });
    assert.deepStrictEqual(dropped, []);
  });

  it("rewrites a boolean marker to the string the API server requires", () => {
    // stringData goes straight onto the V1Secret body, so a JSON boolean is rejected
    // with "cannot unmarshal bool into Go struct field ... of type string". Tolerating
    // it in the comparison alone would green-light a config that cannot apply.
    const payload = { ...intact(), [MF_KEY]: true };
    assertNfsMarkersSurvived(payload, "ws-app-next");
    assert.strictEqual(payload[MF_KEY], "true");
  });

  it("counts a missing stringData block as both markers dropped", () => {
    assert.strictEqual(findDroppedNfsMarkers(undefined).length, 2);
  });

  it("throws naming the namespace, the key, and where the override comes from", () => {
    assert.throws(
      () =>
        assertNfsMarkersSurvived(
          { ...intact(), [PACKAGE_NAME_KEY]: "app" },
          "bulk-import-app-next",
        ),
      (err: Error) => {
        assert.match(err.message, /bulk-import-app-next/);
        assert.match(err.message, /APP_CONFIG_app_packageName is "app"/);
        assert.match(err.message, /rhdh-secrets\.yaml is merged after/);
        return true;
      },
    );
  });

  it("does not throw when the markers are intact", () => {
    assert.doesNotThrow(() =>
      assertNfsMarkersSurvived(intact(), "ws-app-next"),
    );
  });
});

describe("nfs intent conflict", () => {
  it("flags an -app-next namespace explicitly opted out of NFS", () => {
    const msg = describeNfsIntentConflict("quay-app-next", false);
    assert.match(String(msg), /named -app-next/);
  });

  it("says nothing when the name and the intent agree", () => {
    assert.strictEqual(
      describeNfsIntentConflict("quay-app-next", true),
      undefined,
    );
    assert.strictEqual(describeNfsIntentConflict("quay", false), undefined);
  });

  it("says nothing when no explicit choice was made", () => {
    // The default path resolves to NFS from the name, so there is no conflict.
    assert.strictEqual(
      describeNfsIntentConflict("quay-app-next", undefined),
      undefined,
    );
  });

  it("fails the deploy on the conflict, rather than only naming it", () => {
    // A warning on a run that exits 0 is the failure this module exists to stop:
    // the legacy suite re-runs, everything passes, and nothing proved NFS works.
    assert.throws(
      () => assertNfsIntentMatches("quay-app-next", false),
      /named -app-next/,
    );
  });

  it("lets every non-conflicting combination through", () => {
    assert.doesNotThrow(() => assertNfsIntentMatches("quay-app-next", true));
    assert.doesNotThrow(() =>
      assertNfsIntentMatches("quay-app-next", undefined),
    );
    assert.doesNotThrow(() => assertNfsIntentMatches("quay", false));
    assert.doesNotThrow(() => assertNfsIntentMatches("github", true));
  });

  it("does not flag the reverse, which is legitimate", () => {
    // github and homepage enable NFS through configure() without renaming, and a
    // global USE_NEW_FRONTEND_SYSTEM may turn it on everywhere.
    assert.strictEqual(describeNfsIntentConflict("github", true), undefined);
  });
});

describe("nfs source", () => {
  it("names an explicit choice over the project name", () => {
    assert.match(describeNfsSource("ws-app-next", true), /configure\(/);
  });

  it("names the project name when nothing was passed", () => {
    assert.match(describeNfsSource("ws-app-next", undefined), /-app-next/);
  });

  it("names the environment variable when it is what decided", () => {
    const prev = process.env.USE_NEW_FRONTEND_SYSTEM;
    process.env.USE_NEW_FRONTEND_SYSTEM = "true";
    try {
      assert.match(
        describeNfsSource("ws", undefined),
        /USE_NEW_FRONTEND_SYSTEM/,
      );
    } finally {
      if (prev === undefined) delete process.env.USE_NEW_FRONTEND_SYSTEM;
      else process.env.USE_NEW_FRONTEND_SYSTEM = prev;
    }
  });

  it("says so when nothing enabled it", () => {
    const prev = process.env.USE_NEW_FRONTEND_SYSTEM;
    delete process.env.USE_NEW_FRONTEND_SYSTEM;
    try {
      assert.match(describeNfsSource("ws", undefined), /legacy shell/);
    } finally {
      if (prev !== undefined) process.env.USE_NEW_FRONTEND_SYSTEM = prev;
    }
  });
});
