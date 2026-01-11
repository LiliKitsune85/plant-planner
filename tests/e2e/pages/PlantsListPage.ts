import type { Locator, Page } from '@playwright/test'
import { BasePage } from './BasePage'

export class PlantsListPage extends BasePage {
  readonly heading: Locator
  readonly addPlantButton: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.getByRole('heading', { name: /Twoje rośliny/i, level: 1 })
    this.addPlantButton = page.getByTestId('plants-add-plant-button')
  }

  async goto() {
    await super.goto('/plants')
  }

  async waitForLoad() {
    await this.heading.waitFor()
  }

  async startCreateFlow() {
    await this.addPlantButton.click()
    await this.page.waitForURL('**/plants/new')
  }
}
