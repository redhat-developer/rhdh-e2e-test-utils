import type { Locator, Page } from "@playwright/test";
import type { SidebarTabs } from "./navbar.js";
export declare class UIhelper {
    private page;
    constructor(page: Page);
    waitForLoad(timeout?: number): Promise<void>;
    /**
     * Closes the quickstart drawer when the "Hide" button is visible (RHDH quickstart plugin),
     * so it does not cover catalog or other UI under test.
     */
    dismissQuickstartIfVisible(options?: {
        waitHiddenMs?: number;
    }): Promise<void>;
    verifyComponentInCatalog(kind: string, expectedRows: string[]): Promise<void>;
    getSideBarMenuItem(menuItem: string): Locator;
    fillTextInputByLabel(label: string, text: string): Promise<void>;
    /**
     * Fills the search input with the provided text.
     *
     * @param searchText - The text to be entered into the search input field.
     */
    searchInputPlaceholder(searchText: string): Promise<void>;
    searchInputAriaLabel(searchText: string): Promise<void>;
    pressTab(): Promise<void>;
    checkCheckbox(text: string): Promise<void>;
    uncheckCheckbox(text: string): Promise<void>;
    clickButton(label: string | RegExp, options?: {
        exact?: boolean;
        force?: boolean;
    }): Promise<Locator>;
    clickBtnByTitleIfNotPressed(title: string): Promise<void>;
    clickByDataTestId(dataTestId: string): Promise<void>;
    /**
     * Clicks on a button element by its text content, waiting for it to be visible first.
     *
     * @param buttonText - The text content of the button to click on.
     * @param options - Optional configuration for exact match, timeout, and force click.
     */
    clickButtonByText(buttonText: string | RegExp, options?: {
        exact?: boolean;
        timeout?: number;
        force?: boolean;
    }): Promise<void>;
    clickButtonByLabel(label: string | RegExp): Promise<void>;
    clickLink(options: string | {
        href: string;
    } | {
        ariaLabel: string;
    }): Promise<void>;
    openProfileDropdown(): Promise<void>;
    goToPageUrl(url: string, heading?: string): Promise<void>;
    verifyLink(arg: string | {
        label: string;
    }, options?: {
        exact?: boolean;
        notVisible?: boolean;
    }): Promise<void>;
    private isElementVisible;
    isBtnVisibleByTitle(text: string): Promise<boolean>;
    isBtnVisible(text: string): Promise<boolean>;
    isTextVisible(text: string, timeout?: number): Promise<boolean>;
    verifyTextVisible(text: string, exact?: boolean, timeout?: number): Promise<void>;
    verifyLinkVisible(text: string, timeout?: number): Promise<void>;
    openSidebar(navBarText: SidebarTabs): Promise<void>;
    openCatalogSidebar(kind: string): Promise<void>;
    openSidebarButton(navBarButtonLabel: string): Promise<void>;
    selectMuiBox(label: string, value: string): Promise<void>;
    verifyRowsInTable(rowTexts: (string | RegExp)[], exact?: boolean): Promise<void>;
    waitForTextDisappear(text: string): Promise<void>;
    verifyText(text: string | RegExp, exact?: boolean): Promise<void>;
    private verifyTextInLocator;
    verifyTextInSelector(selector: string, expectedText: string): Promise<void>;
    verifyColumnHeading(rowTexts: string[] | RegExp[], exact?: boolean): Promise<void>;
    verifyHeading(heading: string | RegExp, timeout?: number): Promise<void>;
    verifyParagraph(paragraph: string): Promise<void>;
    waitForTitle(text: string, level?: number): Promise<void>;
    clickTab(tabName: string): Promise<void>;
    verifyCellsInTable(texts: (string | RegExp)[]): Promise<void>;
    verifyButtonURL(label: string | RegExp, url: string | RegExp, options?: {
        locator?: string;
        exact?: boolean;
    }): Promise<void>;
    /**
     * Verifies that a table row, identified by unique text, contains specific cell texts.
     * @param {string} uniqueRowText - The unique text present in one of the cells within the row. This is used to identify the specific row.
     * @param {Array<string | RegExp>} cellTexts - An array of cell texts or regular expressions to match against the cells within the identified row.
     * @example
     * // Example usage to verify that a row containing "Developer-hub" has cells with the texts "service" and "active":
     * await verifyRowInTableByUniqueText('Developer-hub', ['service', 'active']);
     */
    verifyRowInTableByUniqueText(uniqueRowText: string, cellTexts: string[] | RegExp[]): Promise<void>;
    /**
     * Clicks on a link within a table row that contains a unique text and matches a link's text.
     * @param {string} uniqueRowText - The unique text present in one of the cells within the row. This is used to identify the specific row.
     * @param {string | RegExp} linkText - The text of the link, can be a string or a regular expression.
     * @param {boolean} [exact=true] - Whether to match the link text exactly. By default, this is set to true.
     */
    clickOnLinkInTableByUniqueText(uniqueRowText: string, linkText: string | RegExp, exact?: boolean): Promise<void>;
    /**
     * Clicks on a button within a table row that contains a unique text and matches a button's label or aria-label.
     * @param {string} uniqueRowText - The unique text present in one of the cells within the row. This is used to identify the specific row.
     * @param {string | RegExp} textOrLabel - The text of the button or the `aria-label` attribute, can be a string or a regular expression.
     */
    clickOnButtonInTableByUniqueText(uniqueRowText: string, textOrLabel: string | RegExp): Promise<void>;
    verifyLinkinCard(cardHeading: string, linkText: string, exact?: boolean): Promise<void>;
    clickBtnInCard(cardText: string, btnText: string, exact?: boolean): Promise<void>;
    verifyTextinCard(cardHeading: string, text: string | RegExp, exact?: boolean): Promise<void>;
    verifyTableHeadingAndRows(texts: string[]): Promise<void>;
    verifyTableIsEmpty(): Promise<void>;
    verifyAlertErrorMessage(message: string | RegExp): Promise<void>;
    verifyTextInTooltip(text: string | RegExp): Promise<void>;
}
//# sourceMappingURL=ui-helper.d.ts.map