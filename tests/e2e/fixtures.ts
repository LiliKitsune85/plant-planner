import { expect } from '@playwright/test'

export type E2ECredentials = {
  email: string
  password: string
  userId?: string
}

export const getE2ECredentials = (): E2ECredentials => {
  const email = process.env.E2E_USERNAME?.trim() ?? process.env.E2E_USER_EMAIL?.trim()
  const password = process.env.E2E_PASSWORD?.trim() ?? process.env.E2E_USER_PASSWORD?.trim()
  const userId = process.env.E2E_USERNAME_ID?.trim()

  expect(email, 'Set E2E_USERNAME (or legacy E2E_USER_EMAIL) in .env.test').toBeTruthy()
  expect(password, 'Set E2E_PASSWORD (or legacy E2E_USER_PASSWORD) in .env.test').toBeTruthy()

  return { email: email!, password: password!, userId }
}
