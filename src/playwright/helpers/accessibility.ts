import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

export interface AccessibilityTestOptions {
  /** Custom name for the attached results file. Defaults to "accessibility-scan-results.violations.json" */
  attachName?: string;
  /** Whether to assert that there are no violations. Defaults to true */
  assertNoViolations?: boolean;
  /** WCAG tags to test against. Defaults to ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] */
  wcagTags?: string[];
  /** Rules to disable during the scan. Defaults to ["color-contrast"] */
  disabledRules?: string[];
}

const DEFAULT_OPTIONS: Required<AccessibilityTestOptions> = {
  attachName: "accessibility-scan-results.violations.json",
  assertNoViolations: true,
  wcagTags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  disabledRules: ["color-contrast"],
};

export async function runAccessibilityTests(
  page: Page,
  options: AccessibilityTestOptions = {},
) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const testInfo = test.info();

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(config.wcagTags)
    .disableRules(config.disabledRules)
    .analyze();

  await testInfo.attach(config.attachName, {
    body: JSON.stringify(accessibilityScanResults.violations, null, 2),
    contentType: "application/json",
  });

  if (config.assertNoViolations) {
    expect(
      accessibilityScanResults.violations,
      `Found ${accessibilityScanResults.violations.length} accessibility violation(s)`,
    ).toHaveLength(0);
  }

  return accessibilityScanResults;
}
