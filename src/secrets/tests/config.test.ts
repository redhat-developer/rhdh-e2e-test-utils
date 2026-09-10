/* eslint-disable playwright/expect-expect -- this file uses node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
import {
  expandProfile,
  getCollectionMapping,
  parseProfile,
  type SecretProfile,
} from "../config.js";

const overlayProfile: SecretProfile = {
  schemaVersion: 1,
  collection: "rhdh-plugin-export-overlays",
  selectors: [
    {
      prefix: "global/",
      destination: {
        kind: "environment",
        stripPrefix: "global/",
        requirePrefix: "VAULT_",
        keyTransform: "legacy-env",
      },
    },
    {
      prefix: "workspaces/${workspace}/",
      optional: true,
      destination: {
        kind: "environment",
        stripPrefix: "workspaces/${workspace}/",
        requirePrefix: "VAULT_",
        keyTransform: "legacy-env",
      },
    },
  ],
};

test("maps each approved collection to its exact Bitwarden collection name", () => {
  assert.deepEqual(getCollectionMapping("rhdh-qe"), {
    id: "rhdh-qe",
    bitwardenCollection: "Rhdh Qe Ci Secrets",
  });
});

test("rejects the GSM-only AWS collection before Bitwarden access", () => {
  assert.throws(
    () =>
      parseProfile({ ...overlayProfile, collection: "rhdh-aws-credentials" }),
    /rhdh-aws-credentials.*Bitwarden/i,
  );
});

test("expands workspace selectors once for every requested workspace", () => {
  assert.deepEqual(
    expandProfile(overlayProfile, ["backstage", "extensions"]).selectors.map(
      (selector) => selector.prefix,
    ),
    ["global/", "workspaces/backstage/", "workspaces/extensions/"],
  );
});

test("allows an optional workspace selector to have no matching items", () => {
  const expanded = expandProfile(overlayProfile, ["extensions"]);
  assert.equal(expanded.selectors[1]?.optional, true);
});

test("rejects workspace arguments for a profile without a workspace token", () => {
  assert.throws(
    () =>
      expandProfile(
        parseProfile({
          schemaVersion: 1,
          collection: "rhdh-qe",
          selectors: [
            {
              prefix: "rhdh/",
              destination: {
                kind: "environment",
                stripPrefix: "rhdh/",
                keyTransform: "identity",
              },
            },
          ],
        }),
        ["backstage"],
      ),
    /does not accept workspace arguments/,
  );
});

test("rejects invalid workspace names and duplicate transformed selectors", () => {
  assert.throws(
    () => expandProfile(overlayProfile, ["../secrets"]),
    /invalid workspace/i,
  );

  assert.throws(
    () =>
      parseProfile({
        schemaVersion: 1,
        collection: "rhdh-qe",
        selectors: [
          {
            prefix: "rhdh/",
            destination: {
              kind: "environment",
              stripPrefix: "rhdh/",
              keyTransform: "identity",
            },
          },
          {
            prefix: "rhdh/",
            destination: {
              kind: "environment",
              stripPrefix: "rhdh/",
              keyTransform: "identity",
            },
          },
        ],
      }),
    /duplicate selector/i,
  );
});

test("rejects a strip prefix that cannot apply to the selected item prefix", () => {
  assert.throws(
    () =>
      parseProfile({
        schemaVersion: 1,
        collection: "rhdh-qe",
        selectors: [
          {
            prefix: "global/",
            destination: {
              kind: "environment",
              stripPrefix: "workspaces/",
              keyTransform: "identity",
            },
          },
        ],
      }),
    /stripPrefix.*prefix/i,
  );
});

test("rejects duplicate workspace arguments", () => {
  assert.throws(
    () => expandProfile(overlayProfile, ["backstage", "backstage"]),
    /duplicate workspace/i,
  );
});
