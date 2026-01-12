import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class CreatePlantPage extends BasePage {
  readonly speciesNameInput: Locator;
  readonly aiToggleSwitch: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.speciesNameInput = page.getByTestId("create-plant-species");
    this.aiToggleSwitch = page.getByTestId("create-plant-ai-toggle");
    this.submitButton = page.getByTestId("create-plant-submit");
  }

  async goto() {
    await super.goto("/plants/new");
  }

  async waitForLoad() {
    // CreatePlantView is a React island (client:load). The SSR markup renders a disabled submit button
    // and controlled inputs that won't update app state until hydration completes.
    // Wait for the island to hydrate by ensuring the field is inside an island without the `ssr` attribute.
    await this.page.waitForSelector('astro-island:not([ssr]) [data-testid="create-plant-species"]');
    await this.speciesNameInput.waitFor();
  }

  async disableAiIfEnabled() {
    await this.waitForLoad();
    const ariaChecked = await this.aiToggleSwitch.getAttribute("aria-checked");
    if (ariaChecked === "true") {
      await this.aiToggleSwitch.click();
      await this.page.waitForSelector('[data-testid="create-plant-ai-toggle"][aria-checked="false"]');
    }
  }

  async createPlant(params: { speciesName: string }) {
    await this.waitForLoad();
    await this.speciesNameInput.fill(params.speciesName);
    // Submit becomes enabled only after the controlled input updates React state.
    await this.page.waitForSelector('[data-testid="create-plant-submit"]:not([disabled])');
    await this.submitButton.click();
    await this.page.waitForURL(/\/plants\/[0-9a-f-]{36}\/watering-plan/);
  }
}
