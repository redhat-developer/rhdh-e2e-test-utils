import fs from "node:fs";
import path from "node:path";

// Reading Istanbul coverage out of the browser after a test.
//
// The types below are the structural minimum this needs from Playwright's
// `Browser` and `Page`. Depending on the shape rather than the classes is what
// lets the tests exercise this without launching a browser.

/**
 * The whole `__coverage__` object, keyed by each instrumented file's path.
 *
 * Named for what it holds: istanbul's own `CoverageData` is the entry for a
 * single file, so calling this that would read as one file's counters.
 *
 * The values stay `unknown` on purpose — this module serializes them and never
 * reads inside, so modelling istanbul's report shape would buy nothing and pull
 * a dependency on its types into a package that has none.
 */
export type CoverageMap = Record<string, unknown>;

export type PageLike = {
  isClosed(): boolean;
  // Narrower than Playwright's generic `evaluate`, which a real Page still
  // satisfies. Naming the one return type this needs is what lets a fake
  // return a plain value instead of asserting its way into a type parameter.
  evaluate(
    pageFunction: () => CoverageMap | undefined,
  ): Promise<CoverageMap | undefined>;
};

export type BrowserLike = {
  contexts(): readonly { pages(): readonly PageLike[] }[];
};

/** One page's coverage, tagged so repeated reads of it can overwrite. */
export type CoverageEntry = { pageId: string; coverage: CoverageMap };

/**
 * Stable per-page id, so a page read across many tests keeps one identity.
 *
 * Weakly held: pages are closed and discarded constantly, and keeping them
 * alive to remember a number would be a leak that grows with the suite.
 */
const pageIds = new WeakMap<PageLike, string>();
let nextPageId = 0;
function idFor(page: PageLike): string {
  const existing = pageIds.get(page);
  if (existing !== undefined) return existing;
  const id = `page${nextPageId++}`;
  pageIds.set(page, id);
  return id;
}

/**
 * Runs in the browser, so it must not close over anything.
 *
 * The assertion stands in for a type that cannot exist statically: nyc defines
 * `__coverage__` at runtime, in the instrumented bundle. Declaring it as a
 * global would be the alternative, but this package is published, and its
 * ambient declarations would land in every consumer's type environment.
 */
function readCoverageGlobal(): CoverageMap | undefined {
  return (
    globalThis as unknown as {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      __coverage__?: CoverageMap;
    }
  ).__coverage__;
}

/**
 * Every non-empty coverage map reachable in the browser, one entry per page.
 *
 * Only the plugin under test is instrumented, so `__coverage__` appears solely
 * in pages that loaded its bundle. Which page that is depends on how the spec
 * is written — some drive Playwright's `page` fixture, others open their own
 * context in `beforeAll` and run every test there — so this walks every open
 * context rather than assuming one.
 *
 * A page carrying an empty object is dropped: it is as useless as a page with
 * none, and reporting it as a find would mask the "nothing was instrumented"
 * case the caller reports on.
 *
 * Failures are handled at two levels on purpose. A single unusable page is
 * skipped, because the other pages' coverage is still worth having. A failure
 * reaching the browser propagates: returning an empty array would be
 * indistinguishable from "nothing was instrumented", and the caller can only
 * report accurately what it is allowed to see.
 */
export async function collectCoverageFromBrowser(
  browser: BrowserLike,
): Promise<CoverageEntry[]> {
  const collected: CoverageEntry[] = [];
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (page.isClosed()) continue;
      let coverage: CoverageMap | undefined;
      try {
        coverage = await page.evaluate(readCoverageGlobal);
      } catch {
        // A page can crash, navigate, or close between being listed and being
        // evaluated. One unusable page must not discard the others' coverage.
        continue;
      }
      if (coverage && Object.keys(coverage).length > 0) {
        collected.push({ pageId: idFor(page), coverage });
      }
    }
  }
  return collected;
}

/** Every reason collection can legitimately come back with nothing. */
export const NO_COVERAGE_FOUND_MESSAGE =
  "E2E_COLLECT_COVERAGE=true but no open page exposed __coverage__. The " +
  "deployed bundle may not be instrumented, the spec may have closed its " +
  "pages before teardown, or evaluation may have been blocked in the page.";

/**
 * Collect and persist one JSON per covered page, reporting instead of throwing.
 *
 * Called from fixture teardown for every test, so it must never raise: an
 * unwritable output directory or a browser that died mid-test would otherwise
 * fail a test that had already passed. Coverage is diagnostics, not a verdict.
 * `report` is how a problem stays visible without becoming one — silence is the
 * failure mode this module exists to remove.
 *
 * Files are named per page, not per test, and deliberately overwritten. A
 * context opened in `beforeAll` outlives the whole file, and `__coverage__`
 * accumulates in it, so naming per test would write a growing copy of the same
 * map once per test — 30 near-duplicates of a multi-megabyte report, all summed
 * again by `nyc merge`. Overwriting keeps the last and most complete read, and
 * costs nothing for a per-test fixture page, which is a new page with a new id
 * every time. It also collapses the retry case, where a failed and a passing
 * attempt would otherwise both be counted.
 */
export async function collectAndWriteCoverage(
  browser: BrowserLike,
  target: { dir: string; runId: string },
  report: (detail: string) => void,
): Promise<void> {
  try {
    const collected = await collectCoverageFromBrowser(browser);
    if (collected.length === 0) {
      report(NO_COVERAGE_FOUND_MESSAGE);
      return;
    }
    fs.mkdirSync(target.dir, { recursive: true });
    for (const { pageId, coverage } of collected) {
      fs.writeFileSync(
        path.join(target.dir, `${target.runId}-${pageId}.json`),
        JSON.stringify(coverage),
      );
    }
  } catch (error) {
    report(`collection failed: ${error}`);
  }
}
