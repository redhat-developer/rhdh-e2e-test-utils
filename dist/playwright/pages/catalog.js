import { UIhelper } from "../helpers/ui-helper.js";
//${RHDH_BASE_URL}/catalog page
export class CatalogPage {
    page;
    uiHelper;
    searchField;
    constructor(page) {
        this.page = page;
        this.uiHelper = new UIhelper(page);
        this.searchField = page.locator("#input-with-icon-adornment");
    }
    async go() {
        await this.uiHelper.openSidebar("Catalog");
    }
    async goToByName(name) {
        await this.uiHelper.openCatalogSidebar("Component");
        await this.uiHelper.clickLink(name);
    }
    async goToBackstageJanusProjectCITab() {
        await this.goToBackstageJanusProject();
        await this.uiHelper.clickTab("CI");
        await this.page.waitForSelector('h2:text("Pipeline Runs")');
        await this.uiHelper.verifyHeading("Pipeline Runs");
    }
    async goToBackstageJanusProject() {
        await this.goToByName("backstage-janus");
    }
    async search(s) {
        await this.searchField.clear();
        const searchResponse = this.page.waitForResponse(new RegExp(`${process.env.RHDH_BASE_URL}/api/catalog/entities/by-query/*`));
        await this.searchField.fill(s);
        await searchResponse;
    }
    async tableRow(content) {
        return this.page.locator(`tr >> a >> text="${content}"`);
    }
}
