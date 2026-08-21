import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import os from "os";
import path from "path";
import { githubSessionFile, readStoredCookies } from "./common.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gh-session-test-"));

describe("github session file naming", () => {
  it("gives two projects different files for the same user", () => {
    // The bug: one workspace's lanes share a cwd, so they shared one file — one
    // lane could read another's storage state, or read one mid-write.
    const a = githubSessionFile("rhdh-qe", "bulk-import");
    const b = githubSessionFile("rhdh-qe", "bulk-import-app-next");
    assert.notStrictEqual(a, b);
  });

  it("gives two users different files within one project", () => {
    assert.notStrictEqual(
      githubSessionFile("user-a", "ws"),
      githubSessionFile("user-b", "ws"),
    );
  });

  it("is absolute, so it does not follow a later chdir", () => {
    assert.ok(path.isAbsolute(githubSessionFile("rhdh-qe", "ws")));
  });

  it("keeps a project name with a path separator inside one file name", () => {
    // A separator in the project name would otherwise turn into a directory that
    // does not exist, and the write would fail rather than the read.
    const file = githubSessionFile("rhdh-qe", "group/ws");
    assert.strictEqual(path.dirname(file), process.cwd());
  });

  it("falls back to a named scope outside a Playwright context", () => {
    // node:test has no test.info(), which is the same situation as a helper
    // called from globalSetup.
    assert.match(githubSessionFile("rhdh-qe"), /no-project/);
  });
});

describe("reading a stored session", () => {
  it("returns the cookies of a well-formed file", () => {
    const dir = tmp();
    const file = path.join(dir, "s.json");
    fs.writeFileSync(file, JSON.stringify({ cookies: [{ name: "a" }] }));
    assert.deepStrictEqual(readStoredCookies(file), [{ name: "a" }]);
  });

  it("returns undefined rather than throwing on a truncated file", () => {
    // What a concurrent reader saw while storageState() was mid-write. It used to
    // come out of JSON.parse as a test failure that looked like a plugin bug.
    const dir = tmp();
    const file = path.join(dir, "s.json");
    fs.writeFileSync(file, '{"cookies":[{"name"');
    assert.strictEqual(readStoredCookies(file), undefined);
  });

  it("returns undefined for a file that does not exist", () => {
    assert.strictEqual(
      readStoredCookies(path.join(tmp(), "absent.json")),
      undefined,
    );
  });

  it("treats an empty cookie list as no session", () => {
    // Reusing it would send the user through a login the caller thinks it skipped.
    const dir = tmp();
    const file = path.join(dir, "s.json");
    fs.writeFileSync(file, JSON.stringify({ cookies: [] }));
    assert.strictEqual(readStoredCookies(file), undefined);
  });

  it("treats a file with no cookies key as no session", () => {
    const dir = tmp();
    const file = path.join(dir, "s.json");
    fs.writeFileSync(file, JSON.stringify({ origins: [] }));
    assert.strictEqual(readStoredCookies(file), undefined);
  });
});
