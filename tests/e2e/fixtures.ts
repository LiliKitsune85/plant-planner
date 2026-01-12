import { expect } from "@playwright/test";

export interface E2ECredentials {
  email: string;
  password: string;
  userId?: string;
}

export const getE2ECredentials = (): E2ECredentials => {
  const email = process.env.E2E_USERNAME?.trim() ?? process.env.E2E_USER_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim() ?? process.env.E2E_USER_PASSWORD?.trim();
  const userId = process.env.E2E_USERNAME_ID?.trim();

  expect(email, "Set E2E_USERNAME (or legacy E2E_USER_EMAIL) in .env.test").toBeTruthy();
  expect(password, "Set E2E_PASSWORD (or legacy E2E_USER_PASSWORD) in .env.test").toBeTruthy();

  if (!email || !password) {
    throw new Error("Missing E2E credentials. Set E2E_USERNAME and E2E_PASSWORD in .env.test.");
  }

  return { email, password, userId };
};
