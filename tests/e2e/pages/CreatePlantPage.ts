import type { Locator, Page } from '@playwright/test'
import { BasePage } from './BasePage'

export class CreatePlantPage extends BasePage {
  readonly speciesNameInput: Locator
  readonly aiToggleSwitch: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    super(page)
    this.speciesNameInput = page.getByTestId('create-plant-species')
    this.aiToggleSwitch = page.getByTestId('create-plant-ai-toggle')
    this.submitButton = page.getByTestId('create-plant-submit')
  }

  async goto() {
    await super.goto('/plants/new')
  }

  async waitForLoad() {
    await this.speciesNameInput.waitFor()
  }

  async disableAiIfEnabled() {
    const ariaChecked = await this.aiToggleSwitch.getAttribute('aria-checked')
    if (ariaChecked === 'true') {
      await this.aiToggleSwitch.click()
    }
  }

  async createPlant(params: { speciesName: string }) {
    await this.speciesNameInput.fill(params.speciesName)
    await this.submitButton.click()
    await this.page.waitForURL(/\/plants\/[0-9a-f-]{36}\/watering-plan/)
  }
}
