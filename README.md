## 1. Project name
**Plant Planner** – a web application for managing indoor plants and keeping watering schedules on track (calendar views + watering plans).

## 2. Project description
Plant Planner is an **Astro + React** app backed by **Supabase** (PostgreSQL + Auth). The current codebase includes:

- **Auth**: sign-up/sign-in flows with Supabase sessions and protected UI routes (`/calendar`, `/plants`, `/settings`).
- **Plants**: create/list/detail/edit/delete.
- **Watering**: watering plans (manual set/replace + history), scheduled tasks and ad-hoc waterings.
- **Calendar**: month/day views backed by API routes.
- **AI (optional)**: watering plan suggestion via OpenRouter with quota/rate-limit handling.

Specs and supporting docs live in:
- [Product Requirements Document](./.ai/prd.md)
- [API contract notes](./.ai/api-plan.md)
- [Test plan](./.ai/test-plan.md)

## 3. Tech stack
- **Frontend:** Astro 5, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, class-variance-authority, clsx, tailwind-merge, tw-animate-css, lucide-react.
- **Backend & data:** Astro API routes + Supabase (PostgreSQL, Auth, and SDK clients) as the source of truth for plant and watering data.
- **AI services (optional):** OpenRouter.ai (chat completions) for watering plan suggestions.
- **Tooling & platform:** Node.js 22.14 (see `.nvmrc`), npm, ESLint + Prettier, Husky + lint-staged, GitHub Actions for CI/CD. The app uses the Astro Node adapter (`@astrojs/node`) with `output: "server"`.
- **Testing:** Vitest covers unit/contract suites while Playwright drives end-to-end UI regression scenarios (see `.ai/test-plan.md` for scope).
- Additional architectural notes live in [`.ai/tech-stack.md`](./.ai/tech-stack.md).

## 4. Getting started locally
Prerequisites:
- Node.js 22.14.0 (`nvm use` recommended)
- npm 10+ (ships with Node 22)

Environment:
- Duplicate `.env.example` into `.env` and fill in the required values (the app reads `import.meta.env.*`).
- Required variables (see `src/env.d.ts`):
  - `SUPABASE_URL`
  - `SUPABASE_KEY` (anon/public key)
  - `SUPABASE_SERVICE_ROLE_KEY` (required for server-side admin operations like sign-up and AI-backed flows)
- Optional AI variables:
  - `OPENROUTER_API_KEY` (required if you want AI suggestions to work)
  - `OPENROUTER_MODEL` (defaults to `openai/gpt-4o-mini`)
- Optional:
  - `APP_BASE_URL` (used as provider metadata; defaults to `https://plant-planner.app`)

Setup steps:
```bash
git clone https://github.com/<org>/plant-planner.git
cd plant-planner
nvm use 22.14.0
npm install
npm run dev
```

Common tasks:
- `npm run build` – generate a production build.
- `npm run preview` – preview the built site locally.
- `npm run lint` / `npm run lint:fix` – run ESLint and auto-fix issues.
- `npm run format` – format the codebase with Prettier (Astro plugin included).

## 5. Available scripts
- `npm run dev` – start the Astro dev server with React-enabled islands.
- `npm run dev:e2e` – start the dev server in `--mode test` (used by Playwright’s `webServer`).
- `npm run build` – compile the project for production deployment.
- `npm run preview` – serve the production build locally for smoke tests.
- `npm run astro` – access the Astro CLI directly for ad-hoc commands.
- `npm run lint` – run ESLint across `.ts`, `.tsx`, and `.astro` files.
- `npm run lint:fix` – lint with automatic fixes for common issues.
- `npm run format` – apply Prettier (with `prettier-plugin-astro`) to supported files.
- `npm run test` / `npm run test:unit` – execute the Vitest suite once (CI mode).
- `npm run test:unit:watch` – watch files locally with instant `vi.*` feedback.
- `npm run test:unit:ui` – open the Vitest UI dashboard for debugging.
- `npm run test:e2e` – run Chromium-only Playwright checks against the dev server.
- `npm run test:e2e:headed` – run the same suite with a visible Chrome window.
- `npm run test:e2e:ui` – triage and rerun scenarios via Playwright UI mode.
- `npm run test:e2e:codegen` – bootstrap new journeys with the code generator.
- `npm run test:e2e:trace` – inspect the latest `trace.zip` in the trace viewer.
- `npm run test:e2e:install` – download/update the Chromium binary Playwright needs.

## 6. Testing workflow
### Unit tests (Vitest)
- Tests live alongside source files as `*.test.ts(x)`/`*.spec.ts(x)` and run under jsdom by default so React components can rely on the DOM, while `src/lib`/`src/db` specs automatically switch to the Node runtime.
- Shared setup happens in `src/tests/setup-vitest.ts`, which registers `@testing-library/jest-dom` matchers and cleans up React trees after each test.
- Use the commands above (`test:unit`, `test:unit:watch`, `test:unit:ui`) plus the `vi` helpers, inline snapshots, and typed mocks described in `.cursor/rules/vitest.mdc`.
- Coverage is configured via `vitest.config.ts` (`v8` provider, `coverage/unit` output) so it can be enabled in CI without extra wiring.

### End-to-end tests (Playwright)
- `playwright.config.ts` keeps the suite Chromium-only (Desktop Chrome channel) and boots the Astro dev server automatically via `npm run dev:e2e`. By default it uses port `4321` and `baseURL` `http://127.0.0.1:<port>` (important on Windows to avoid IPv6 `localhost` issues).
- Override defaults with `PLAYWRIGHT_BASE_URL` or `PLAYWRIGHT_DEV_PORT` when needed.
- Page Object Models live in `tests/e2e/pages` and are consumed by spec files such as `tests/e2e/smoke.spec.ts`, which already includes a visual check via `expect(page).toHaveScreenshot()`.
- Snapshot files are OS-dependent. If CI fails on Linux due to a snapshot mismatch, re-generate snapshots in a Linux Playwright container (to match GitHub Actions), e.g.:
  - `docker run --rm -v ${PWD}:/work -w /work --env-file .env.test mcr.microsoft.com/playwright:v1.57.0-jammy bash -lc "npm ci && npx playwright test tests/e2e/smoke.spec.ts --update-snapshots"`
- Run `npm run test:e2e:install` once to grab the browser binary, then use `test:e2e`, `test:e2e:headed`, or `test:e2e:ui` for day-to-day work. `test:e2e:codegen` and `test:e2e:trace` tie into Playwright’s codegen and trace viewer utilities.
- Each test gets an isolated browser context by default, and traces/screenshots/videos are retained on failure inside `tests/.output` for debugging.
- **Preparing `.env.test` for E2E:**
  1. Duplicate the provided template:
     - macOS/Linux: `cp env.test.example .env.test`
     - PowerShell: `Copy-Item env.test.example .env.test`
  2. Fill in `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
  3. In Supabase Dashboard → **Authentication → Users**, create a dedicated QA account for E2E (e.g. `qa-e2e@example.com`).
  4. Place those credentials into `.env.test` as `E2E_USERNAME` / `E2E_PASSWORD` (and optionally `E2E_USERNAME_ID`).
  5. Keep `.env.test` out of version control; Playwright loads it via `playwright.config.ts` and tests fail fast when variables are missing.

## 7. Project structure (src)
- `src/pages/` – Astro routes (UI):
  - `src/pages/index.astro` redirects to `/calendar` (or `/auth/login` when unauthenticated).
  - `src/pages/auth/*` – login/register/reset-password flows.
  - `src/pages/plants/*` – list/create/detail/edit/delete and watering plan screens.
  - `src/pages/calendar/*` – month and day views.
  - `src/pages/settings/index.astro` – user settings.
- `src/pages/api/` – API routes (server endpoints):
  - `auth`: `POST /api/auth/sign-in`, `POST /api/auth/sign-up`, `POST /api/auth/sign-out` (redirect response).
  - `plants`: `GET/POST /api/plants`, `GET/PATCH/DELETE /api/plants/:plantId`
  - `watering plans`: `PUT /api/plants/:plantId/watering-plan`, `POST /api/plants/:plantId/watering-plan/suggest`, `GET /api/plants/:plantId/watering-plans`
  - `watering tasks`: `GET /api/watering-tasks`, `PATCH/DELETE /api/watering-tasks/:taskId`, `POST /api/plants/:plantId/watering/adhoc`
  - `calendar`: `GET /api/calendar/day`, `GET /api/calendar/month`
  - `ai`: `GET /api/ai/quota`
- `src/components/` – React UI components grouped by feature (`auth`, `plants`, `calendar`, `watering-plan`) plus shared UI in `src/components/ui/`.
- `src/components/hooks/` – feature hooks (data fetching/mutations and view-model helpers).
- `src/lib/` – domain logic:
  - `src/lib/api/` request parsing/validation (Zod) and helpers
  - `src/lib/services/` service layer (plants/calendar/watering/ai)
  - `src/lib/http/errors.ts` unified HTTP error type used by API routes
  - `src/lib/logger.ts` server/client logging helpers
- `src/db/` – Supabase clients and generated DB types.
- `src/middleware/index.ts` – Supabase SSR client + auth gating for private routes.
- `src/types.ts` – shared DTOs and domain types.

## 8. Project status
- **Status:** In development (MVP implementation).

## 9. Database & Supabase
- **Supabase schema/migrations** live under `supabase/migrations/`.
- **Supabase clients**:
  - `src/db/supabase.client.ts` – anon client used by UI/server routes.
  - `src/db/supabase.admin.ts` – service-role client used for server-side admin operations (never expose the key to the browser).

If you use the Supabase CLI for local development, keep in mind the repository currently references a seed file in `supabase/config.toml`, but `supabase/seed.sql` is not present in this workspace.

## 10. License
This project is licensed under the MIT License.
