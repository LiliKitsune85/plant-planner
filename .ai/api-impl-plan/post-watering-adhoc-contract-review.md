# Contract Verification – POST `/api/plants/{plantId}/watering/adhoc`

Date: 2026-01-04  
Author: GPT-5.1 Codex

## Database coverage

- **Unique task per plant/day** – `watering_tasks_unique_per_day` unique index in `supabase/migrations/20260103203752_initial_schema.sql` guarantees retries surface as conflicts.  
- **Adhoc invariants** – the same migration enforces `source <> 'adhoc' or status = 'completed'` plus `due_on = completed_on`, aligning with the service payload (`due_on` sourced from `completed_on`).  
- **Completion fields** – `watering_tasks_completion_consistency_chk` ensures `completed_at`/`completed_on` are set for completed rows; the service always supplies both.  
- **Ownership** – explicit lookup in `createAdhocWateringTask.ensurePlantOwnership` plus Supabase RLS prevents cross-tenant access.

## Status-code mapping

| Scenario | Source | Response |
| --- | --- | --- |
| Invalid JSON | Route guard (`request.json`) | 400 `INVALID_JSON` |
| Invalid params/body | Zod parsers | 400 `INVALID_PLANT_ID` / `VALIDATION_ERROR` |
| Missing auth | `requireUserId` helper | 401 `UNAUTHENTICATED` |
| Plant missing/not owned | `ensurePlantOwnership` | 404 `PLANT_NOT_FOUND` |
| Duplicate `(plant_id, due_on)` | `createAdhocWateringTask` unique check | 409 `TASK_ALREADY_EXISTS` |
| Supabase failures | Logged with `requestId`, bubbled as 500 (`PLANT_LOOKUP_FAILED` / `TASK_INSERT_FAILED`) |

## Manual simulation blueprint

1. **Baseline success** – POST with valid body; expect 201, `Location` header, `data.task.source === 'adhoc'`.  
2. **Ownership failure** – use another user’s `plantId`; expect 404.  
3. **Duplicate** – repeat the same payload; expect 409.  
4. **Validation** – send malformed date or >500 char note; expect 400 `VALIDATION_ERROR`.  
5. **Auth** – omit credentials; expect 401.  
6. **Unexpected error** – temporarily stub Supabase insert to throw; verify 500 envelope, log includes `requestId`.

Execution of the above requires Supabase connectivity; the code paths and database constraints have been double-checked against the migration to ensure the responses above are deterministic.

