import { expect, test } from "@playwright/test";
import { getE2ECredentials } from "./fixtures";
import { CalendarPage, CreatePlantPage, LoginPage, PlantWateringPlanPage } from "./pages";
import { cleanupPlantFromPage } from "./utils";

test.describe("Create plant flow", () => {
  test("US-001: creates plant manually and reaches watering plan", async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginPage = new LoginPage(page);
    const calendarPage = new CalendarPage(page);
    const createPlantPage = new CreatePlantPage(page);
    const wateringPlanPage = new PlantWateringPlanPage(page);
    const credentials = getE2ECredentials();
    const speciesName = `E2E Sansevieria ${Date.now()}`;

    await test.step("Arrange: login user redirected to calendar", async () => {
      await loginPage.goto("/calendar");
      await loginPage.signIn(credentials.email, credentials.password, "/calendar");
      await calendarPage.waitForLoad();
    });

    await test.step("Act: navigate from calendar to create plant page", async () => {
      await calendarPage.startCreatePlantFlow();
      await createPlantPage.waitForLoad();
    });

    await test.step("Act: create plant with AI disabled", async () => {
      await createPlantPage.disableAiIfEnabled();
      await createPlantPage.createPlant({ speciesName });
    });

    await test.step("Assert: redirected to watering plan view", async () => {
      await wateringPlanPage.waitForLoad();
      await expect(page).toHaveURL(/\/plants\/[0-9a-f-]{36}\/watering-plan/);
      await expect(wateringPlanPage.heading).toBeVisible();
      await expect(wateringPlanPage.speciesLine).toContainText(speciesName);
    });

    await test.step("Cleanup: delete created plant", async () => {
      await cleanupPlantFromPage(page);
      await context.close();
    });
  });
});
