import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages";

test.describe("Authentication smoke checks", () => {
  test("redirected users can reach the login page", async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();

    await expect(loginPage.heading).toBeVisible();
    await expect(loginPage.cardTitle).toContainText("Zaloguj się");
    await expect(loginPage.submitButton).toBeEnabled();
    // Snapshot only the stable UI element (card), not the whole page background.
    await expect(loginPage.card).toHaveScreenshot("login-page.png");
  });
});
