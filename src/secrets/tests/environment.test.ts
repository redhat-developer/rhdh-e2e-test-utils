/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect -- node:test fixtures model process environment keys */

import assert from "node:assert/strict";
import test from "node:test";
import {
  materializeEnvironmentWithSecrets,
  materializeEnvironment,
  materializeStreamEnvironment,
  type EnvironmentSecret,
} from "../environment.js";
import type { ExpandedSecretSelector } from "../config.js";
import {
  SECRET_STREAM_ENVIRONMENT_VARIABLE,
  SECRET_STREAM_FD,
} from "../stream.js";

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
  assert.deepEqual(parent, {
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
  });
});

test("returns sorted mapped secret entries", () => {
  const identitySelector: ExpandedSecretSelector = {
    ...selector,
    destination: {
      ...selector.destination,
      requirePrefix: undefined,
      keyTransform: "identity",
    },
  };

  const result = materializeEnvironmentWithSecrets(
    [
      {
        id: "zeta-id",
        name: "global/ZETA",
        value: "zeta-value",
        selector: identitySelector,
      },
      {
        id: "alpha-id",
        name: "global/ALPHA",
        value: "alpha-value",
        selector: identitySelector,
      },
    ],
    [identitySelector],
    {},
  );

  assert.deepEqual(result.secrets, [
    { name: "ALPHA", value: "alpha-value" },
    { name: "ZETA", value: "zeta-value" },
  ]);
});

test("does not retain an inherited stream marker outside stream mode", () => {
  const secrets: EnvironmentSecret[] = [
    {
      id: "token-id",
      name: "global/VAULT_TOKEN",
      value: "synthetic-value",
      selector,
    },
  ];

  assert.deepEqual(
    materializeEnvironment(secrets, [selector], {
      PATH: "/bin",
      RHDH_E2E_SECRET_FD: "inherited-fd",
    }),
    {
      PATH: "/bin",
      VAULT_TOKEN: "synthetic-value",
    },
  );
});

test("removes selected names from a stream child environment", () => {
  const parent = {
    PATH: "/bin",
    VAULT_TOKEN: "inherited-value",
    RHDH_E2E_SECRET_FD: "stale-fd",
  };
  const materialized = materializeEnvironmentWithSecrets(
    [
      {
        id: "token-id",
        name: "global/VAULT_TOKEN",
        value: "stream-value",
        selector,
      },
    ],
    [selector],
    parent,
  );

  const streamEnvironment = materializeStreamEnvironment(materialized);

  assert.equal(streamEnvironment.VAULT_TOKEN, undefined);
  assert.equal(
    streamEnvironment[SECRET_STREAM_ENVIRONMENT_VARIABLE],
    String(SECRET_STREAM_FD),
  );
  assert.equal(streamEnvironment.PATH, "/bin");
  assert.equal(parent.VAULT_TOKEN, "inherited-value");
  assert.equal(parent.RHDH_E2E_SECRET_FD, "stale-fd");
});

test("does not mutate the parent process environment", () => {
  const parent = {
    RHDH_E2E_SECRET_FD: "stale-fd",
    VAULT_TOKEN: "old-value",
  };

  const materialized = materializeEnvironmentWithSecrets(
    [
      {
        id: "token-id",
        name: "global/VAULT_TOKEN",
        value: "new-value",
        selector,
      },
    ],
    [selector],
    parent,
  );
  materializeStreamEnvironment(materialized);

  assert.deepEqual(parent, {
    RHDH_E2E_SECRET_FD: "stale-fd",
    VAULT_TOKEN: "old-value",
  });
});

test("reserves RHDH_E2E_SECRET_FD", () => {
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
      materializeEnvironmentWithSecrets(
        [
          {
            id: "reserved-fd-id",
            name: "global/RHDH_E2E_SECRET_FD",
            value: "synthetic",
            selector: identitySelector,
          },
        ],
        [identitySelector],
        {},
      ),
    /reserved environment variable name.*RHDH_E2E_SECRET_FD/i,
  );
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
    () => materializeEnvironmentWithSecrets(secrets, [selector], {}),
    /environment variable collision.*VAULT_A_B/i,
  );
});

test("rejects selected Bitwarden provider variables", () => {
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
      materializeEnvironmentWithSecrets(
        [
          {
            id: "provider-id",
            name: "global/BW_SESSION",
            value: "synthetic",
            selector: identitySelector,
          },
        ],
        [identitySelector],
        {},
      ),
    /Bitwarden provider environment variable.*BW_SESSION/i,
  );
});

test("materializes prototype-named environment variables as own properties", () => {
  const identitySelector: ExpandedSecretSelector = {
    ...selector,
    destination: {
      ...selector.destination,
      requirePrefix: undefined,
      keyTransform: "identity",
    },
  };

  const child = materializeEnvironment(
    [
      {
        id: "prototype-id",
        name: "global/__proto__",
        value: "synthetic",
        selector: identitySelector,
      },
    ],
    [identitySelector],
    {},
  );

  assert.equal(Object.hasOwn(child, "__proto__"), true);
  assert.equal(child.__proto__, "synthetic");
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
      materializeEnvironmentWithSecrets(
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
