// Reading Istanbul coverage out of the browser after a test.
//
// Only the plugin under test is instrumented, so `globalThis.__coverage__`
// appears exclusively in pages that actually loaded the plugin's scalprum
// bundle. Which page that is depends on how the spec is written: some specs
// drive Playwright's `page` fixture, while others open their own context with
// `browser.newContext()` in `beforeAll` and run every test there. Reading only
// the fixture page silently loses everything the second group produced, so
// collection walks every open context instead of assuming one.
//
// The types below are the structural minimum this needs from Playwright's
// `Browser` and `Page`. Depending on the shape rather than the classes is what
// lets the tests exercise this without launching a browser.

/**
 * Istanbul's per-file coverage, keyed by the instrumented file's path.
 *
 * The values stay `unknown` on purpose: this module serializes them and never
 * reads inside, so modelling Istanbul's report shape would buy nothing and
 * pull a dependency on its types into a package that has none.
 */
export type CoverageData = Record<string, unknown>;

export type CoveragePage = {
  isClosed(): boolean;
  // Narrower than Playwright's generic `evaluate`, which a real Page still
  // satisfies. Naming the one return type this needs is what lets a fake
  // return a plain value instead of asserting its way into a type parameter.
  evaluate(
    pageFunction: () => CoverageData | undefined,
  ): Promise<CoverageData | undefined>;
};

export type CoverageBrowser = {
  contexts(): readonly { pages(): readonly CoveragePage[] }[];
};

/**
 * Runs in the browser, so it must not close over anything.
 *
 * The assertion stands in for a type that cannot exist statically: nyc defines
 * `__coverage__` at runtime, in the instrumented bundle. Declaring it as a
 * global would be the alternative, but this package is published, and its
 * ambient declarations would land in every consumer's type environment.
 */
function readInstrumentedGlobal(): CoverageData | undefined {
  return (
    globalThis as unknown as {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      __coverage__?: CoverageData;
    }
  ).__coverage__;
}

/**
 * Every non-empty coverage object reachable in the browser, one entry per page.
 *
 * Callers write these as separate files; `nyc merge` sums the counters, so
 * splitting rather than merging here keeps this free of Istanbul internals.
 * A page that carries an empty object is dropped — it is as useless as a page
 * with none, and reporting it as a find would mask the "nothing was
 * instrumented" case that callers warn about.
 */
export async function collectCoverageFromBrowser(
  browser: CoverageBrowser,
): Promise<CoverageData[]> {
  const collected: CoverageData[] = [];
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (page.isClosed()) continue;
      let coverage: CoverageData | undefined;
      try {
        coverage = await page.evaluate(readInstrumentedGlobal);
      } catch {
        // A page can crash, navigate, or close between being listed and being
        // evaluated. One unusable page must not discard the others' coverage.
        continue;
      }
      if (coverage && Object.keys(coverage).length > 0) {
        collected.push(coverage);
      }
    }
  }
  return collected;
}
