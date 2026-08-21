import { describe, it } from "node:test";
import assert from "node:assert";
import { runOnce } from "./run-once.js";

/**
 * Keys are unique per test because the flag directory is keyed on the runner PID
 * and therefore shared by every test in this file.
 */
let n = 0;
const freshKey = (label: string) =>
  `run-once-test-${label}-${process.pid}-${n++}`;

describe("runOnce scope", () => {
  it("runs once across projects by default, which is the historical behaviour", async () => {
    const key = freshKey("default");
    const ran: string[] = [];

    for (const project of ["ws", "ws-app-next"]) {
      await runOnce(
        key,
        () => {
          ran.push(project);
        },
        { project },
      );
    }

    assert.deepStrictEqual(
      ran,
      ["ws"],
      "the second project must reuse the first project's flag",
    );
  });

  it("runs once per project when scope is project", async () => {
    const key = freshKey("scoped");
    const ran: string[] = [];

    for (const project of ["ws", "ws-app-next"]) {
      await runOnce(
        key,
        () => {
          ran.push(project);
        },
        { scope: "project", project },
      );
    }

    // The bug this option exists for: with a run-scoped key the second project
    // skips its own deployment and fails later on a missing element.
    assert.deepStrictEqual(ran, ["ws", "ws-app-next"]);
  });

  it("still de-duplicates within one project when scope is project", async () => {
    const key = freshKey("same-project");
    let calls = 0;

    for (let i = 0; i < 3; i++) {
      await runOnce(
        key,
        () => {
          calls++;
        },
        { scope: "project", project: "ws-app-next" },
      );
    }

    assert.strictEqual(calls, 1);
  });

  it("reports whether it executed", async () => {
    const key = freshKey("return");
    assert.strictEqual(await runOnce(key, () => {}, { project: "ws" }), true);
    assert.strictEqual(await runOnce(key, () => {}, { project: "ws" }), false);
  });

  it("warns when a key with no declared scope is skipped for another project", async () => {
    const key = freshKey("warn");
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (msg: string) => warnings.push(String(msg));
    try {
      await runOnce(key, () => {}, { project: "ws" });
      await runOnce(key, () => {}, { project: "ws-app-next" });
    } finally {
      console.warn = original;
    }

    assert.strictEqual(
      warnings.length,
      1,
      "the cross-project skip must not be silent",
    );
    assert.match(warnings[0], /already run by project "ws"/);
    assert.match(warnings[0], /scope: "project"/);
  });

  it("throws when scope is project but no project can be determined", async () => {
    const key = freshKey("no-project");
    let ran = false;

    // No `project` option, and no Playwright context in a node:test run. Falling
    // back to the bare key would be the shared-key bug again, so it must not.
    await assert.rejects(
      () =>
        runOnce(
          key,
          () => {
            ran = true;
          },
          { scope: "project" },
        ),
      /no Playwright project could be determined/,
    );
    assert.strictEqual(ran, false, "the callback must not have run");
  });

  it("leaves an explicitly chosen run scope alone", async () => {
    const key = freshKey("explicit-run");
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (msg: string) => warnings.push(String(msg));
    try {
      // Sharing one key across projects is a real intent — an operator installed
      // once into a namespace they all use. Saying so must silence the advice.
      await runOnce(key, () => {}, { scope: "run", project: "ws" });
      await runOnce(key, () => {}, { scope: "run", project: "ws-app-next" });
    } finally {
      console.warn = original;
    }

    assert.deepStrictEqual(warnings, []);
  });

  it("does not warn when the same project skips its own key", async () => {
    const key = freshKey("no-warn");
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (msg: string) => warnings.push(String(msg));
    try {
      await runOnce(key, () => {}, { project: "ws" });
      await runOnce(key, () => {}, { project: "ws" });
    } finally {
      console.warn = original;
    }

    assert.deepStrictEqual(warnings, []);
  });
});
