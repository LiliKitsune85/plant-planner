## 1. Project name
**Plant Planner** – a web application that helps experienced indoor plant collectors keep large collections on schedule through manual plant intake, AI-assisted watering recommendations, and lightweight calendar tracking.

## 2. Project description
Plant Planner focuses on fast manual plant registration plus LLM-powered watering plan suggestions delivered within 5 seconds. Growers capture a species name (with optional nickname, description, purchase date, and photo), review frequency guidance with short justifications, and accept or override plans before they flow straight into monthly and daily calendars. The app tracks confirmations/undos, keeps entries editable, and enforces the 20 AI queries per user per hour limit with clear messaging and manual fallbacks. Secure Supabase-backed auth, double-confirmed account deletion, and compliant storage of minimal user data (email, password, nickname) round out the MVP. See the [Product Requirements Document](./.ai/prd.md) for the full backlog and acceptance criteria.

## 3. Tech stack
- **Frontend:** Astro 5, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, class-variance-authority, clsx, tailwind-merge, tw-animate-css, lucide-react.
- **Backend & data:** Supabase (PostgreSQL, Auth, and SDK clients) acts as the backend-as-a-service and single source of truth for plant, user, and watering data.
- **AI services:** OpenRouter.ai provides access to multiple vision-capable models with budget controls for image-based plant recognition.
- **Tooling & platform:** Node.js 22.14 (see `.nvmrc`), npm, ESLint + Prettier, Husky + lint-staged, GitHub Actions for CI/CD, and DigitalOcean for containerized hosting.
- Additional architectural notes live in [`.ai/tech-stack.md`](./.ai/tech-stack.md).

## 4. Getting started locally
Prerequisites:
- Node.js 22.14.0 (`nvm use` recommended)
- npm 10+ (ships with Node 22)
- Access credentials for Supabase and OpenRouter.ai (environment variable names to be defined during implementation)

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
- `npm run build` – compile the project for production deployment.
- `npm run preview` – serve the production build locally for smoke tests.
- `npm run astro` – access the Astro CLI directly for ad-hoc commands.
- `npm run lint` – run ESLint across `.ts`, `.tsx`, and `.astro` files.
- `npm run lint:fix` – lint with automatic fixes for common issues.
- `npm run format` – apply Prettier (with `prettier-plugin-astro`) to supported files.

## 6. Project scope
- **Core capabilities in scope:**
  - Manual plant intake with mandatory species name, optional metadata (nickname, description, purchase date, photo), and automatic numbering for duplicates.
  - Watering plan generation via LLM within 5 seconds, including frequency guidance and short justification.
  - Approve/reject flow for watering plans with forced custom cadence entry on rejection and immediate calendar updates plus decision logging.
  - Monthly and daily calendar views that refresh on every change, allow confirming/undoing waterings, and support entry edits.
  - Limit enforcement of 20 AI queries per user per hour with upfront messaging, lockout notices, and manual-entry fallback.
  - Account lifecycle and data management: secure auth, double-confirmed account deletion, plant detail editing, and compliant data storage.
- **Explicitly out of scope for the MVP:** photo-based plant recognition, timeline/history views beyond the calendar, reminder notifications, non-watering task tracking, calendar sharing or external integrations, and native/mobile apps.
- User stories US-001 to US-011 in the [PRD](./.ai/prd.md) detail the complete flow coverage for the MVP.

## 7. Project status
- **Status:** In development (MVP planning and implementation).

## 8. API snapshot
- `GET /api/calendar/day` – returns a daily list of watering tasks for the authenticated user. Requires `date=YYYY-MM-DD` and supports optional `status=pending|completed|all` plus `sort=species_name|due_on`, `order=asc|desc` (defaults: `status=all`, `sort=due_on`, `order=asc`). Responses follow the standard `{ data, error, meta }` envelope and include a `meta.request_id` UUID so client logs can be correlated with server logs. See [`.ai/api-plan.md`](./.ai/api-plan.md#readme) for the full contract.
- `GET /api/calendar/month` – returns a per-day task count for the authenticated user’s month view. Requires `month=YYYY-MM` plus optional `status=pending|completed|all` (default `pending`). Responses reuse the `{ data, error, meta }` envelope with a `meta.request_id` UUID, and errors surface as `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, or `500 CALENDAR_MONTH_QUERY_FAILED` if the Supabase aggregate fails.
- `GET /api/plants` – lists a grower’s plants with cursor pagination. Supports optional `q` (1–120 chars, case-insensitive substring search across species name/nickname), `species` (normalized exact match), `sort=created_at|species_name|updated_at` (default `created_at`), `order=asc|desc` (default `desc`), `limit` (1–100, default `20`), and opaque `cursor` tokens generated by previous responses. Returns `data.items` (plant summaries with `display_name`) and `meta.next_cursor`. Errors include `400 INVALID_QUERY_PARAMS`, `401 UNAUTHENTICATED`, and `500 PLANT_LIST_QUERY_FAILED`.
- `POST /api/plants` – creates a plant (auto-numbering duplicates) and can trigger an AI watering suggestion. Body requires `species_name`; optional fields include `nickname`, `description` (<=10k chars), `purchase_date` (`YYYY-MM-DD`), `photo_path` (relative Supabase storage path), and `generate_watering_suggestion` (default `false`). Returns `201 Created`, sets `Location: /api/plants/{id}`, and responds with `{ plant, watering_suggestion }` (currently `status=skipped` until AI suggestions ship). Errors: `400 INVALID_JSON/VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `409 DUPLICATE_INDEX_CONFLICT`, `500 PLANT_CREATE_FAILED`.
- `GET /api/plants/{plantId}` – returns the plant profile plus its active watering plan. Requires a UUID path param owned by the signed-in user; the `PlantDetailDto` response exposes `plant` fields (including `display_name`) and `active_watering_plan` or `null`. Errors bubble as `400 INVALID_PLANT_ID`, `401 UNAUTHENTICATED`, or `404 PLANT_NOT_FOUND`.
- `PATCH /api/plants/{plantId}` – updates editable plant fields (`nickname`, `description`, `purchase_date`, `photo_path`). The JSON body must include at least one field and attempts to change immutable `species_name` are rejected. Responses return the updated `PlantDetailDto`. Errors: `400 INVALID_JSON/INVALID_PLANT_ID`, `401 UNAUTHENTICATED`, `404 PLANT_NOT_FOUND`, `409 IMMUTABLE_FIELD`, `422 VALIDATION_ERROR/NO_FIELDS_TO_UPDATE`, `500 PLANT_UPDATE_FAILED`.
- `DELETE /api/plants/{plantId}` – permanently removes a plant (and cascading plans/tasks). Requires `confirm=true` in the query string plus the UUID path param. Success returns `{ data: { deleted: true, plant_id }, error: null }`. Errors: `400 INVALID_PLANT_ID/CONFIRMATION_REQUIRED`, `401 UNAUTHENTICATED`, `404 PLANT_NOT_FOUND`, `500 PLANT_DELETE_FAILED`.
- `GET /api/plants/{plantId}/watering-plans` – lists watering plan history for a plant. Filters include `active_only=true|false` (default `false`), `sort=valid_from`, `order=asc|desc` (default `desc`), `limit` (default `20`, max `50`), and opaque `cursor` tokens. Returns `data.items` plus `meta.next_cursor`. Errors: `400 INVALID_QUERY_PARAMS/INVALID_CURSOR`, `401 UNAUTHENTICATED`, `404 PLANT_NOT_FOUND`, `500 PLANT_LOOKUP_FAILED/WATERING_PLAN_QUERY_FAILED`.
- `PUT /api/plants/{plantId}/watering-plan` – sets or replaces the active plan (creating a new version and regenerating future tasks). Body requires `interval_days` (1–365), optional `horizon_days` (defaults 90), `schedule_basis=due_on|completed_on`, `start_from=today|purchase_date|custom_date` with `custom_start_on` enforced when needed, `overdue_policy=carry_forward|reschedule`, and a `source` discriminator (`type=manual` or `type=ai` with `ai_request_id` plus `accepted_without_changes`). Success returns `{ plan, tasks_regenerated }`. Errors: `401 UNAUTHENTICATED`, `404 PLANT_NOT_FOUND/AI_REQUEST_NOT_FOUND`, `422 VALIDATION_ERROR`, `409 PLAN_CONFLICT`, `500 SET_WATERING_PLAN_FAILED/TASK_REGENERATION_FAILED`.
- `GET /api/watering-tasks` – exposes a raw task list for debugging/timelines. Supports filters `from`/`to` (`YYYY-MM-DD`, max 366-day range, `from` ≤ `to`), `plant_id`, `status=pending|completed`, `source=scheduled|adhoc` (cannot combine `source=adhoc` with `status=pending`), `sort=due_on|created_at`, `order=asc|desc`, `limit` (default `50`, max `100`), and `cursor`. Responses include `data.items` plus `meta.request_id` and `meta.next_cursor`. Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `500 WATERING_TASKS_QUERY_FAILED`.
- `PATCH /api/watering-tasks/{taskId}` – edits an entry’s `status`, `completed_on`, and/or `note`. At least one field is required; `completed_on` must accompany `status=completed`, undoing a scheduled completion resets timestamps, and adhoc tasks may only remain `completed`. Returns `{ task, schedule_effect }` with `meta.request_id`. Errors: `400 INVALID_JSON/INVALID_TASK_ID`, `401 UNAUTHENTICATED`, `404 WATERING_TASK_NOT_FOUND`, `409 CONSTRAINT_VIOLATION/WATERING_PLAN_NOT_FOUND`, `422 VALIDATION_ERROR`, `500 UPDATE_WATERING_TASK_FAILED`.
- `POST /api/plants/{plantId}/watering/adhoc` – records a same-day, already-completed watering entry when a grower waters outside of their active plan. Requires auth plus a JSON body with `completed_on` (`YYYY-MM-DD`) and optional `note` (<=500 chars, trimmed to `null`). Success returns `201 Created`, a `Location: /api/watering-tasks/{taskId}` header, and `data.task` mirroring `watering_tasks` summary fields. Error codes: `400 INVALID_JSON/VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 PLANT_NOT_FOUND`, `409 TASK_ALREADY_EXISTS`, and `500` variants logged with `meta.request_id`.
- `DELETE /api/watering-tasks/{taskId}` – removes a watering log. Requires auth, a UUID path param, and the safety guard `confirm=true` query string; requests without the literal `confirm=true` are rejected with `400 CONFIRMATION_REQUIRED`. For `source=adhoc` tasks the row is hard-deleted; for `source=scheduled` tasks the handler only accepts `status=completed` rows and instead resets them to `pending` (clearing `completed_on`, `completed_at`, and `note`) to keep the schedule intact. Responses follow the `{ data, error, meta }` envelope with `meta.request_id` in both success and error cases so clients can correlate logs with server output. Success returns `{ data: { deleted: true, task_id }, error: null }`. Errors include `400 INVALID_TASK_ID`, `401 UNAUTHENTICATED`, `404 TASK_NOT_FOUND`, `409 NOT_ALLOWED` when undoing a non-completed scheduled task, and `500` variants for Supabase failures or inconsistent task states.

## 9. License
This project is licensed under the MIT License.