import { expect } from "@playwright/test";
import { UI_HELPER_ELEMENTS, WAIT_OBJECTS, } from "../page-objects/global-obj.js";
import { SEARCH_OBJECTS_COMPONENTS } from "../page-objects/page-obj.js";
export class UIhelper {
    page;
    constructor(page) {
        this.page = page;
    }
    async waitForLoad(timeout = 120000) {
        for (const item of Object.values(WAIT_OBJECTS)) {
            await this.page.waitForSelector(item, {
                state: "hidden",
                timeout: timeout,
            });
        }
    }
    /**
     * Closes the quickstart drawer when the "Hide" button is visible (RHDH quickstart plugin),
     * so it does not cover catalog or other UI under test.
     */
    async dismissQuickstartIfVisible(options) {
        const waitHiddenMs = options?.waitHiddenMs ?? 5000;
        const quickstartHide = this.page.getByRole("button", { name: "Hide" });
        if (await quickstartHide.isVisible()) {
            await quickstartHide.click();
            await quickstartHide.waitFor({
                state: "hidden",
                timeout: waitHiddenMs,
            });
        }
    }
    async verifyComponentInCatalog(kind, expectedRows) {
        await this.openSidebar("Catalog");
        await this.selectMuiBox("Kind", kind);
        await this.verifyRowsInTable(expectedRows);
    }
    getSideBarMenuItem(menuItem) {
        return this.page.getByTestId("login-button").getByText(menuItem);
    }
    async fillTextInputByLabel(label, text) {
        await this.page.getByLabel(label).fill(text);
    }
    /**
     * Fills the search input with the provided text.
     *
     * @param searchText - The text to be entered into the search input field.
     */
    async searchInputPlaceholder(searchText) {
        await this.page.fill(SEARCH_OBJECTS_COMPONENTS.placeholderSearch, searchText);
    }
    async searchInputAriaLabel(searchText) {
        await this.page.fill(SEARCH_OBJECTS_COMPONENTS.ariaLabelSearch, searchText);
    }
    async pressTab() {
        await this.page.keyboard.press("Tab");
    }
    async checkCheckbox(text) {
        const locator = this.page.getByRole("checkbox", {
            name: text,
        });
        await locator.check();
    }
    async uncheckCheckbox(text) {
        const locator = this.page.getByRole("checkbox", {
            name: text,
        });
        await locator.uncheck();
    }
    async clickButton(label, options = {
        exact: true,
        force: false,
    }) {
        const selector = `${UI_HELPER_ELEMENTS.MuiButtonLabel}`;
        const button = this.page
            .locator(selector)
            .getByText(label, { exact: options.exact })
            .first();
        if (options?.force) {
            await button.click({ force: true });
        }
        else {
            await button.click();
        }
        return button;
    }
    async clickBtnByTitleIfNotPressed(title) {
        const button = this.page.locator(`button[title="${title}"]`);
        const isPressed = await button.getAttribute("aria-pressed");
        if (isPressed === "false") {
            await button.click();
        }
    }
    async clickByDataTestId(dataTestId) {
        const element = this.page.getByTestId(dataTestId);
        await element.waitFor({ state: "visible" });
        await element.dispatchEvent("click");
    }
    /**
     * Clicks on a button element by its text content, waiting for it to be visible first.
     *
     * @param buttonText - The text content of the button to click on.
     * @param options - Optional configuration for exact match, timeout, and force click.
     */
    async clickButtonByText(buttonText, options = {
        exact: true,
        timeout: 10000,
        force: false,
    }) {
        const buttonElement = this.page
            .getByRole("button")
            .getByText(buttonText, { exact: options.exact });
        await buttonElement.waitFor({
            state: "visible",
            timeout: options.timeout,
        });
        if (options.force) {
            await buttonElement.click({ force: true });
        }
        else {
            await buttonElement.click();
        }
    }
    async clickButtonByLabel(label) {
        await this.page.getByRole("button", { name: label }).first().click();
    }
    async clickLink(options) {
        let linkLocator;
        if (typeof options === "string") {
            linkLocator = this.page.locator("a").filter({ hasText: options }).first();
        }
        else if ("href" in options) {
            linkLocator = this.page.locator(`a[href="${options.href}"]`).first();
        }
        else {
            linkLocator = this.page
                .locator(`div[aria-label='${options.ariaLabel}'] a`)
                .first();
        }
        await linkLocator.waitFor({ state: "visible" });
        await linkLocator.click();
    }
    async openProfileDropdown() {
        const header = this.page.locator("nav[id='global-header']");
        await expect(header).toBeVisible();
        await header
            .locator("[data-testid='KeyboardArrowDownOutlinedIcon']")
            .click();
    }
    async goToPageUrl(url, heading) {
        await this.page.goto(url);
        await expect(this.page).toHaveURL(url);
        await this.waitForLoad();
        if (heading) {
            await this.verifyHeading(heading);
        }
    }
    async verifyLink(arg, options = {
        exact: true,
        notVisible: false,
    }) {
        let linkLocator;
        let notVisibleCheck;
        if (typeof arg != "object") {
            linkLocator = this.page
                .locator("a")
                .getByText(arg, { exact: options.exact })
                .first();
            notVisibleCheck = options?.notVisible ?? false;
        }
        else {
            linkLocator = this.page.locator(`div[aria-label="${arg.label}"] a`);
            notVisibleCheck = false;
        }
        if (notVisibleCheck) {
            await expect(linkLocator).toBeHidden();
        }
        else {
            await expect(linkLocator).toBeVisible();
        }
    }
    async isElementVisible(locator, timeout = 10000, force = false) {
        try {
            await this.page.waitForSelector(locator, {
                state: "visible",
                timeout: timeout,
            });
            const button = this.page.locator(locator).first();
            return button.isVisible();
        }
        catch (error) {
            if (force)
                throw error;
            return false;
        }
    }
    async isBtnVisibleByTitle(text) {
        const locator = `BUTTON[title="${text}"]`;
        return await this.isElementVisible(locator);
    }
    async isBtnVisible(text) {
        const locator = `button:has-text("${text}")`;
        return await this.isElementVisible(locator);
    }
    async isTextVisible(text, timeout = 10000) {
        const locator = `:has-text("${text}")`;
        return await this.isElementVisible(locator, timeout);
    }
    async verifyTextVisible(text, exact = false, timeout = 10000) {
        const locator = this.page.getByText(text, { exact });
        await expect(locator).toBeVisible({ timeout });
    }
    async verifyLinkVisible(text, timeout = 10000) {
        const locator = this.page.locator(`a:has-text("${text}")`);
        await expect(locator).toBeVisible({ timeout });
    }
    async openSidebar(navBarText) {
        const navLink = this.page
            .locator(`nav a:has-text("${navBarText}")`)
            .first();
        await navLink.waitFor({ state: "visible", timeout: 15_000 });
        await navLink.dispatchEvent("click");
    }
    async openCatalogSidebar(kind) {
        await this.openSidebar("Catalog");
        await this.selectMuiBox("Kind", kind);
        await expect(async () => {
            await this.clickByDataTestId("user-picker-all");
            await this.page.waitForTimeout(1_500);
            await this.verifyHeading(new RegExp(`all ${kind}`, "i"));
        }).toPass({
            intervals: [3_000],
            timeout: 20_000,
        });
    }
    async openSidebarButton(navBarButtonLabel) {
        const navLink = this.page.locator(`nav button[aria-label="${navBarButtonLabel}"]`);
        await navLink.waitFor({ state: "visible" });
        await navLink.click();
    }
    async selectMuiBox(label, value) {
        await this.page.click(`div[aria-label="${label}"]`);
        const optionSelector = `li[role="option"]:has-text("${value}")`;
        await this.page.waitForSelector(optionSelector);
        await this.page.click(optionSelector);
    }
    async verifyRowsInTable(rowTexts, exact = true) {
        for (const rowText of rowTexts) {
            await this.verifyTextInLocator(`tr>td`, rowText, exact);
        }
    }
    async waitForTextDisappear(text) {
        await this.page.waitForSelector(`text=${text}`, { state: "detached" });
    }
    async verifyText(text, exact = true) {
        await this.verifyTextInLocator("", text, exact);
    }
    async verifyTextInLocator(locator, text, exact) {
        const elementLocator = locator
            ? this.page.locator(locator).getByText(text, { exact }).first()
            : this.page.getByText(text, { exact }).first();
        await elementLocator.waitFor({ state: "visible" });
        await elementLocator.waitFor({ state: "attached" });
        try {
            await elementLocator.scrollIntoViewIfNeeded();
        }
        catch (error) {
            console.warn(`Warning: Could not scroll element into view. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
        await expect(elementLocator).toBeVisible();
    }
    async verifyTextInSelector(selector, expectedText) {
        const elementLocator = this.page
            .locator(selector)
            .getByText(expectedText, { exact: true });
        try {
            await elementLocator.waitFor({ state: "visible" });
            const actualText = (await elementLocator.textContent()) || "No content";
            if (actualText.trim() !== expectedText.trim()) {
                console.error(`Verification failed for text: Expected "${expectedText}", but got "${actualText}"`);
                throw new Error(`Expected text "${expectedText}" not found. Actual content: "${actualText}".`);
            }
            console.log(`Text "${expectedText}" verified successfully in selector: ${selector}`);
        }
        catch (error) {
            const allTextContent = await this.page
                .locator(selector)
                .allTextContents();
            console.error(`Verification failed for text: Expected "${expectedText}". Selector content: ${allTextContent.join(", ")}`);
            throw error;
        }
    }
    async verifyColumnHeading(rowTexts, exact = true) {
        for (const rowText of rowTexts) {
            const rowLocator = this.page
                .locator(`tr>th`)
                .getByText(rowText, { exact: exact })
                .first();
            await rowLocator.waitFor({ state: "visible" });
            await rowLocator.scrollIntoViewIfNeeded();
            await expect(rowLocator).toBeVisible();
        }
    }
    async verifyHeading(heading, timeout = 20000) {
        const headingLocator = this.page
            .locator("h1, h2, h3, h4, h5, h6")
            .filter({ hasText: heading })
            .first();
        await headingLocator.waitFor({ state: "visible", timeout: timeout });
        await expect(headingLocator).toBeVisible();
    }
    async verifyParagraph(paragraph) {
        const headingLocator = this.page
            .locator("p")
            .filter({ hasText: paragraph })
            .first();
        await headingLocator.waitFor({ state: "visible", timeout: 20000 });
        await expect(headingLocator).toBeVisible();
    }
    async waitForTitle(text, level = 1) {
        await this.page.waitForSelector(`h${level}:has-text("${text}")`);
    }
    async clickTab(tabName) {
        const tabLocator = this.page.getByRole("tab", { name: tabName });
        await tabLocator.waitFor({ state: "visible" });
        await tabLocator.click();
    }
    async verifyCellsInTable(texts) {
        for (const text of texts) {
            const cellLocator = this.page
                .locator(UI_HELPER_ELEMENTS.MuiTableCell)
                .filter({ hasText: text });
            const count = await cellLocator.count();
            if (count === 0) {
                throw new Error(`Expected at least one cell with text matching ${text}, but none were found.`);
            }
            // Checks if all matching cells are visible.
            for (let i = 0; i < count; i++) {
                await expect(cellLocator.nth(i)).toBeVisible();
            }
        }
    }
    async verifyButtonURL(label, url, options = {
        locator: "",
        exact: true,
    }) {
        // To verify the button URL if it is in a specific locator
        const baseLocator = !options.locator || options.locator === ""
            ? this.page
            : this.page.locator(options.locator);
        const buttonUrl = await baseLocator
            .getByRole("button", { name: label, exact: options.exact })
            .first()
            .getAttribute("href");
        expect(buttonUrl).toContain(url);
    }
    /**
     * Verifies that a table row, identified by unique text, contains specific cell texts.
     * @param {string} uniqueRowText - The unique text present in one of the cells within the row. This is used to identify the specific row.
     * @param {Array<string | RegExp>} cellTexts - An array of cell texts or regular expressions to match against the cells within the identified row.
     * @example
     * // Example usage to verify that a row containing "Developer-hub" has cells with the texts "service" and "active":
     * await verifyRowInTableByUniqueText('Developer-hub', ['service', 'active']);
     */
    async verifyRowInTableByUniqueText(uniqueRowText, cellTexts) {
        const row = this.page.locator(UI_HELPER_ELEMENTS.rowByText(uniqueRowText));
        await row.waitFor();
        for (const cellText of cellTexts) {
            await expect(row.locator("td").filter({ hasText: cellText }).first()).toBeVisible();
        }
    }
    /**
     * Clicks on a link within a table row that contains a unique text and matches a link's text.
     * @param {string} uniqueRowText - The unique text present in one of the cells within the row. This is used to identify the specific row.
     * @param {string | RegExp} linkText - The text of the link, can be a string or a regular expression.
     * @param {boolean} [exact=true] - Whether to match the link text exactly. By default, this is set to true.
     */
    async clickOnLinkInTableByUniqueText(uniqueRowText, linkText, exact = true) {
        const row = this.page.locator(UI_HELPER_ELEMENTS.rowByText(uniqueRowText));
        await row.waitFor();
        await row
            .locator("a")
            .getByText(linkText, { exact: exact })
            .first()
            .click();
    }
    /**
     * Clicks on a button within a table row that contains a unique text and matches a button's label or aria-label.
     * @param {string} uniqueRowText - The unique text present in one of the cells within the row. This is used to identify the specific row.
     * @param {string | RegExp} textOrLabel - The text of the button or the `aria-label` attribute, can be a string or a regular expression.
     */
    async clickOnButtonInTableByUniqueText(uniqueRowText, textOrLabel) {
        const row = this.page.locator(UI_HELPER_ELEMENTS.rowByText(uniqueRowText));
        await row.waitFor();
        await row
            .locator(`button:has-text("${textOrLabel}"), button[aria-label="${textOrLabel}"]`)
            .first()
            .click();
    }
    async verifyLinkinCard(cardHeading, linkText, exact = true) {
        const link = this.page
            .locator(UI_HELPER_ELEMENTS.MuiCard(cardHeading))
            .locator("a")
            .getByText(linkText, { exact: exact })
            .first();
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
    }
    async clickBtnInCard(cardText, btnText, exact = true) {
        const cardLocator = this.page
            .locator(UI_HELPER_ELEMENTS.MuiCardRoot(cardText))
            .first();
        await cardLocator.scrollIntoViewIfNeeded();
        await cardLocator
            .getByRole("button", { name: btnText, exact: exact })
            .first()
            .click();
    }
    async verifyTextinCard(cardHeading, text, exact = true) {
        const locator = this.page
            .locator(UI_HELPER_ELEMENTS.MuiCard(cardHeading))
            .getByText(text, { exact: exact })
            .first();
        await locator.scrollIntoViewIfNeeded();
        await expect(locator).toBeVisible();
    }
    async verifyTableHeadingAndRows(texts) {
        // Wait for the table to load by checking for the presence of table rows
        await this.page.waitForSelector("table tbody tr", { state: "visible" });
        for (const column of texts) {
            const columnSelector = `table th:has-text("${column}")`;
            //check if  columnSelector has at least one element or more
            const columnCount = await this.page.locator(columnSelector).count();
            expect(columnCount).toBeGreaterThan(0);
        }
        // Checks if the table has at least one row with data
        // Excludes rows that have cells spanning multiple columns, such as "No data available" messages
        const rowSelector = `table tbody tr:not(:has(td[colspan]))`;
        const rowCount = await this.page.locator(rowSelector).count();
        expect(rowCount).toBeGreaterThan(0);
    }
    async verifyTableIsEmpty() {
        const rowSelector = `table tbody tr:not(:has(td[colspan]))`;
        const rowCount = await this.page.locator(rowSelector).count();
        expect(rowCount).toEqual(0);
    }
    async verifyAlertErrorMessage(message) {
        const alert = this.page.getByRole("alert");
        await alert.waitFor();
        await expect(alert).toHaveText(message);
    }
    async verifyTextInTooltip(text) {
        const tooltip = this.page.getByRole("tooltip").getByText(text);
        await expect(tooltip).toBeVisible();
    }
}
