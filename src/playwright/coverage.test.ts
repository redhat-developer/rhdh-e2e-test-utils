import { describe, it } from "node:test";
import assert from "node:assert";
import {
  collectCoverageFromBrowser,
  type CoverageBrowser,
  type CoverageData,
  type CoveragePage,
} from "./coverage.js";

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
  coverage: CoverageData | undefined,
  { closed = false }: { closed?: boolean } = {},
): CoveragePage {
  return {
    isClosed: () => closed,
    evaluate: async <R>() => coverage as R,
  };
}

function unusablePage(reason: string): CoveragePage {
  return {
    isClosed: () => false,
    evaluate: async () => {
      throw new Error(reason);
    },
  };
}

function fakeBrowser(...contexts: CoveragePage[][]): CoverageBrowser {
  return { contexts: () => contexts.map((pages) => ({ pages: () => pages })) };
}

/** Istanbul keys its report by the instrumented file's absolute path. */
function coverageFor(file: string): CoverageData {
  return { [file]: { path: file } };
}

const COVERAGE = coverageFor("/src/plugin.tsx");
const OTHER_COVERAGE = coverageFor("/src/widget.tsx");

describe("collectCoverageFromBrowser", () => {
  it("collects from a context the spec opened itself", async () => {
    // The regression this exists for. Specs that run every test in their own
    // `browser.newContext()` reported zero coverage for months while passing,
    // because collection only ever looked at the fixture page.
    const fixturePage = fakePage(undefined);
    const specOwnedPage = fakePage(COVERAGE);

    const collected = await collectCoverageFromBrowser(
      fakeBrowser([fixturePage], [specOwnedPage]),
    );

    assert.deepStrictEqual(collected, [COVERAGE]);
  });

  it("returns one entry per covered page so nyc merge sums them", async () => {
    const collected = await collectCoverageFromBrowser(
      fakeBrowser([fakePage(COVERAGE)], [fakePage(OTHER_COVERAGE)]),
    );

    assert.deepStrictEqual(
      collected,
      [COVERAGE, OTHER_COVERAGE],
      "entries stay separate; merging is nyc's job, not this function's",
    );
  });

  it("keeps other pages' coverage when one page cannot be evaluated", async () => {
    const collected = await collectCoverageFromBrowser(
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
    const closedPage: CoveragePage = {
      isClosed: () => true,
      evaluate: async <R>() => {
        evaluated = true;
        return COVERAGE as R;
      },
    };

    const collected = await collectCoverageFromBrowser(
      fakeBrowser([closedPage]),
    );

    assert.deepStrictEqual(collected, []);
    assert.strictEqual(evaluated, false, "a closed page must not be probed");
  });

  it("ignores a page with no coverage", async () => {
    const collected = await collectCoverageFromBrowser(
      fakeBrowser([fakePage(undefined)]),
    );

    assert.deepStrictEqual(collected, []);
  });

  it("ignores an empty coverage object", async () => {
    // An instrumented bundle that never executed leaves `{}` behind. Treating
    // it as a find would write an empty JSON and suppress the warning that is
    // supposed to flag exactly this.
    const collected = await collectCoverageFromBrowser(
      fakeBrowser([fakePage({})]),
    );

    assert.deepStrictEqual(collected, []);
  });

  it("returns nothing when no context is open", async () => {
    assert.deepStrictEqual(await collectCoverageFromBrowser(fakeBrowser()), []);
  });
});
