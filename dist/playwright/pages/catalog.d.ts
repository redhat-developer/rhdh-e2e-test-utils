import type { Locator, Page } from "@playwright/test";
export declare class CatalogPage {
    private page;
    private uiHelper;
    private searchField;
    constructor(page: Page);
    go(): Promise<void>;
    goToByName(name: string): Promise<void>;
    goToBackstageJanusProjectCITab(): Promise<void>;
    goToBackstageJanusProject(): Promise<void>;
    search(s: string): Promise<void>;
    tableRow(content: string): Promise<Locator>;
}
//# sourceMappingURL=catalog.d.ts.map