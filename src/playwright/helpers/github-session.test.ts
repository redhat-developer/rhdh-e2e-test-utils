import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  ensureGithubSession,
  githubSessionFile,
  readStoredCookies,
  withGithubSessionLock,
  writeStorageStateAtomically,
} from "./common.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gh-session-test-"));

describe("github session file naming", () => {
  it("gives two users different files, and is stable for one user", () => {
    assert.notStrictEqual(
      githubSessionFile("user-a"),
      githubSessionFile("user-b"),
    );
    assert.strictEqual(
      githubSessionFile("rhdh-qe"),
      githubSessionFile("rhdh-qe"),
    );
  });

  it("is deliberately not keyed by project", () => {
    // Scoping per project was the obvious fix and is the wrong one: logintoGithub
    // derives its 2FA code from one shared TOTP secret, so lanes logging in within the
    // same 30-second window submit the identical code and GitHub rejects the second.
    // Sharing the session is the point; withGithubSessionLock is what makes it safe.
    const file = githubSessionFile("rhdh-qe");
    assert.doesNotMatch(path.basename(file), /app-next|project/);
  });

  it("is absolute, so it does not follow a later chdir", () => {
    assert.ok(path.isAbsolute(githubSessionFile("rhdh-qe")));
  });

  it("keeps a separator in the user id inside one file name", () => {
    // Otherwise it becomes a directory that does not exist and the write fails.
    assert.strictEqual(
      path.dirname(githubSessionFile("org/user")),
      process.cwd(),
    );
  });

  it("does not throw when the vault user id is unset", () => {
    // loginAsGithubUser defaults to `process.env.VAULT_GH_USER_ID as string`, and the
    // cast hides the undefined. Building the path must not be where that surfaces —
    // a TypeError here points nowhere near the missing variable.
    assert.doesNotThrow(() =>
      githubSessionFile(undefined as unknown as string),
    );
  });
});

describe("the session lock", () => {
  it("holds off a second caller until the first is done", async () => {
    const dir = tmp();
    const file = path.join(dir, "s.json");
    const order: string[] = [];
    let held: () => void = () => {};
    const acquired = new Promise<void>((resolve) => {
      held = resolve;
    });

    // The second caller must not start until the first demonstrably holds the lock —
    // racing them from the same tick would test the scheduler, not the lock.
    const first = withGithubSessionLock(file, async () => {
      order.push("first-in");
      held();
      await new Promise((resolve) => setTimeout(resolve, 50));
      order.push("first-out");
    });
    await acquired;
    const second = withGithubSessionLock(file, async () => {
      order.push("second-in");
    });
    await Promise.all([first, second]);

    assert.deepStrictEqual(order, ["first-in", "first-out", "second-in"]);
  });

  it("releases the lock when the body throws", async () => {
    const dir = tmp();
    const file = path.join(dir, "s.json");
    await assert.rejects(
      withGithubSessionLock(file, async () => {
        throw new Error("boom");
      }),
    );
    // A lock held after a failed login would hang every other lane for `stale`.
    await withGithubSessionLock(file, async () => {});
  });
});

describe("writing a stored session", () => {
  /** Enough of a Page for the write path; a real one needs a browser. */
  const fakePage = (write: (file: string) => void) =>
    ({
      context: () => ({
        storageState: async ({ path: target }: { path: string }) =>
          write(target),
      }),
    }) as unknown as Parameters<typeof writeStorageStateAtomically>[0];

  it("leaves only the final file behind", async () => {
    const dir = tmp();
    const file = path.join(dir, "s.json");
    await writeStorageStateAtomically(
      fakePage((target) => fs.writeFileSync(target, '{"cookies":[]}')),
      file,
    );
    assert.deepStrictEqual(fs.readdirSync(dir), ["s.json"]);
  });

  it("removes the temp file when the write fails", async () => {
    // Otherwise a failed run litters the workspace's e2e-tests directory, where
    // nothing gitignores authState*.
    const dir = tmp();
    const file = path.join(dir, "s.json");
    await assert.rejects(
      writeStorageStateAtomically(
        fakePage((target) => {
          fs.writeFileSync(target, "partial");
          throw new Error("browser went away");
        }),
        file,
      ),
    );
    assert.deepStrictEqual(fs.readdirSync(dir), []);
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

describe("ensuring the shared session", () => {
  const writeSession = (file: string) =>
    fs.writeFileSync(file, JSON.stringify({ cookies: [{ name: "a" }] }));

  it("reuses an existing session without taking the lock", async () => {
    // The point of the split: reuse is cookies plus a Sign In against a different
    // namespace host. Holding the lock across it made every lane queue behind one
    // sign-in it did not need. Proven by holding the lock elsewhere — if reuse
    // still waited on it, this would block until the holder released.
    const dir = tmp();
    const file = path.join(dir, "s.json");
    writeSession(file);

    let release: () => void = () => {};
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held: () => void = () => {};
    const acquired = new Promise<void>((resolve) => {
      held = resolve;
    });
    const holder = withGithubSessionLock(file, async () => {
      held();
      await holding;
    });
    // Wait until the lock is demonstrably held. Starting from the same tick races
    // the scheduler instead of the lock, and the result then depends on how loaded
    // the run is — it passed alone and passed under the full suite for different
    // reasons, neither of them the one under test.
    await acquired;

    try {
      // Bounded rather than a plain await: if reuse ever waits on the lock again
      // this deadlocks, and a hung CI job is harder to read than a failed
      // assertion. proper-lockfile retries for 60s, far past this deadline.
      const outcome = await Promise.race([
        ensureGithubSession(file, async () => {
          throw new Error("must not create when a session already exists");
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("reuse waited on the session lock")),
            2_000,
          ).unref();
        }),
      ]);
      assert.strictEqual(outcome, "reused");
    } finally {
      release();
      await holder;
    }
  });

  it("creates once when two callers find no session at the same time", async () => {
    // Both pass the outer check, so the re-read inside the lock is the only thing
    // stopping the second from logging in again and submitting the same TOTP code.
    const dir = tmp();
    const file = path.join(dir, "s.json");
    let creates = 0;

    const create = async () => {
      creates += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      writeSession(file);
    };

    const outcomes = await Promise.all([
      ensureGithubSession(file, create),
      ensureGithubSession(file, create),
    ]);

    assert.strictEqual(creates, 1);
    assert.deepStrictEqual(outcomes.filter((o) => o === "created").length, 1);
    assert.deepStrictEqual(outcomes.filter((o) => o === "reused").length, 1);
  });

  it("reports creation so the caller does not replay the reuse path", async () => {
    // Creating leaves the page signed in. A "created" that read as "reused" would
    // click Sign In a second time against a live session.
    const dir = tmp();
    const file = path.join(dir, "s.json");
    const outcome = await ensureGithubSession(file, async () =>
      writeSession(file),
    );
    assert.strictEqual(outcome, "created");
  });
});
