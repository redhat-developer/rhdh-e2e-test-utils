/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect -- node:test fixtures model process environment keys */

import assert from "node:assert/strict";
import test from "node:test";
import {
  materializeEnvironment,
  type EnvironmentSecret,
} from "./environment.js";
import type { ExpandedSecretSelector } from "./config.js";

const selector: ExpandedSecretSelector = {
  prefix: "global/",
  optional: false,
  destination: {
    kind: "environment",
    stripPrefix: "global/",
    requirePrefix: "VAULT_",
    keyTransform: "legacy-env",
  },
};

test("maps selected notes into a child environment without mutating the parent", () => {
  const parent = {
    PATH: "/usr/bin",
    VAULT_GITHUB_TOKEN: "old-value",
    BW_SESSION: "session-value",
    BW_CLIENTID: "client-id",
    BW_CLIENTSECRET: "client-secret",
    BW_PASSWORD: "password",
    VAULT_TOKEN: "legacy-provider-token",
    VAULT_ADDR: "legacy-provider-address",
    VAULT_BASE_PATH: "legacy-provider-path",
    VAULT: "legacy-provider-setting",
  };
  const secrets: EnvironmentSecret[] = [
    {
      id: "token-id",
      name: "global/VAULT_GITHUB_TOKEN",
      value: "line one\nline two\n",
      selector,
    },
  ];

  const child = materializeEnvironment(secrets, [selector], parent);

  assert.equal(child.VAULT_GITHUB_TOKEN, "line one\nline two\n");
  assert.equal(child.PATH, "/usr/bin");
  assert.equal(child.BW_SESSION, undefined);
  assert.equal(child.BW_CLIENTID, undefined);
  assert.equal(child.BW_CLIENTSECRET, undefined);
  assert.equal(child.BW_PASSWORD, undefined);
  assert.equal(child.VAULT_TOKEN, undefined);
  assert.equal(child.VAULT_ADDR, undefined);
  assert.equal(child.VAULT_BASE_PATH, undefined);
  assert.equal(child.VAULT, undefined);
  assert.equal(parent.VAULT_GITHUB_TOKEN, "old-value");
});

test("filters item names that do not satisfy requirePrefix", () => {
  const secrets: EnvironmentSecret[] = [
    {
      id: "ignored-id",
      name: "global/OTHER_SETTING",
      value: "ignored",
      selector,
    },
  ];

  const child = materializeEnvironment(secrets, [selector], {});
  assert.deepEqual(child, {});
});

test("rejects transformed environment-name collisions", () => {
  const secrets: EnvironmentSecret[] = [
    {
      id: "first-id",
      name: "global/VAULT_A-B",
      value: "first",
      selector,
    },
    {
      id: "second-id",
      name: "global/VAULT_A.B",
      value: "second",
      selector,
    },
  ];

  assert.throws(
    () => materializeEnvironment(secrets, [selector], {}),
    /environment variable collision.*VAULT_A_B/i,
  );
});

test("rejects invalid identity environment names", () => {
  const identitySelector: ExpandedSecretSelector = {
    ...selector,
    destination: {
      ...selector.destination,
      requirePrefix: undefined,
      keyTransform: "identity",
    },
  };

  assert.throws(
    () =>
      materializeEnvironment(
        [
          {
            id: "invalid-id",
            name: "global/NOT-VALID",
            value: "synthetic",
            selector: identitySelector,
          },
        ],
        [identitySelector],
        {},
      ),
    /invalid environment variable name/i,
  );
});

test("rejects secrets that are not covered by their selector", () => {
  const wrongSelector: ExpandedSecretSelector = {
    ...selector,
    prefix: "workspaces/backstage/",
  };
  const secret: EnvironmentSecret = {
    id: "wrong-id",
    name: "global/VAULT_TOKEN",
    value: "synthetic",
    selector: wrongSelector,
  };

  assert.throws(
    () => materializeEnvironment([secret], [selector], {}),
    /does not match selector/i,
  );
});
