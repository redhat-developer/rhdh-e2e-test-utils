import { UIhelper } from "./ui-helper.js";
import type { Browser, Page, TestInfo } from "@playwright/test";
export declare class LoginHelper {
    page: Page;
    uiHelper: UIhelper;
    constructor(page: Page);
    loginAsGuest(): Promise<void>;
    signOut(): Promise<void>;
    private logintoGithub;
    logintoKeycloak(popup: Page, userid: string, password: string): Promise<void>;
    loginAsKeycloakUser(userid?: string, password?: string): Promise<void>;
    loginAsGithubUser(userid?: string): Promise<void>;
    checkAndReauthorizeGithubApp(): Promise<void>;
    googleSignIn(email: string): Promise<void>;
    checkAndClickOnGHloginPopup(force?: boolean): Promise<void>;
    getButtonSelector(label: string): string;
    getLoginBtnSelector(): string;
    clickOnGHloginPopup(): Promise<void>;
    getGitHub2FAOTP(userid: string): string;
    getGoogle2FAOTP(): string;
    keycloakLogin(username: string, password: string): Promise<"Already logged in" | "Login successful" | "User does not exist">;
    private handleGitHubPopupLogin;
    githubLogin(username: string, password: string, twofactor: string): Promise<string>;
    githubLoginFromSettingsPage(username: string, password: string, twofactor: string): Promise<string>;
    microsoftAzureLogin(username: string, password: string): Promise<"Already logged in" | "Login successful" | "User does not exist">;
}
export declare function setupBrowser(browser: Browser, testInfo: TestInfo): Promise<{
    page: Page;
    context: import("playwright-core").BrowserContext;
}>;
//# sourceMappingURL=common.d.ts.map