import { UIhelper } from "./ui-helper.js";
import { authenticator } from "otplib";
import { test, expect } from "@playwright/test";
import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";
import { SETTINGS_PAGE_COMPONENTS } from "../page-objects/page-obj.js";
import * as path from "path";
import * as fs from "fs";
import lockfile from "proper-lockfile";
import { DEFAULT_USERS } from "../../deployment/keycloak/constants.js";

/**
 * Where a GitHub storage state is cached, and the lock that serialises access to it.
 *
 * The name used to be a bare relative `authState_<user>.json`, resolved against
 * `process.cwd()` — which the worker fixture sets to the workspace's `e2e-tests`
 * directory, the same value for every project in that workspace. So every lane and
 * every worker shared one file with no lock: a reader could land mid-write and fail on
 * truncated JSON, and a stale file could survive into a run that needed a fresh login.
 *
 * Deliberately still one file per *user*, not per project. Scoping it per project was
 * the obvious fix and is the wrong one: `logintoGithub` derives its 2FA code from a
 * single shared TOTP secret, so two lanes logging in inside the same 30-second window
 * submit the identical code and GitHub rejects the second — a failure this file already
 * has retry handling for. Sharing the session is the point of caching it; what was
 * missing was making concurrent access safe, which is what the lock and the atomic
 * write below do. RHDH cookies from another lane are harmless: each lane's RHDH lives
 * on its own namespace hostname, so they are never sent anywhere they matter.
 */
export function githubSessionFile(userid: string): string {
  const safe = String(userid).replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.resolve(`authState_${safe}.json`);
}

/**
 * Cookies from a stored session, or `undefined` when there is nothing usable.
 *
 * A cached session is an optimisation, so a missing, truncated or malformed file must
 * fall through to a full login rather than fail the test. Before this, a partially
 * written file threw out of `JSON.parse` and read as a plugin failure.
 */
export type StoredCookies = Parameters<BrowserContext["addCookies"]>[0];

export function readStoredCookies(file: string): StoredCookies | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    const cookies = parsed?.cookies as StoredCookies | undefined;
    return Array.isArray(cookies) && cookies.length > 0 ? cookies : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes the storage state so a concurrent reader never sees a partial file.
 *
 * `storageState({ path })` writes in place, so a reader can observe the file between
 * create and write. Writing to a temp name and renaming makes the appearance of the
 * final path atomic. The temp name carries the pid because Playwright workers are
 * separate processes, and it is removed even when the write fails so failed runs do
 * not litter the workspace.
 */
export async function writeStorageStateAtomically(
  page: Page,
  file: string,
): Promise<void> {
  const pending = `${file}.${process.pid}.tmp`;
  try {
    await page.context().storageState({ path: pending });
    fs.renameSync(pending, file);
  } finally {
    fs.rmSync(pending, { force: true });
  }
}

/**
 * Runs `fn` with exclusive access to the session file, across workers and lanes.
 *
 * Without this the first lane to start would not have finished writing before the
 * others decided there was no session and each began its own login — which is the
 * TOTP collision described above, not merely wasted work. The lock target is created
 * rather than assumed: `proper-lockfile` needs an existing path, and the session file
 * itself does not exist on the run that has to create it.
 */
export async function withGithubSessionLock<T>(
  file: string,
  fn: () => Promise<T>,
): Promise<T> {
  const target = `${file}.lock-target`;
  fs.writeFileSync(target, "", { flag: "a" });
  const release = await lockfile.lock(target, {
    retries: { retries: 60, minTimeout: 1_000 },
    stale: 300_000,
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}

/**
 * Creates the shared GitHub session if it is missing, and says which happened.
 *
 * Only creation needs to be exclusive: it drives a real GitHub sign-in whose 2FA
 * code comes from one shared TOTP secret, so two lanes doing it inside the same
 * 30-second window submit the identical code and the second is rejected. Reusing
 * an existing session is just cookies plus a Sign In click against a different
 * namespace host, and serialising that behind the lock made every lane queue for
 * a sign-in it did not need — long enough that a waiter could exhaust Playwright's
 * default test timeout before the lock's own retries ran out. `test.setTimeout`
 * is raised inside the login itself, which is precisely the path a waiter is not on.
 *
 * The re-read inside the lock is what keeps that safe: whoever held the lock before
 * us has almost certainly just created the session, and logging in again would be
 * the same collision the lock exists to prevent.
 */
export async function ensureGithubSession(
  file: string,
  create: () => Promise<void>,
): Promise<"reused" | "created"> {
  if (readStoredCookies(file)) return "reused";

  return await withGithubSessionLock(file, async () => {
    if (readStoredCookies(file)) return "reused";
    await create();
    return "created";
  });
}

export class LoginHelper {
  page: Page;
  uiHelper: UIhelper;

  constructor(page: Page) {
    this.page = page;
    this.uiHelper = new UIhelper(page);
  }

  async loginAsGuest() {
    await this.page.goto("/");
    await this.uiHelper.waitForLoad(240000);
    // TODO - Remove it after https://issues.redhat.com/browse/RHIDP-2043. A Dynamic plugin for Guest Authentication Provider needs to be created
    this.page.on("dialog", async (dialog) => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.accept();
    });

    await this.uiHelper.verifyHeading("Select a sign-in method");
    await this.uiHelper.clickButton("Enter");
    await this.page.waitForSelector("nav a", { timeout: 10_000 });
  }

  async signOut() {
    await this.page.click(SETTINGS_PAGE_COMPONENTS.userSettingsMenu);
    await this.page.click(SETTINGS_PAGE_COMPONENTS.signOut);
    await this.uiHelper.verifyHeading("Select a sign-in method");
  }

  private async logintoGithub(userid: string) {
    await this.page.goto("https://github.com/login");
    await this.page.waitForSelector("#login_field");
    await this.page.fill("#login_field", userid);

    switch (userid) {
      case process.env.VAULT_GH_USER_ID:
        await this.page.fill(
          "#password",
          process.env.VAULT_GH_USER_PASS as string,
        );
        break;
      case process.env.VAULT_GH_USER2_ID:
        await this.page.fill(
          "#password",
          process.env.VAULT_GH_USER2_PASS as string,
        );
        break;
      default:
        throw new Error("Invalid User ID");
    }

    await this.page.click('[value="Sign in"]');
    await this.page.fill("#app_totp", this.getGitHub2FAOTP(userid));
    test.setTimeout(260_000);
    if (
      (await this.uiHelper.isTextVisible(
        "The two-factor code you entered has already been used",
      )) ||
      (await this.uiHelper.isTextVisible(
        "too many codes have been submitted",
        3000,
      ))
    ) {
      await this.page.waitForTimeout(60000);
      await this.page.fill("#app_totp", this.getGitHub2FAOTP(userid));
    }

    await this.page
      .getByRole("heading", { name: "Home" })
      .waitFor({ timeout: 30_000 });
  }

  async logintoKeycloak(popup: Page, userid: string, password: string) {
    await popup.waitForLoadState();
    await popup.locator("#username").fill(userid);
    await popup.locator("#password").fill(password);
    await popup.locator("#kc-login").click();
  }

  /**
   * Sign in via Keycloak popup. Supports both OIDC ("Sign In") and the
   * community keycloak provider ("Sign in using Keycloak").
   */
  async loginAsKeycloakUser(
    userid: string = DEFAULT_USERS[0].username,
    password: string = DEFAULT_USERS[0].password,
  ) {
    await this.page.goto("/");
    await this.uiHelper.waitForLoad(240000);

    const popupPromise = this.page.waitForEvent("popup");
    const keycloakProviderBtn = this.page.getByRole("button", {
      name: /sign in using keycloak/i,
    });
    if (await keycloakProviderBtn.isVisible().catch(() => false)) {
      await keycloakProviderBtn.click();
    } else {
      await this.uiHelper.clickButton("Sign In");
    }

    const popup = await popupPromise;
    await this.logintoKeycloak(popup, userid, password);
    await this.page.waitForSelector("nav a", { timeout: 30_000 });
  }

  async loginAsGithubUser(
    userid: string = process.env.VAULT_GH_USER_ID as string,
  ) {
    const sessionFileName = githubSessionFile(userid);
    const outcome = await ensureGithubSession(sessionFileName, () =>
      this._createGithubSession(userid, sessionFileName),
    );
    // Creating already left this page signed in; replaying the reuse path would
    // click Sign In a second time against a session that is already live.
    if (outcome === "reused") {
      await this._reuseGithubSession(userid, sessionFileName);
    }
  }

  private async _reuseGithubSession(userid: string, sessionFileName: string) {
    const cookies = readStoredCookies(sessionFileName);
    if (!cookies) {
      throw new Error(
        `GitHub session file for ${userid} disappeared between the check and the read: ${sessionFileName}`,
      );
    }

    // Load and reuse existing authentication state
    await this.page.context().addCookies(cookies);
    console.log(`Reusing existing authentication state for user: ${userid}`);
    await this.page.goto("/");
    await this.uiHelper.waitForLoad(12000);
    await this.uiHelper.clickButton("Sign In");

    // Wait for either: sidebar appears (auto-login) or popup opens (needs auth)
    const navPromise = this.page
      .waitForSelector("nav a", { timeout: 15_000 })
      .then(() => "nav" as const)
      .catch(() => null);

    const popupPromise = this.page
      .waitForEvent("popup", { timeout: 15_000 })
      .then((popup) => ({ popup }))
      .catch(() => null);

    const result = await Promise.race([navPromise, popupPromise]);

    if (result === null) {
      throw new Error(
        "GitHub login failed: neither sidebar nor popup appeared after Sign In — session file may be stale",
      );
    }

    if (typeof result === "object" && "popup" in result) {
      // Popup opened — handle reauthorization
      await this.handleGithubPopupReauth(result.popup);
    }
  }

  private async _createGithubSession(userid: string, sessionFileName: string) {
    await this.logintoGithub(userid);
    await this.page.goto("/");
    await this.uiHelper.waitForLoad(240000);
    await this.uiHelper.clickButton("Sign In");
    await this.checkAndReauthorizeGithubApp();
    await this.page.waitForSelector("nav a", { timeout: 10_000 });
    await writeStorageStateAtomically(this.page, sessionFileName);
    console.log(`Authentication state saved for user: ${userid}`);
  }

  async checkAndReauthorizeGithubApp() {
    await new Promise<void>((resolve) => {
      this.page.once("popup", async (popup) => {
        await this.handleGithubPopupReauth(popup);
        resolve();
      });
    });
  }

  private async handleGithubPopupReauth(popup: Page) {
    await popup.waitForLoadState();

    // Check for popup closure for up to 10 seconds before proceeding
    for (let attempts = 0; attempts < 10 && !popup.isClosed(); attempts++) {
      await this.page.waitForTimeout(1000); // Using page here because if the popup closes automatically, it throws an error during the wait
    }

    const locator = popup.locator("button.js-oauth-authorize-btn");
    if (!popup.isClosed() && (await locator.isVisible())) {
      await popup.locator("body").click();
      await locator.waitFor();
      await locator.click();
    }
  }

  async googleSignIn(email: string) {
    await new Promise<void>((resolve) => {
      this.page.once("popup", async (popup) => {
        await popup.waitForLoadState();
        const locator = popup
          .getByRole("link", { name: email, exact: false })
          .first();
        await popup.waitForTimeout(3000);
        await locator.waitFor({ state: "visible" });
        await locator.click({ force: true });
        await popup.waitForTimeout(3000);

        await popup
          .locator("[name=Passwd]")
          .fill(process.env.GOOGLE_USER_PASS as string);
        await popup.locator("[name=Passwd]").press("Enter");
        await popup.waitForTimeout(3500);
        await popup.locator("[name=totpPin]").fill(this.getGoogle2FAOTP());
        await popup.locator("[name=totpPin]").press("Enter");
        await popup
          .getByRole("button", { name: /Continue|Weiter/ })
          .click({ timeout: 60000 });
        resolve();
      });
    });
  }

  async checkAndClickOnGHloginPopup(force = false) {
    const frameLocator = this.page.getByLabel("Login Required");
    try {
      await frameLocator.waitFor({ state: "visible", timeout: 2000 });
      await this.clickOnGHloginPopup();
    } catch (error) {
      if (force) throw error;
    }
  }

  getLoginBtnSelector(): string {
    return 'MuiListItem-root li.MuiListItem-root button.MuiButton-root:has(span.MuiButton-label:text("Log in"))';
  }

  async clickOnGHloginPopup() {
    const isLoginRequiredVisible = await this.uiHelper.isTextVisible("Sign in");
    if (isLoginRequiredVisible) {
      await this.uiHelper.clickButton("Sign in");
      await this.uiHelper.clickButton("Log in");
      await this.checkAndReauthorizeGithubApp();
      await this.page.waitForSelector(this.getLoginBtnSelector(), {
        state: "detached",
      });
    } else {
      console.log(
        '"Log in" button is not visible. Skipping login popup actions.',
      );
    }
  }

  getGitHub2FAOTP(userid: string): string {
    const secrets: { [key: string]: string | undefined } = {
      [process.env.VAULT_GH_USER_ID as string]: process.env.VAULT_GH_2FA_SECRET,
      [process.env.VAULT_GH_USER2_ID as string]:
        process.env.VAULT_GH_USER2_2FA_SECRET,
    };

    const secret = secrets[userid];
    if (!secret) {
      throw new Error("Invalid User ID");
    }

    return authenticator.generate(secret);
  }

  getGoogle2FAOTP(): string {
    const secret = process.env.GOOGLE_2FA_SECRET as string;
    return authenticator.generate(secret);
  }

  async keycloakLogin(username: string, password: string) {
    await this.page.goto("/");
    await this.page.waitForSelector('p:has-text("Sign in using OIDC")');

    const [popup] = await Promise.all([
      this.page.waitForEvent("popup"),
      this.uiHelper.clickButton("Sign In"),
    ]);

    await popup.waitForLoadState("domcontentloaded");

    // Check if popup closes automatically (already logged in)
    try {
      await popup.waitForEvent("close", { timeout: 5000 });
      return "Already logged in";
    } catch {
      // Popup didn't close, proceed with login
    }

    try {
      await popup.locator("#username").click();
      await popup.locator("#username").fill(username);
      await popup.locator("#password").fill(password);
      await popup.locator("[name=login]").click({ timeout: 5000 });
      await popup.waitForEvent("close", { timeout: 2000 });
      return "Login successful";
    } catch (e) {
      const usernameError = popup.locator("id=input-error");
      if (await usernameError.isVisible()) {
        await popup.close();
        return "User does not exist";
      } else {
        throw e;
      }
    }
  }

  private async handleGitHubPopupLogin(
    popup: Page,
    username: string,
    password: string,
    twofactor: string,
  ): Promise<string> {
    await expect(async () => {
      await popup.waitForLoadState("domcontentloaded");
      expect(popup).toBeTruthy();
    }).toPass({
      intervals: [5_000, 10_000],
      timeout: 20 * 1000,
    });

    // Check if popup closes automatically
    try {
      await popup.waitForEvent("close", { timeout: 5000 });
      return "Already logged in";
    } catch {
      // Popup didn't close, proceed with login
    }

    try {
      await popup.locator("#login_field").click({ timeout: 5000 });
      await popup.locator("#login_field").fill(username, { timeout: 5000 });
      const cookieLocator = popup.locator("#wcpConsentBannerCtrl");
      if (await cookieLocator.isVisible()) {
        await popup.click('button:has-text("Reject")', { timeout: 5000 });
      }
      await popup.locator("#password").click({ timeout: 5000 });
      await popup.locator("#password").fill(password, { timeout: 5000 });
      await popup
        .locator("[type='submit'][value='Sign in']:not(webauthn-status *)")
        .first()
        .click({ timeout: 5000 });
      const twofactorcode = authenticator.generate(twofactor);
      await popup.locator("#app_totp").click({ timeout: 5000 });
      await popup.locator("#app_totp").fill(twofactorcode, { timeout: 5000 });

      await popup.waitForEvent("close", { timeout: 20000 });
      return "Login successful";
    } catch (e) {
      const authorization = popup.locator("button.js-oauth-authorize-btn");
      if (await authorization.isVisible()) {
        await authorization.click();
        return "Login successful";
      } else {
        throw e;
      }
    }
  }

  async githubLogin(username: string, password: string, twofactor: string) {
    await this.page.goto("/");
    await this.page.waitForSelector('p:has-text("Sign in using GitHub")');

    const [popup] = await Promise.all([
      this.page.waitForEvent("popup"),
      this.uiHelper.clickButton("Sign In"),
    ]);

    return this.handleGitHubPopupLogin(popup, username, password, twofactor);
  }

  async githubLoginFromSettingsPage(
    username: string,
    password: string,
    twofactor: string,
  ) {
    await this.page.goto("/settings/auth-providers");

    const [popup] = await Promise.all([
      this.page.waitForEvent("popup"),
      this.page.getByTitle("Sign in to GitHub").click(),
      this.uiHelper.clickButton("Log in"),
    ]);

    return this.handleGitHubPopupLogin(popup, username, password, twofactor);
  }
  async microsoftAzureLogin(username: string, password: string) {
    await this.page.goto("/");
    await this.page.waitForSelector('p:has-text("Sign in using Microsoft")');

    const [popup] = await Promise.all([
      this.page.waitForEvent("popup"),
      this.uiHelper.clickButton("Sign In"),
    ]);

    await popup.waitForLoadState("domcontentloaded");

    if (popup.url().startsWith(process.env.RHDH_BASE_URL as string)) {
      // an active microsoft session is already logged in and the popup will automatically close
      return "Already logged in";
    } else {
      try {
        await popup.locator("[name=loginfmt]").click();
        await popup
          .locator("[name=loginfmt]")
          .fill(username, { timeout: 5000 });
        await popup
          .locator('[type=submit]:has-text("Next")')
          .click({ timeout: 5000 });

        await popup.locator("[name=passwd]").click();
        await popup.locator("[name=passwd]").fill(password, { timeout: 5000 });
        await popup
          .locator('[type=submit]:has-text("Sign in")')
          .click({ timeout: 5000 });
        await popup
          .locator('[type=button]:has-text("No")')
          .click({ timeout: 15000 });
        return "Login successful";
      } catch (e) {
        const usernameError = popup.locator("id=usernameError");
        if (await usernameError.isVisible()) {
          return "User does not exist";
        } else {
          throw e;
        }
      }
    }
  }
}

export async function setupBrowser(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext({
    recordVideo: {
      dir: `test-results/${path
        .parse(testInfo.file)
        .name.replace(".spec", "")}/${testInfo.titlePath[1]}`,
      size: { width: 1920, height: 1080 },
    },
  });
  const page = await context.newPage();
  return { page, context };
}
