import type { Page, Locator } from "@playwright/test";
export declare class ExtensionsPage {
    private page;
    badge: Locator;
    private uiHelper;
    private commonHeadings;
    private tableHeaders;
    constructor(page: Page);
    clickReadMoreByPluginTitle(pluginTitle: string): Promise<void>;
    selectDropdown(name: string): Promise<void>;
    toggleOption(name: string): Promise<void>;
    clickAway(): Promise<void>;
    selectSupportTypeFilter(supportType: string): Promise<void>;
    resetSupportTypeFilter(supportType: string): Promise<void>;
    verifyMultipleHeadings(headings?: string[]): Promise<void>;
    waitForSearchResults(searchText: string): Promise<void>;
    verifyPluginDetails({ pluginName, badgeLabel, badgeText, headings, includeTable, includeAbout, }: {
        pluginName: string;
        badgeLabel: string;
        badgeText: string;
        headings?: string[];
        includeTable?: boolean;
        includeAbout?: boolean;
    }): Promise<void>;
    verifySupportTypeBadge({ supportType, pluginName, badgeLabel, badgeText, tooltipText, searchTerm, headings, includeTable, includeAbout, }: {
        supportType: string;
        pluginName?: string;
        badgeLabel: string;
        badgeText: string;
        tooltipText: string;
        searchTerm?: string;
        headings?: string[];
        includeTable?: boolean;
        includeAbout?: boolean;
    }): Promise<void>;
    verifyKeyValueRowElements(rowTitle: string, rowValue: string): Promise<void>;
}
//# sourceMappingURL=extensions.d.ts.map