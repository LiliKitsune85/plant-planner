import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const extractPlantIdFromUrl = (url: string) => {
  const match = url.match(/\/plants\/([0-9a-f-]{36})\//i);
  return match?.[1] ?? null;
};

export const deletePlantById = async (params: { request: APIRequestContext; plantId: string }) => {
  const response = await params.request.delete(`/api/plants/${params.plantId}?confirm=true`);
  expect(response.status(), "plant delete response status").toBe(200);
  const payload = await response.json();
  expect(payload?.data?.deleted).toBe(true);
};

export const cleanupPlantFromPage = async (page: Page) => {
  const plantId = extractPlantIdFromUrl(page.url());
  if (!plantId) {
    throw new Error("Unable to determine plantId from current URL");
  }
  await deletePlantById({ request: page.request, plantId });
};
