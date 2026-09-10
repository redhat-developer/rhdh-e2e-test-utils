/* eslint-disable @typescript-eslint/naming-convention, playwright/expect-expect, playwright/no-conditional-in-test -- node:test fixtures model CLI and environment keys */

import assert from "node:assert/strict";
import test from "node:test";
import { BitwardenClient, type BitwardenCommandRunner } from "../bitwarden.js";
import type { ExpandedSecretSelector } from "../config.js";

const selectors: ExpandedSecretSelector[] = [
  {
    prefix: "global/",
    optional: false,
    destination: {
      kind: "environment",
      stripPrefix: "global/",
      requirePrefix: "VAULT_",
      keyTransform: "legacy-env",
    },
  },
  {
    prefix: "workspaces/backstage/",
    optional: true,
    destination: {
      kind: "environment",
      stripPrefix: "workspaces/backstage/",
      requirePrefix: "VAULT_",
      keyTransform: "legacy-env",
    },
  },
];

function result(stdout = "", status = 0) {
  return { status, stdout, stderr: status === 0 ? "" : "synthetic failure" };
}

test("requires an unlocked BW_SESSION before any Bitwarden command", async () => {
  let called = false;
  const runner: BitwardenCommandRunner = async () => {
    called = true;
    return result();
  };

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { PATH: "/bin" },
        runner,
      }).read("rhdh-plugin-export-overlays", selectors),
    /BW_SESSION.*unlocked/i,
  );
  assert.equal(called, false);
});

test("rejects the denied AWS collection before any Bitwarden command", async () => {
  let called = false;
  const runner: BitwardenCommandRunner = async () => {
    called = true;
    return result();
  };

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-aws-credentials" as never, [selectors[0]!]),
    /rhdh-aws-credentials.*Bitwarden/i,
  );
  assert.equal(called, false);
});

test("syncs and reads only exact-prefix items from the selected collection", async () => {
  const calls: Array<{ args: readonly string[]; env?: NodeJS.ProcessEnv }> = [];
  const runner: BitwardenCommandRunner = async (_command, args, options) => {
    calls.push({ args, env: options?.env });
    if (args[0] === "--version") return result("2026.5.0\n");
    if (args[0] === "status")
      return result(JSON.stringify({ status: "unlocked" }));
    if (args[0] === "sync") return result();
    if (args[0] === "list" && args[1] === "collections") {
      return result(
        JSON.stringify([
          {
            id: "other-collection",
            name: "Other",
            organizationId: "other-org",
          },
          {
            id: "collection-id",
            name: "Rhdh Plugin Export Overlays Ci Secrets",
            organizationId: "org-id",
          },
        ]),
      );
    }
    if (args[0] === "list" && args[1] === "items") {
      assert.deepEqual(args.slice(0, 4), [
        "list",
        "items",
        "--collectionid",
        "collection-id",
      ]);
      return result(
        JSON.stringify(
          args.at(-1) === "global/"
            ? [{ id: "global-id" }, { id: "false-positive" }]
            : [{ id: "workspace-id" }],
        ),
      );
    }
    if (args[0] === "get" && args[1] === "item" && args[2] === "global-id") {
      return result(
        JSON.stringify({
          id: "global-id",
          name: "global/VAULT_GITHUB_TOKEN",
          notes: "synthetic-token",
          type: 2,
          collectionIds: ["collection-id"],
          organizationId: "org-id",
        }),
      );
    }
    if (
      args[0] === "get" &&
      args[1] === "item" &&
      args[2] === "false-positive"
    ) {
      return result(
        JSON.stringify({
          id: "false-positive",
          name: "global-other/VAULT_NOT_SELECTED",
          notes: "not-selected",
          type: 2,
          collectionIds: ["collection-id"],
          organizationId: "org-id",
        }),
      );
    }
    if (args[0] === "get" && args[1] === "item" && args[2] === "workspace-id") {
      return result(
        JSON.stringify({
          id: "workspace-id",
          name: "workspaces/backstage/VAULT_GH_USER_ID",
          notes: "synthetic-user",
          type: 2,
          collectionIds: ["collection-id"],
          organizationId: "org-id",
        }),
      );
    }
    throw new Error(`Unexpected command: ${args.join(" ")}`);
  };

  const secrets = await new BitwardenClient({
    env: { BW_SESSION: "synthetic-session", PATH: "/bin" },
    runner,
  }).read("rhdh-plugin-export-overlays", selectors);

  assert.deepEqual(secrets, [
    {
      id: "global-id",
      name: "global/VAULT_GITHUB_TOKEN",
      value: "synthetic-token",
      selector: selectors[0],
    },
    {
      id: "workspace-id",
      name: "workspaces/backstage/VAULT_GH_USER_ID",
      value: "synthetic-user",
      selector: selectors[1],
    },
  ]);
  assert.equal(calls[0]?.args[0], "--version");
  assert.equal(
    calls.every((call) => call.env?.BW_SESSION === "synthetic-session"),
    true,
  );
});

test("rejects duplicate exact item names before returning secrets", async () => {
  const runner: BitwardenCommandRunner = async (_command, args) => {
    if (args[0] === "--version") return result("2026.5.0");
    if (args[0] === "status")
      return result(JSON.stringify({ status: "unlocked" }));
    if (args[0] === "sync") return result();
    if (args[1] === "collections") {
      return result(
        JSON.stringify([
          {
            id: "collection-id",
            name: "Rhdh Qe Ci Secrets",
            organizationId: "org-id",
          },
        ]),
      );
    }
    if (args[1] === "items") {
      return result(JSON.stringify([{ id: "one" }, { id: "two" }]));
    }
    return result(
      JSON.stringify({
        id: args[2],
        name: "global/VAULT_DUPLICATE",
        notes: "synthetic",
        type: 2,
        collectionIds: ["collection-id"],
        organizationId: "org-id",
      }),
    );
  };

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-qe", [selectors[0]!]),
    /duplicate.*item name/i,
  );
});

test("rejects non-note items and items assigned to multiple collections", async () => {
  const runner: BitwardenCommandRunner = async (_command, args) => {
    if (args[0] === "--version") return result("2026.5.0");
    if (args[0] === "status")
      return result(JSON.stringify({ status: "unlocked" }));
    if (args[0] === "sync") return result();
    if (args[1] === "collections") {
      return result(
        JSON.stringify([
          {
            id: "collection-id",
            name: "Rhdh Qe Ci Secrets",
            organizationId: "org-id",
          },
        ]),
      );
    }
    if (args[1] === "items") return result(JSON.stringify([{ id: "item-id" }]));
    return result(
      JSON.stringify({
        id: "item-id",
        name: "global/VAULT_TOKEN",
        notes: "synthetic",
        type: 1,
        collectionIds: ["collection-id", "other-id"],
        organizationId: "org-id",
      }),
    );
  };

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-qe", [selectors[0]!]),
    /secure note.*selected collection/i,
  );
});

test("fails required selectors and permits empty optional selectors", async () => {
  const runner: BitwardenCommandRunner = async (_command, args) => {
    if (args[0] === "--version") return result("2026.5.0");
    if (args[0] === "status")
      return result(JSON.stringify({ status: "unlocked" }));
    if (args[0] === "sync") return result();
    if (args[1] === "collections") {
      return result(
        JSON.stringify([
          {
            id: "collection-id",
            name: "Rhdh Qe Ci Secrets",
            organizationId: "org-id",
          },
        ]),
      );
    }
    return result("[]");
  };

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-qe", [selectors[0]!]),
    /required prefix.*global\//i,
  );

  const secrets = await new BitwardenClient({
    env: { BW_SESSION: "synthetic-session" },
    runner,
  }).read("rhdh-qe", [selectors[1]!]);
  assert.deepEqual(secrets, []);
});

function attachmentSelector(): ExpandedSecretSelector {
  return selectors[0]!;
}

function attachmentRunner(
  item: Record<string, unknown>,
  attachmentResult = result("synthetic-attachment"),
  calls: Array<readonly string[]> = [],
): BitwardenCommandRunner {
  return async (_command, args) => {
    calls.push(args);
    if (args[0] === "--version") return result("2026.5.0\n");
    if (args[0] === "status")
      return result(JSON.stringify({ status: "unlocked" }));
    if (args[0] === "sync") return result();
    if (args[0] === "list" && args[1] === "collections") {
      return result(
        JSON.stringify([
          {
            id: "collection-id",
            name: "Rhdh Qe Ci Secrets",
            organizationId: "org-id",
          },
        ]),
      );
    }
    if (args[0] === "list" && args[1] === "items") {
      return result(JSON.stringify([{ id: item.id }]));
    }
    if (args[0] === "get" && args[1] === "item") {
      return result(JSON.stringify(item));
    }
    if (args[0] === "get" && args[1] === "attachment") {
      return attachmentResult;
    }
    throw new Error(`Unexpected command: ${args.join(" ")}`);
  };
}

test("reads one attachment through the raw Bitwarden command", async () => {
  const calls: Array<readonly string[]> = [];
  const runner = attachmentRunner(
    {
      id: "item-id",
      name: "global/VAULT_CERT_PEM",
      notes: null,
      type: 2,
      collectionIds: ["collection-id"],
      organizationId: "org-id",
      attachments: [{ id: "attachment-id", fileName: "VAULT_CERT_PEM" }],
    },
    result("synthetic-attachment"),
    calls,
  );

  const [secret] = await new BitwardenClient({
    env: { BW_SESSION: "synthetic-session" },
    runner,
  }).read("rhdh-qe", [attachmentSelector()]);

  assert.equal(secret?.value, "synthetic-attachment");
  assert.deepEqual(calls.at(-1), [
    "get",
    "attachment",
    "VAULT_CERT_PEM",
    "--itemid",
    "item-id",
    "--raw",
  ]);
});

test("preserves multiline attachment contents", async () => {
  const contents =
    "-----BEGIN CERTIFICATE-----\nline\n-----END CERTIFICATE-----\n";
  const runner = attachmentRunner(
    {
      id: "item-id",
      name: "global/VAULT_CERT_PEM",
      notes: "",
      type: 2,
      collectionIds: ["collection-id"],
      organizationId: "org-id",
      attachments: [{ id: "attachment-id", fileName: "VAULT_CERT_PEM" }],
    },
    result(contents),
  );

  const [secret] = await new BitwardenClient({
    env: { BW_SESSION: "synthetic-session" },
    runner,
  }).read("rhdh-qe", [attachmentSelector()]);

  assert.equal(secret?.value, contents);
});

test("rejects items with multiple attachments", async () => {
  const runner = attachmentRunner({
    id: "item-id",
    name: "global/VAULT_CERT_PEM",
    notes: null,
    type: 2,
    collectionIds: ["collection-id"],
    organizationId: "org-id",
    attachments: [
      { id: "attachment-id", fileName: "VAULT_CERT_PEM" },
      { id: "other-attachment-id", fileName: "other" },
    ],
  });

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-qe", [attachmentSelector()]),
    /exactly one attachment/i,
  );
});

test("rejects invalid attachment metadata", async () => {
  const runner = attachmentRunner({
    id: "item-id",
    name: "global/VAULT_CERT_PEM",
    notes: null,
    type: 2,
    collectionIds: ["collection-id"],
    organizationId: "org-id",
    attachments: [{ id: "attachment-id" }],
  });

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-qe", [attachmentSelector()]),
    /invalid attachment metadata/i,
  );
});

test("rejects an attachment filename that does not match the sanitized item basename", async () => {
  const runner = attachmentRunner({
    id: "item-id",
    name: "global/VAULT_CERT key",
    notes: null,
    type: 2,
    collectionIds: ["collection-id"],
    organizationId: "org-id",
    attachments: [{ id: "attachment-id", fileName: "VAULT_CERT-key" }],
  });

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-qe", [attachmentSelector()]),
    /attachment filename.*basename/i,
  );
});

test("rejects a non-empty note combined with an attachment", async () => {
  const runner = attachmentRunner({
    id: "item-id",
    name: "global/VAULT_CERT_PEM",
    notes: "synthetic-note",
    type: 2,
    collectionIds: ["collection-id"],
    organizationId: "org-id",
    attachments: [{ id: "attachment-id", fileName: "VAULT_CERT_PEM" }],
  });

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-qe", [attachmentSelector()]),
    /notes.*attachment/i,
  );
});

test("rejects non-string note metadata on attachment-backed items", async () => {
  const runner = attachmentRunner({
    id: "item-id",
    name: "global/VAULT_CERT_PEM",
    notes: 42,
    type: 2,
    collectionIds: ["collection-id"],
    organizationId: "org-id",
    attachments: [{ id: "attachment-id", fileName: "VAULT_CERT_PEM" }],
  });

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-qe", [attachmentSelector()]),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.equal(
        error.message,
        "Bitwarden item notes must be null or empty when an attachment is present for global/",
      );
      assert.doesNotMatch(error.message, /synthetic-attachment/);
      return true;
    },
  );
});

test("does not expose attachment command output when the command fails", async () => {
  const attachmentPayload = "synthetic-private-attachment";
  const runner = attachmentRunner(
    {
      id: "item-id",
      name: "global/VAULT_CERT_PEM",
      notes: null,
      type: 2,
      collectionIds: ["collection-id"],
      organizationId: "org-id",
      attachments: [{ id: "attachment-id", fileName: "VAULT_CERT_PEM" }],
    },
    { status: 1, stdout: attachmentPayload, stderr: attachmentPayload },
  );

  await assert.rejects(
    () =>
      new BitwardenClient({
        env: { BW_SESSION: "synthetic-session" },
        runner,
      }).read("rhdh-qe", [attachmentSelector()]),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /attachment read failed/i);
      assert.doesNotMatch(error.message, /synthetic-private-attachment/);
      return true;
    },
  );
});
