import type { Page } from "@playwright/test";
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
export declare function runAccessibilityTests(page: Page, options?: AccessibilityTestOptions): Promise<import("axe-core").AxeResults>;
//# sourceMappingURL=accessibility.d.ts.map