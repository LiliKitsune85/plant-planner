import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class LoginPage extends BasePage {
  readonly heading: Locator;
  readonly cardTitle: Locator;
  readonly submitButton: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", {
      name: /Witaj ponownie w Plant Planner/i,
    });
    this.cardTitle = page.locator('[data-slot="card-title"]').filter({ hasText: /Zaloguj się/i });
    this.submitButton = page.getByRole("button", { name: /Zaloguj się/i });
    this.emailInput = page.getByTestId("auth-email-input");
    this.passwordInput = page.getByTestId("auth-password-input");
  }

  async goto(returnTo = "/calendar") {
    const params = new URLSearchParams();
    params.set("returnTo", returnTo);
    await super.goto(`/auth/login?${params.toString()}`);
  }

  async signIn(email: string, password: string, expectedRedirect: string | RegExp = "/plants") {
    // Astro hydrates React islands asynchronously (client:load). If we submit before hydration,
    // the SSR form has no onSubmit handler and the browser will just reload the login page.
    // Waiting for the SignInForm island to hydrate prevents redirect loops/timeouts in E2E.
    await this.page.waitForSelector('astro-island[component-url$="/src/components/auth/SignInForm.tsx"]:not([ssr])', {
      timeout: 10_000,
    });

    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    if (expectedRedirect instanceof RegExp) {
      await this.page.waitForURL(expectedRedirect, { waitUntil: "domcontentloaded" });
      return;
    }
    const expectedPattern = expectedRedirect.startsWith("/")
      ? `**${expectedRedirect}${expectedRedirect.endsWith("/") ? "" : "**"}`
      : expectedRedirect;
    await this.page.waitForURL(expectedPattern, { waitUntil: "domcontentloaded" });
  }
}
