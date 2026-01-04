# REST API Plan

This document proposes a REST API for the **Plant Planner** MVP, based on the current Supabase/Postgres schema and PRD. The API is designed to be implemented as **Astro API routes** (`src/pages/api/**`) and backed by **Supabase** (Postgres + Auth + Storage), with **OpenRouter** used server-side for AI suggestions.

## Conventions (applies to all endpoints)

- **Base URL**: `/api`
- **Auth**: `Authorization: Bearer <supabase_access_token>` (or Supabase SSR cookies via Astro middleware). All endpoints below require authentication unless explicitly marked otherwise.
- **Content-Type**: `application/json`
- **Response envelope** (recommended):

```json
{
  "data": {},
  "error": null,
  "meta": {}
}
```

- **Pagination** (list endpoints):
  - `limit` (default 20, max 100)
  - Cursor pagination: `cursor` (opaque) OR `before`/`after` using `(created_at,id)`; choose one implementation consistently.
  - Cursor metadata is returned via the response `meta` object (e.g. `meta.next_cursor`), while `data.items` always contains only the DTO list defined in `src/types.ts`.
  - Sorting: `sort` with allowed values per endpoint (e.g. `created_at`, `due_on`), `order=asc|desc`.
- **Date formats**:
  - `date`: `YYYY-MM-DD` (maps to Postgres `date`, e.g. `due_on`, `completed_on`)
  - `datetime`: ISO 8601 (maps to `timestamptz`, e.g. `completed_at`)
- **Error shape** (recommended):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": { "field": "reason" }
  }
}
```
- **Contract note**: pola elementów listy są w 100% zgodne z odpowiadającymi im DTO z `src/types.ts` (np. `PlantListItemDto = PlantSummaryDto`). Przykłady mogą pomijać wartości `null` wyłącznie dla czytelności.

- **Security defaults**:
  - HTTPS only (enforced at hosting/proxy level)
  - Default-deny at DB via Supabase RLS; server endpoints use the user’s JWT or service role as needed.
  - AI quota enforced server-side; `ai_requests` are **never inserted from the client**.

---

## 1. Zasoby

- **Account / Profile** → `public.profiles` (plus `auth.users` managed by Supabase Auth)
- **Plants** → `public.plants`
- **Watering plans (versioned)** → `public.watering_plans`
- **Watering tasks (calendar entries)** → `public.watering_tasks`
- **AI usage / quota (audit)** → `public.ai_requests` (read-only for the user; insert server-side only)
- **Storage (photos)** → Supabase Storage (paths stored in `plants.photo_path`)

---

## 2. Punkty końcowe

### 2.1 Health / meta

#### GET `/api/health`
- **Opis**: Health check for deployment/proxy; does not require auth.
- **Response 200**:

```json
{
  "data": { "status": "ok" },
  "error": null,
  "meta": {}
}
```

---

### 2.2 Authentication (Supabase Auth)

> Prefer using Supabase Auth directly from the frontend (email/password + email verification) and only use REST endpoints below for app data. If you choose to wrap Auth in REST, keep it minimal and proxy to Supabase Auth.

#### POST `/api/auth/sign-up` (optional wrapper)
- **Opis**: Create account (email + password) and set nickname/timezone profile.
- **Request**:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "nickname": "Lidia",
  "timezone": "Europe/Warsaw"
}
```

- **Response 201**:

```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com" },
    "profile": { "user_id": "uuid", "nickname": "Lidia", "timezone": "Europe/Warsaw" }
  },
  "error": null,
  "meta": { "email_verification_required": true }
}
```

- **Errors**:
  - `400 AUTH_INVALID_INPUT`
  - `409 AUTH_EMAIL_IN_USE`

#### POST `/api/auth/sign-in` (optional wrapper)
- **Opis**: Sign in with email/password; returns session tokens (or sets cookies in SSR mode).
- **Request**:

```json
{ "email": "user@example.com", "password": "StrongPassword123!" }
```

- **Response 200**:

```json
{
  "data": { "access_token": "jwt", "refresh_token": "jwt", "expires_in": 3600 },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 AUTH_INVALID_CREDENTIALS`
  - `403 AUTH_EMAIL_NOT_CONFIRMED`

#### POST `/api/auth/sign-out` (optional wrapper)
- **Opis**: Revoke session / clear SSR cookies.
- **Response 204**: no body.

---

### 2.3 Profile (Account settings)

#### GET `/api/me`
- **Opis**: Returns authenticated user’s profile and basic account metadata.
- **Query params**: none
- **Response 200**:

```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com" },
    "profile": { "user_id": "uuid", "nickname": "Lidia", "timezone": "Europe/Warsaw" }
  },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`

#### PATCH `/api/me/profile`
- **Opis**: Update profile fields.
- **Request**:

```json
{
  "nickname": "New Nickname",
  "timezone": "Europe/Warsaw"
}
```

- **Response 200**:

```json
{
  "data": { "user_id": "uuid", "nickname": "New Nickname", "timezone": "Europe/Warsaw" },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `422 VALIDATION_ERROR`

---

### 2.4 Plants

#### GET `/api/plants`
- **Opis**: List user’s plants.
- **Query params**:
  - `q` (search in `species_name`/`nickname`, server-side ILIKE)
  - `species` (exact/normalized match)
  - `sort` = `created_at|species_name|updated_at`
  - `order` = `asc|desc`
  - `limit`, `cursor`
- **Response 200**:

```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "species_name": "Monstera deliciosa",
        "duplicate_index": 0,
        "display_name": "Monstera deliciosa #1",
        "nickname": "Big one",
        "description": null,
        "purchase_date": "2025-12-12",
        "photo_path": "plants/uuid/photo.jpg",
        "created_source": "manual",
        "created_at": "2026-01-03T12:00:00Z",
        "updated_at": "2026-01-03T12:00:00Z"
      }
    ]
  },
  "error": null,
  "meta": { "next_cursor": "opaque" }
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`

#### POST `/api/plants`
- **Opis**: Create plant; automatically numbers duplicates per user (sets `duplicate_index`). Can optionally trigger AI suggestion as part of the flow.
- **Request**:

```json
{
  "species_name": "Monstera deliciosa",
  "nickname": "Big one",
  "description": "Near the window",
  "purchase_date": "2025-12-12",
  "photo_path": null,
  "generate_watering_suggestion": true
}
```

- **Response 201**:

```json
{
  "data": {
    "plant": {
      "id": "uuid",
      "species_name": "Monstera deliciosa",
      "duplicate_index": 0,
      "display_name": "Monstera deliciosa #1",
      "nickname": "Big one",
      "purchase_date": "2025-12-12",
      "photo_path": null,
      "created_source": "manual"
    },
    "watering_suggestion": {
      "status": "available",
      "ai_request_id": "uuid",
      "interval_days": 7,
      "horizon_days": 90,
      "schedule_basis": "completed_on",
      "start_from": "today",
      "custom_start_on": null,
      "overdue_policy": "carry_forward",
      "explanation": "Short AI explanation or source shown to user (not stored in DB)."
    }
  },
  "error": null,
  "meta": {}
}
```

- **Notes**:
  - If AI quota is exceeded, the plant is still created and `watering_suggestion.status` becomes `rate_limited` with an `unlock_at` timestamp.
- **Errors**:
  - `401 UNAUTHENTICATED`
  - `422 VALIDATION_ERROR` (e.g. species_name length)
  - `409 CONFLICT` (rare race on duplicate numbering; server should retry)

#### GET `/api/plants/{plantId}`
- **Opis**: Get plant details (including active plan summary).
- **Response 200**:

```json
{
  "data": {
    "plant": {
      "id": "uuid",
      "species_name": "Monstera deliciosa",
      "duplicate_index": 0,
      "display_name": "Monstera deliciosa #1",
      "nickname": "Big one",
      "description": null,
      "purchase_date": "2025-12-12",
      "photo_path": null
    },
    "active_watering_plan": {
      "id": "uuid",
      "interval_days": 7,
      "horizon_days": 90,
      "schedule_basis": "completed_on",
      "start_from": "today",
      "custom_start_on": null,
      "overdue_policy": "carry_forward",
      "was_ai_suggested": true,
      "was_ai_accepted_without_changes": true
    }
  },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`

#### PATCH `/api/plants/{plantId}`
- **Opis**: Update optional plant fields. `species_name` is immutable in MVP.
- **Request**:

```json
{
  "nickname": "Updated Nickname",
  "description": "Updated description",
  "purchase_date": "2025-12-12",
  "photo_path": "plants/uuid/photo.jpg"
}
```

- **Response 200**: returns updated plant.
- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `422 VALIDATION_ERROR`
  - `409 IMMUTABLE_FIELD` (if client tries to change `species_name`)

#### DELETE `/api/plants/{plantId}`
- **Opis**: Permanently delete a plant and all its plans/tasks (cascades). Requires explicit confirmation.
- **Query params**:
  - `confirm=true` (required)
- **Response 200**:

```json
{
  "data": { "deleted": true, "plant_id": "uuid" },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `400 CONFIRMATION_REQUIRED`

---

### 2.5 Plant photos (Supabase Storage)

#### POST `/api/plants/{plantId}/photo/upload-url`
- **Opis**: Returns a signed upload URL (or instructions) to upload a photo to Supabase Storage, then store `photo_path` on the plant.
- **Request**:

```json
{ "content_type": "image/jpeg", "filename": "photo.jpg" }
```

- **Response 200**:

```json
{
  "data": {
    "upload": {
      "method": "PUT",
      "url": "https://signed-upload-url",
      "headers": { "Content-Type": "image/jpeg" },
      "expires_in": 60
    },
    "photo_path": "plants/{plantId}/photo.jpg"
  },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `422 VALIDATION_ERROR`

---

### 2.6 AI quota + watering plan suggestion

#### GET `/api/ai/quota`
- **Opis**: Returns AI request limits and current usage (20 requests/hour per user).
- **Response 200**:

```json
{
  "data": {
    "limit_per_hour": 20,
    "used_in_current_window": 3,
    "remaining": 17,
    "window_resets_at": "2026-01-03T13:00:00Z",
    "is_rate_limited": false,
    "unlock_at": null
  },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`

#### POST `/api/plants/{plantId}/watering-plan/suggest`
- **Opis**: Calls OpenRouter server-side to suggest a watering plan for this plant. Creates an `ai_requests` audit row and enforces quota. Returns suggestion + short explanation (not persisted).
- **Request**:

```json
{
  "context": {
    "species_name": "Monstera deliciosa"
  }
}
```

- **Response 200** (suggestion available):

```json
{
  "data": {
    "ai_request_id": "uuid",
    "suggestion": {
      "interval_days": 7,
      "horizon_days": 90,
      "schedule_basis": "completed_on",
      "start_from": "today",
      "custom_start_on": null,
      "overdue_policy": "carry_forward"
    },
    "explanation": "Short justification/source shown to user (not stored)."
  },
  "error": null,
  "meta": { "response_time_budget_ms": 5000 }
}
```

- **Response 429** (rate-limited):

```json
{
  "data": {
    "ai_request_id": "uuid",
    "suggestion": null
  },
  "error": {
    "code": "AI_RATE_LIMITED",
    "message": "AI quota exceeded. You can still add plants without AI.",
    "details": { "unlock_at": "2026-01-03T13:00:00Z" }
  },
  "meta": { "limit_per_hour": 20 }
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `408 AI_TIMEOUT` (if upstream exceeds budget; server should mark `ai_requests.status='error'`)
  - `502 AI_PROVIDER_ERROR`

---

### 2.7 Watering plans (set/accept/reject; versioned)

> Mutations should be transactional and typically implemented via a server-side RPC or a server endpoint that performs: deactivate old plan → insert new plan → regenerate future pending tasks (90-day horizon by default).

#### GET `/api/plants/{plantId}/watering-plans`
- **Opis**: List watering plan history for a plant (versions).
- **Query params**:
  - `active_only=true|false` (default false)
  - `sort=valid_from` (only allowed value for now)
  - `order=asc|desc` (default `desc`)
  - `limit` (default 20, max 50)
  - `cursor` (optional) – Base64URL-encoded JSON payload `{"valid_from":"ISO8601","id":"uuid"}` representing the first record of the next page (keyset pagination on `(valid_from,id)`).
- **Response 200**:

```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "is_active": true,
        "valid_from": "2026-01-03T12:00:00Z",
        "valid_to": null,
        "interval_days": 7,
        "horizon_days": 90,
        "schedule_basis": "completed_on",
        "start_from": "today",
        "custom_start_on": null,
        "overdue_policy": "carry_forward",
        "was_ai_suggested": true,
        "was_ai_accepted_without_changes": true,
        "ai_request_id": "uuid"
      }
    ]
  },
  "error": null,
  "meta": { "next_cursor": "opaque" }
}
```
- **Notes**:
  - Results are ordered by `valid_from` + `id` to keep pagination stable for both ascending and descending sorts.
  - `meta.next_cursor` is only returned when the page contains `limit` items; clients should treat it as opaque and pass it back unchanged.

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `400 INVALID_QUERY_PARAMS` / `INVALID_CURSOR`

#### PUT `/api/plants/{plantId}/watering-plan`
- **Opis**: Set the plant’s current active watering plan (creates a new plan version, deactivates previous, regenerates tasks).
- **Request**:

```json
{
  "interval_days": 7,
  "horizon_days": 90,
  "schedule_basis": "completed_on",
  "start_from": "today",
  "custom_start_on": null,
  "overdue_policy": "carry_forward",
  "source": {
    "type": "ai",
    "ai_request_id": "uuid",
    "accepted_without_changes": true
  }
}
```

- **Response 200**:

```json
{
  "data": {
    "plan": {
      "id": "uuid",
      "is_active": true,
      "interval_days": 7,
      "horizon_days": 90,
      "schedule_basis": "completed_on",
      "start_from": "today",
      "custom_start_on": null,
      "overdue_policy": "carry_forward",
      "was_ai_suggested": true,
      "was_ai_accepted_without_changes": true,
      "ai_request_id": "uuid"
    },
    "tasks_regenerated": { "from": "2026-01-03", "to": "2026-04-03", "count": 12 }
  },
  "error": null,
  "meta": {}
}
```

- **Notes**:
  - Rejecting AI is represented by `source.type="ai"` with `accepted_without_changes=false` (and providing user-edited values).
  - Setting a manual plan uses `source.type="manual"` and `ai_request_id=null`.
- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `422 VALIDATION_ERROR` (e.g. `interval_days` out of range; `custom_start_on` required if `start_from=custom_date`)
  - `409 PLAN_CONFLICT` (rare concurrent plan change; server may retry)

---

### 2.8 Calendar views (watering_tasks read models)

#### GET `/api/calendar/month`
- **Opis**: Monthly calendar summary (days with planned watering and number of plants per day).
- **Query params**:
  - `month` (required): `YYYY-MM` (e.g. `2026-01`)
  - `status=pending|completed|all` (default `pending`)
- **Meta**:
  - `request_id` UUID mirrored in server logs for tracing.
- **Response 200**:

```json
{
  "data": {
    "month": "2026-01",
    "days": [
      { "date": "2026-01-03", "count": 4 },
      { "date": "2026-01-04", "count": 1 }
    ]
  },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `422 VALIDATION_ERROR`
  - `500 CALENDAR_MONTH_QUERY_FAILED`

#### GET `/api/calendar/day`
- **Opis**: Daily list of watering tasks with status and plant details. Used by the “day view” timeline.
- **Query params**:
  - `date` (required): `YYYY-MM-DD` — must be a real calendar date.
  - `status=pending|completed|all` (default `all`)
  - `sort=species_name|due_on` (default `due_on`)
  - `order=asc|desc` (default `asc`)
- **Behavior**:
  - Always filters by the authenticated user ID and `watering_tasks.due_on = date`.
  - `status=all` returns every task for that day; otherwise it applies an exact status filter.
  - Sorting is deterministic: when `sort=species_name` it orders by the related plant species + duplicate index, then by `due_on` and `id`. When `sort=due_on` it orders by date first, then plant fields, then `id`.
  - Response `meta` always contains a `request_id` UUID, mirrored in server logs for debugging.
- **Response 200**:

```json
{
  "data": {
    "date": "2026-01-03",
    "items": [
      {
        "task": {
          "id": "uuid",
          "due_on": "2026-01-03",
          "status": "pending",
          "source": "scheduled",
          "note": null,
          "completed_at": null,
          "completed_on": null
        },
        "plant": {
          "id": "uuid",
          "display_name": "Monstera deliciosa #1",
          "nickname": "Big one"
        }
      }
    ]
  },
  "error": null,
  "meta": { "request_id": "req_c0ffee" }
}
```

- **Errors**:
  - `400 VALIDATION_ERROR` (missing/invalid `date`, unsupported `status|sort|order`)
  - `401 UNAUTHENTICATED`
  - `500 CALENDAR_DAY_QUERY_FAILED`

---

### 2.9 Watering tasks (confirm / undo / edit)

> Direct client writes to `watering_tasks` are discouraged; use server endpoints to enforce invariants and handle schedule regeneration when needed.

#### GET `/api/watering-tasks`
- **Opis**: List tasks with filtering (useful for timelines/debugging; calendar endpoints are optimized for UI).
- **Query params**:
  - `from` / `to` (`YYYY-MM-DD`)
  - `plant_id`
  - `status=pending|completed`
  - `source=scheduled|adhoc`
  - `sort=due_on|created_at`, `order=asc|desc`
  - `limit`, `cursor`
- **Response 200**: list of `watering_tasks`.
- **Errors**: `401 UNAUTHENTICATED`, `422 VALIDATION_ERROR`

#### PATCH `/api/watering-tasks/{taskId}`
- **Opis**: Edit a watering entry (date, note, status). Server enforces constraints and may regenerate future tasks if the edit changes the schedule basis (e.g., `completed_on` changes for an active plan).
- **Request** (examples):

**Complete a scheduled task**:

```json
{
  "status": "completed",
  "completed_on": "2026-01-03",
  "note": "Watered thoroughly"
}
```

**Undo a scheduled task**:

```json
{
  "status": "pending",
  "note": null
}
```

**Edit a completed entry**:

```json
{
  "completed_on": "2026-01-04",
  "note": "Actually watered next day"
}
```

- **Response 200**:

```json
{
  "data": {
    "task": {
      "id": "uuid",
      "due_on": "2026-01-03",
      "status": "completed",
      "source": "scheduled",
      "note": "Watered thoroughly",
      "completed_at": "2026-01-03T12:34:56Z",
      "completed_on": "2026-01-03"
    },
    "schedule_effect": {
      "tasks_regenerated": false,
      "reason": null
    }
  },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `422 VALIDATION_ERROR`
  - `409 CONSTRAINT_VIOLATION` (e.g., unique `(plant_id,due_on)` or illegal adhoc transition)

#### POST `/api/plants/{plantId}/watering/adhoc`
- **Opis**: Record ad-hoc watering (immediate “completed” entry). Useful when user waters outside schedule or while no plan exists.
- **Request**:

```json
{
  "completed_on": "2026-01-03",
  "note": "Extra watering due to heat"
}
```

- **Response 201**:

```json
{
  "data": {
    "task": {
      "id": "uuid",
      "plant_id": "uuid",
      "due_on": "2026-01-03",
      "status": "completed",
      "source": "adhoc",
      "note": "Extra watering due to heat",
      "completed_at": "2026-01-03T12:34:56Z",
      "completed_on": "2026-01-03"
    }
  },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `409 CONFLICT` (if a task already exists for that plant+day)
  - `422 VALIDATION_ERROR`

#### DELETE `/api/watering-tasks/{taskId}`
- **Opis**: Delete a watering entry.
  - For `source=adhoc`: deletes the row.
  - For `source=scheduled`: allowed only if `status=completed` and treated as “remove log” (server may convert to `pending` instead of hard delete, depending on chosen invariant).
- **Query params**:
  - `confirm=true` (required)
- **Response 200**:

```json
{
  "data": { "deleted": true, "task_id": "uuid" },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `404 NOT_FOUND`
  - `400 CONFIRMATION_REQUIRED`
  - `409 NOT_ALLOWED`

---

### 2.10 Account deletion (GDPR / RODO)

> Requirement: double confirmation and immediate deletion of user data. In Supabase, deleting `auth.users` cascades to tenant tables via FK `ON DELETE CASCADE`. Storage cleanup must be done server-side.

#### POST `/api/account/delete-intent`
- **Opis**: Step 1/2. Confirms the user intends to delete their account and verifies password (or requires recent re-auth).
- **Request**:

```json
{
  "password": "StrongPassword123!",
  "confirmation": "I understand this will permanently delete my account and data."
}
```

- **Response 200**:

```json
{
  "data": {
    "intent_id": "uuid",
    "expires_at": "2026-01-03T12:10:00Z"
  },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `401 AUTH_INVALID_CREDENTIALS`
  - `422 VALIDATION_ERROR`

#### DELETE `/api/account`
- **Opis**: Step 2/2. Permanently deletes account and all user data; logs user out.
- **Query params**:
  - `intent_id` (required)
- **Response 200**:

```json
{
  "data": { "deleted": true },
  "error": null,
  "meta": {}
}
```

- **Errors**:
  - `401 UNAUTHENTICATED`
  - `400 INVALID_OR_EXPIRED_INTENT`

---

## 3. Uwierzytelnianie i autoryzacja

- **Authentication**: Supabase Auth (email + password, email confirmation).
  - Frontend can use Supabase client SDK directly for sign-up/sign-in.
  - Server endpoints validate identity using the Supabase JWT (bearer token) or SSR cookies.
- **Authorization model**:
  - Tenant isolation enforced by **Supabase RLS** (owner-only access) for reads.
  - Sensitive tables are **read-only from clients** (recommended):
    - `watering_plans`: client SELECT allowed, writes via server endpoint/RPC.
    - `watering_tasks`: client SELECT allowed, writes via server endpoint/RPC.
    - `ai_requests`: client SELECT optional; INSERT never allowed from client.
- **Service role usage**:
  - Only on server for: inserting `ai_requests`, deleting `auth.users`, deleting Storage objects, and transactional operations where direct client permissions are intentionally restricted.
- **Rate limiting**:
  - AI endpoints enforce **20 requests/hour/user** based on `ai_requests.requested_at`.
  - Return `429` with `unlock_at` and allow continuing without AI (e.g., create plants with `generate_watering_suggestion=false`).

---

## 4. Walidacja i logika biznesowa

### 4.1 Validation rules by resource (derived from DB constraints)

#### Profile (`public.profiles`)
- **timezone**: length 1..64
- **nickname**: nullable; if provided length 1..60

#### Plant (`public.plants`)
- **species_name**: required; length 1..120
- **species_name immutable** after creation (DB trigger). API must reject updates to `species_name`.
- **duplicate_index**: `>= 0` and unique per `(user_id, species_name_normalized, duplicate_index)`
- **nickname**: nullable; if provided length 1..80

#### Watering plan (`public.watering_plans`)
- **interval_days**: 1..365
- **horizon_days**: 1..365 (default 90)
- **start_from/custom_start_on**:
  - If `start_from = "custom_date"`, then `custom_start_on` is required.
  - Otherwise `custom_start_on` must be null.
- **active state invariant**:
  - If `is_active=true` then `valid_to` must be null; if `is_active=false` then `valid_to` required.
- **one active plan per plant** enforced by partial unique index; API must change plan via versioning (deactivate previous + insert new).

#### Watering task (`public.watering_tasks`)
- **unique per plant per day**: `(plant_id, due_on)`
- **completion consistency**:
  - If `status="completed"` then `completed_at` and `completed_on` required.
  - If `status="pending"` then both must be null.
- **source invariants**:
  - `source="scheduled"` requires `plan_id` (non-null).
  - `source="adhoc"` requires `status="completed"` and `due_on = completed_on`.

#### AI request (`public.ai_requests`)
- Insert server-side only.
- Optional numeric metrics must be `>= 0` when present.

---

### 4.2 Business logic mapping (PRD → API behavior)

- **Add plant (US-001)**:
  - `POST /api/plants` creates a plant, automatically assigning `duplicate_index` for duplicates.
  - `species_name` cannot be changed later (API + DB enforcement).

- **Generate AI watering plan within 5 seconds (US-002)**:
  - `POST /api/plants/{plantId}/watering-plan/suggest` calls OpenRouter with a strict server timeout and returns a short explanation (not stored).
  - Server records an `ai_requests` row with status (`success|error|rate_limited|skipped`) and latency.

- **Accept or reject/correct plan (US-003)**:
  - `PUT /api/plants/{plantId}/watering-plan` is the single source of truth to activate a plan:
    - Creates a new `watering_plans` row (version).
    - Deactivates previous active plan (sets `valid_to`, `is_active=false`).
    - Regenerates future pending tasks for the plan horizon.
  - AI acceptance tracked using:
    - `was_ai_suggested=true` when plan originates from a suggestion
    - `was_ai_accepted_without_changes=true|false` depending on user action
    - `ai_request_id` linking to the audit row

- **Monthly calendar (US-004)**:
  - `GET /api/calendar/month` reads `watering_tasks` grouped by `due_on` and returns day counts.

- **Daily view + confirm watering (US-005)**:
  - `GET /api/calendar/day` lists tasks with plant metadata.
  - `PATCH /api/watering-tasks/{taskId}` completes a scheduled task.
  - `POST /api/plants/{plantId}/watering/adhoc` records an ad-hoc completed watering entry.

- **Edit/undo a watering entry (US-006)**:
  - `PATCH /api/watering-tasks/{taskId}` supports editing `completed_on` and `note`, and undoing scheduled tasks (`status=pending`).
  - If the active plan uses `schedule_basis="completed_on"`, changing `completed_on` may trigger regeneration of future pending tasks so the calendar updates correctly.

- **AI limit messaging and fallback (US-007)**:
  - `GET /api/ai/quota` provides remaining requests and unlock time.
  - If rate-limited, suggestion endpoints return `429` and plant creation still works with `generate_watering_suggestion=false`.

- **Security and sessions (US-008)**:
  - All app data endpoints require authenticated requests.
  - Session expiration is handled by Supabase Auth; API returns `401` when unauthenticated.

- **Account deletion with double confirmation (US-009)**:
  - `POST /api/account/delete-intent` + `DELETE /api/account` performs immediate hard delete (cascades).
  - Server also deletes Storage photos under the user’s namespace.

- **Edit plant fields (US-010)**:
  - `PATCH /api/plants/{plantId}` updates optional fields only.

- **Delete plant (US-011)**:
  - `DELETE /api/plants/{plantId}?confirm=true` deletes plant + plans + tasks immediately.

---

### 4.3 Performance considerations

- Calendar endpoints are designed to align with DB indexes:
  - `watering_tasks (user_id, due_on)` for month/day queries
  - `watering_tasks (user_id, status, due_on)` for pending filters
- AI endpoints enforce a strict response time budget (5 seconds). If the provider is slow, return a timeout error and allow user to proceed without AI.

---

### 4.4 Security hardening checklist (MVP)

- Enforce **default-deny RLS** on tenant tables; allow only necessary SELECT policies to authenticated users.
- Restrict INSERT/UPDATE/DELETE for `watering_plans`, `watering_tasks`, and `ai_requests` from client roles; perform via server endpoints/RPC.
- Validate all user input server-side (lengths, enums, date formats).
- Do not store AI “explanation/source” in DB if not required; return it only in response payloads.

