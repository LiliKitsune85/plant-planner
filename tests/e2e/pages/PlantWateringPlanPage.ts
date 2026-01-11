import type { Locator, Page } from '@playwright/test'

export class PlantWateringPlanPage {
  readonly heading: Locator
  readonly speciesLine: Locator

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /Ustaw plan podlewania/i })
    this.speciesLine = page.getByText(/Na podstawie preferencji gatunku:/i)
  }

  async waitForLoad() {
    await this.heading.waitFor()
  }
}
