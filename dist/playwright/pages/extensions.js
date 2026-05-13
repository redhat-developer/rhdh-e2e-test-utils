import { expect } from "@playwright/test";
import { UIhelper } from "../helpers/ui-helper.js";
export class ExtensionsPage {
    page;
    badge;
    uiHelper;
    commonHeadings = [
        "Versions",
        "Author",
        "Tags",
        "Category",
        "Publisher",
        "Support Provider",
    ];
    tableHeaders = [
        "Package name",
        "Version",
        "Role",
        "Backstage compatibility version",
        "Status",
    ];
    constructor(page) {
        this.page = page;
        this.badge = this.page.getByTestId("TaskAltIcon");
        this.uiHelper = new UIhelper(page);
    }
    async clickReadMoreByPluginTitle(pluginTitle) {
        const allCards = this.page.locator(".v5-MuiPaper-outlined");
        const targetCard = allCards.filter({ hasText: pluginTitle });
        await targetCard.getByRole("link", { name: "Read more" }).click();
    }
    async selectDropdown(name) {
        await this.page
            .getByLabel(name)
            .getByRole("button", { name: "Open" })
            .click();
    }
    async toggleOption(name) {
        await this.page
            .getByRole("option", { name: name })
            .getByRole("checkbox")
            .click();
    }
    async clickAway() {
        await this.page.locator("#menu- div").first().click();
    }
    async selectSupportTypeFilter(supportType) {
        await this.selectDropdown("Support type");
        await this.toggleOption(supportType);
        await this.page.keyboard.press("Escape");
    }
    async resetSupportTypeFilter(supportType) {
        await this.selectDropdown("Support type");
        await this.toggleOption(supportType);
        await this.page.keyboard.press("Escape");
    }
    async verifyMultipleHeadings(headings = this.commonHeadings) {
        for (const heading of headings) {
            console.log(`Verifying heading: ${heading}`);
            await this.uiHelper.verifyHeading(heading);
        }
    }
    async waitForSearchResults(searchText) {
        await expect(this.page.locator(".v5-MuiPaper-outlined").first()).toContainText(searchText, { timeout: 10000 });
    }
    async verifyPluginDetails({ pluginName, badgeLabel, badgeText, headings = this.commonHeadings, includeTable = true, includeAbout = false, }) {
        await this.clickReadMoreByPluginTitle(pluginName);
        await expect(this.page.getByLabel(badgeLabel).getByText(badgeText)).toBeVisible();
        if (includeAbout) {
            await this.uiHelper.verifyText("About");
        }
        await this.verifyMultipleHeadings(headings);
        if (includeTable) {
            await this.uiHelper.verifyTableHeadingAndRows(this.tableHeaders);
        }
        await this.page
            .getByRole("button", {
            name: "close",
        })
            .click();
    }
    async verifySupportTypeBadge({ supportType, pluginName, badgeLabel, badgeText, tooltipText, searchTerm, headings = this.commonHeadings, includeTable = true, includeAbout = false, }) {
        await this.selectSupportTypeFilter(supportType);
        if (searchTerm) {
            await this.uiHelper.searchInputPlaceholder(searchTerm);
            await this.waitForSearchResults(searchTerm);
        }
        if (pluginName) {
            await this.verifyPluginDetails({
                pluginName,
                badgeLabel,
                badgeText,
                headings,
                includeTable,
                includeAbout,
            });
        }
        else {
            await expect(this.page.getByLabel(badgeLabel).first()).toBeVisible();
            await expect(this.badge.first()).toBeVisible();
            await this.badge.first().hover();
            await this.uiHelper.verifyTextInTooltip(tooltipText);
        }
        await this.resetSupportTypeFilter(supportType);
    }
    async verifyKeyValueRowElements(rowTitle, rowValue) {
        const rowLocator = this.page.locator(".v5-MuiTableRow-root");
        await expect(rowLocator.filter({ hasText: rowTitle })).toContainText(rowValue);
    }
}
