import type { Page } from "@playwright/test";
export declare class HomePage {
    private page;
    private uiHelper;
    constructor(page: Page);
    verifyQuickSearchBar(text: string): Promise<void>;
    verifyQuickAccess(section: string, quickAccessItem: string, expand?: boolean): Promise<void>;
    verifyVisitedCardContent(section: string): Promise<void>;
}
//# sourceMappingURL=home-page.d.ts.map