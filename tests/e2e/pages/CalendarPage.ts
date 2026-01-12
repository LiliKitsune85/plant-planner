import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class CalendarPage extends BasePage {
  readonly addPlantLink: Locator;

  constructor(page: Page) {
    super(page);
    // AppShell renders two "Dodaj roślinę" links (sidebar + header).
    // We target the header one to keep the locator unique regardless of main content state.
    this.addPlantLink = page.locator("header").getByRole("link", { name: /Dodaj roślinę/i });
  }

  async goto() {
    await super.goto("/calendar");
  }

  async waitForLoad() {
    await this.page.waitForURL(/\/calendar(\/|$)/);
    await this.addPlantLink.waitFor();
  }

  async startCreatePlantFlow() {
    await this.addPlantLink.click();
    await this.page.waitForURL("**/plants/new");
  }
}
