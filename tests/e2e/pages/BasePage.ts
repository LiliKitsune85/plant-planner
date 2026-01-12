import type { Page } from "@playwright/test";

export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  async goto(pathname: string) {
    await this.page.goto(pathname);
  }
}
