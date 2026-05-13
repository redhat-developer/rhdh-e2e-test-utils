import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
const DEFAULT_OPTIONS = {
    attachName: "accessibility-scan-results.violations.json",
    assertNoViolations: true,
    wcagTags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    disabledRules: ["color-contrast"],
};
export async function runAccessibilityTests(page, options = {}) {
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
        expect(accessibilityScanResults.violations, `Found ${accessibilityScanResults.violations.length} accessibility violation(s)`).toHaveLength(0);
    }
    return accessibilityScanResults;
}
