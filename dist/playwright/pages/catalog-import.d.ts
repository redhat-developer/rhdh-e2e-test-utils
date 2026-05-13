import type { Page } from "@playwright/test";
export declare class CatalogImportPage {
    private page;
    private uiHelper;
    constructor(page: Page);
    /**
     * Fills the component URL input and clicks the "Analyze" button.
     * Waits until the analyze button is no longer visible (processing done).
     *
     * @param url - The URL of the component to analyze
     */
    private analyzeAndWait;
    /**
     * Returns true if the component is already registered
     * (i.e., "Refresh" button is visible instead of "Import").
     *
     * @returns boolean indicating if the component is already registered
     */
    isComponentAlreadyRegistered(): Promise<boolean>;
    /**
     * Registers an existing component if it has not been registered yet.
     * If already registered, clicks the "Refresh" button instead.
     *
     * @param url - The component URL to register
     * @param clickViewComponent - Whether to click "View Component" after import
     */
    registerExistingComponent(url: string, clickViewComponent?: boolean): Promise<boolean>;
    analyzeComponent(url: string): Promise<void>;
    inspectEntityAndVerifyYaml(text: string): Promise<void>;
}
//# sourceMappingURL=catalog-import.d.ts.map