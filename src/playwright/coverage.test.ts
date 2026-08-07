import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import {
  collectAndWriteCoverage,
  collectCoverageFromBrowser,
  NO_COVERAGE_FOUND_MESSAGE,
  type BrowserLike,
  type CoverageMap,
  type PageLike,
} from "./coverage.js";

/** Reports read back off disk arrive in directory order, so sort by content. */
function byFirstKey(a: CoverageMap, b: CoverageMap): number {
  return Object.keys(a)[0].localeCompare(Object.keys(b)[0]);
}

/**
 * A page whose `__coverage__` is whatever `coverage` says.
 *
 * `evaluate` receives the real callback and would normally run it in the
 * browser against that page's `globalThis`. There is no browser here, so the
 * fake answers for it — which is the whole point: the behaviour under test is
 * which pages get asked and what happens to the answers, not how Playwright
 * ships a function across the wire.
 */
function fakePage(
  coverage: CoverageMap | undefined,
  { closed = false }: { closed?: boolean } = {},
): PageLike {
  return {
    isClosed: () => closed,
    evaluate: async () => coverage,
  };
}

function unusablePage(reason: string): PageLike {
  return {
    isClosed: () => false,
    evaluate: async () => {
      throw new Error(reason);
    },
  };
}

/**
 * The one fake that really runs the callback, against a `globalThis` carrying
 * what an instrumented bundle would have left behind.
 *
 * Every other fake answers in place of `evaluate`, which leaves the function
 * that actually names `__coverage__` unexercised — rename it and the suite
 * stays green while collection silently returns nothing, one level below the
 * regression this module exists to end.
 */
function evaluatingPage(globals: Record<string, unknown>): PageLike {
  return {
    isClosed: () => false,
    evaluate: async (pageFunction) => {
      const target = globalThis as unknown as Record<string, unknown>;
      const restore = Object.keys(globals).map(
        (key) => [key, key in target, target[key]] as const,
      );
      Object.assign(target, globals);
      try {
        return pageFunction();
      } finally {
        for (const [key, existed, previous] of restore) {
          if (existed) target[key] = previous;
          else delete target[key];
        }
      }
    },
  };
}

function fakeBrowser(...contexts: PageLike[][]): BrowserLike {
  return { contexts: () => contexts.map((pages) => ({ pages: () => pages })) };
}

/** Istanbul keys its report by the instrumented file's absolute path. */
function coverageFor(file: string): CoverageMap {
  return { [file]: { path: file } };
}

const COVERAGE = coverageFor("/src/plugin.tsx");
const OTHER_COVERAGE = coverageFor("/src/widget.tsx");

/** The coverage maps alone; page identity is asserted on its own below. */
async function mapsFrom(browser: BrowserLike): Promise<CoverageMap[]> {
  const collected = await collectCoverageFromBrowser(browser);
  return collected.map((entry) => entry.coverage);
}

describe("collectCoverageFromBrowser", () => {
  it("collects from a context the spec opened itself", async () => {
    // The regression this exists for. Specs that run every test in their own
    // `browser.newContext()` reported zero coverage for months while passing,
    // because collection only ever looked at the fixture page.
    const fixturePage = fakePage(undefined);
    const specOwnedPage = fakePage(COVERAGE);

    const collected = await mapsFrom(
      fakeBrowser([fixturePage], [specOwnedPage]),
    );

    assert.deepStrictEqual(collected, [COVERAGE]);
  });

  it("returns one entry per covered context so nyc merge sums them", async () => {
    const collected = await mapsFrom(
      fakeBrowser([fakePage(COVERAGE)], [fakePage(OTHER_COVERAGE)]),
    );

    assert.deepStrictEqual(
      collected,
      [COVERAGE, OTHER_COVERAGE],
      "entries stay separate; merging is nyc's job, not this function's",
    );
  });

  it("collects from every page in a context, not just the first", async () => {
    // One `newContext()` can hold several pages — a popup, a second tab. Taking
    // `pages()[0]` would satisfy every other case in this suite.
    const collected = await mapsFrom(
      fakeBrowser([
        fakePage(undefined),
        fakePage(COVERAGE),
        fakePage(OTHER_COVERAGE),
      ]),
    );

    assert.deepStrictEqual(
      collected,
      [COVERAGE, OTHER_COVERAGE],
      "every page of a context is probed, in page order",
    );
  });

  it("moves past a context holding no pages", async () => {
    const collected = await mapsFrom(fakeBrowser([], [fakePage(COVERAGE)]));

    assert.deepStrictEqual(collected, [COVERAGE]);
  });

  it("reads __coverage__ off the page's own globalThis", async () => {
    const collected = await mapsFrom(
      // eslint-disable-next-line @typescript-eslint/naming-convention
      fakeBrowser([evaluatingPage({ __coverage__: COVERAGE })]),
    );

    assert.deepStrictEqual(
      collected,
      [COVERAGE],
      "the global nyc writes is the global this reads",
    );
  });

  it("finds nothing in a page that loaded no instrumented bundle", async () => {
    const collected = await mapsFrom(fakeBrowser([evaluatingPage({})]));

    assert.deepStrictEqual(collected, []);
  });

  it("keeps other pages' coverage when one page cannot be evaluated", async () => {
    const collected = await mapsFrom(
      fakeBrowser(
        [unusablePage("Target page, context or browser has been closed")],
        [fakePage(COVERAGE)],
      ),
    );

    assert.deepStrictEqual(
      collected,
      [COVERAGE],
      "a single crashed page used to discard the whole test's coverage",
    );
  });

  it("skips closed pages without evaluating them", async () => {
    let evaluated = false;
    const closedPage: PageLike = {
      isClosed: () => true,
      evaluate: async () => {
        evaluated = true;
        return COVERAGE;
      },
    };

    const collected = await mapsFrom(fakeBrowser([closedPage]));

    assert.deepStrictEqual(collected, []);
    assert.strictEqual(evaluated, false, "a closed page must not be probed");
  });

  it("ignores a page with no coverage", async () => {
    const collected = await mapsFrom(fakeBrowser([fakePage(undefined)]));

    assert.deepStrictEqual(collected, []);
  });

  it("ignores an empty coverage object", async () => {
    // An instrumented bundle that never executed leaves `{}` behind. Treating
    // it as a find would write an empty JSON and suppress the warning that is
    // supposed to flag exactly this.
    const collected = await mapsFrom(fakeBrowser([fakePage({})]));

    assert.deepStrictEqual(collected, []);
  });

  it("returns nothing when no context is open", async () => {
    assert.deepStrictEqual(await mapsFrom(fakeBrowser()), []);
  });

  it("propagates a browser-level failure instead of reporting no coverage", async () => {
    // The caller turns this into a diagnostic that names the real cause.
    // Swallowing it here would return an empty array indistinguishable from
    // "nothing was instrumented" — the confusion this module exists to end.
    const deadBrowser: BrowserLike = {
      contexts: () => {
        throw new Error("Browser has been closed");
      },
    };

    await assert.rejects(
      () => collectCoverageFromBrowser(deadBrowser),
      /Browser has been closed/,
    );
  });

  it("gives one page the same id across collections", async () => {
    // What makes the per-page filename overwrite instead of accumulate: a
    // context opened in `beforeAll` is read again on every test, and each read
    // returns the same growing map.
    const longLived = fakePage(COVERAGE);
    const browser = fakeBrowser([longLived]);

    const first = await collectCoverageFromBrowser(browser);
    const second = await collectCoverageFromBrowser(browser);

    assert.strictEqual(first[0].pageId, second[0].pageId);
  });

  it("gives distinct pages distinct ids", async () => {
    const collected = await collectCoverageFromBrowser(
      fakeBrowser([fakePage(COVERAGE)], [fakePage(OTHER_COVERAGE)]),
    );

    assert.notStrictEqual(
      collected[0].pageId,
      collected[1].pageId,
      "sharing an id would make one page's file overwrite another's",
    );
  });
});

describe("collectAndWriteCoverage", () => {
  async function inTempDir(run: (dir: string) => Promise<void>): Promise<void> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coverage-test-"));
    try {
      await run(dir);
    } finally {
      await fs.remove(dir);
    }
  }

  it("writes one file per page, both readable back", async () => {
    await inTempDir(async (dir) => {
      const reported: string[] = [];

      await collectAndWriteCoverage(
        fakeBrowser([fakePage(COVERAGE)], [fakePage(OTHER_COVERAGE)]),
        { dir, runId: "w0" },
        (detail) => reported.push(detail),
      );

      const files = (await fs.readdir(dir)).sort();
      assert.strictEqual(files.length, 2, "two pages must not collide");
      const written = await Promise.all(
        files.map((file) => fs.readJson(path.join(dir, file))),
      );
      assert.deepStrictEqual(written.sort(byFirstKey), [
        COVERAGE,
        OTHER_COVERAGE,
      ]);
      assert.deepStrictEqual(reported, [], "a clean run reports nothing");
    });
  });

  it("overwrites rather than accumulating when a page is read again", async () => {
    // The long-lived-context case: 34 tests must not leave 34 copies of the
    // same growing map for `nyc merge` to sum.
    await inTempDir(async (dir) => {
      const browser = fakeBrowser([fakePage(COVERAGE)]);

      await collectAndWriteCoverage(browser, { dir, runId: "w0" }, () => {});
      await collectAndWriteCoverage(browser, { dir, runId: "w0" }, () => {});

      assert.strictEqual((await fs.readdir(dir)).length, 1);
    });
  });

  it("reports instead of throwing when the browser is gone", async () => {
    await inTempDir(async (dir) => {
      const reported: string[] = [];
      const deadBrowser: BrowserLike = {
        contexts: () => {
          throw new Error("Browser has been closed");
        },
      };

      await collectAndWriteCoverage(
        deadBrowser,
        { dir, runId: "w0" },
        (detail) => reported.push(detail),
      );

      assert.strictEqual(reported.length, 1);
      assert.match(
        reported[0],
        /Browser has been closed/,
        "the report must name the real cause, not just 'no coverage'",
      );
    });
  });

  it("reports instead of throwing when the directory cannot be created", async () => {
    // Teardown runs for every test, so an unwritable outputDir must not be able
    // to fail a test that already passed.
    await inTempDir(async (dir) => {
      const blocked = path.join(dir, "a-file-not-a-dir");
      await fs.writeFile(blocked, "");
      const reported: string[] = [];

      await collectAndWriteCoverage(
        fakeBrowser([fakePage(COVERAGE)]),
        { dir: blocked, runId: "w0" },
        (detail) => reported.push(detail),
      );

      assert.strictEqual(reported.length, 1);
      assert.match(reported[0], /collection failed/);
    });
  });

  it("reports the no-coverage diagnosis when nothing is instrumented", async () => {
    await inTempDir(async (dir) => {
      const reported: string[] = [];

      await collectAndWriteCoverage(
        fakeBrowser([fakePage(undefined)]),
        { dir, runId: "w0" },
        (detail) => reported.push(detail),
      );

      assert.deepStrictEqual(reported, [NO_COVERAGE_FOUND_MESSAGE]);
      assert.strictEqual(
        await fs.pathExists(dir),
        true,
        "reporting must not depend on having written anything",
      );
    });
  });
});
