
---

## 1) Fundament A1: admin client + env (blokuje dziś większość mutacji)
### Dodać
- **`src/db/supabase.admin.ts`**
  - Tworzy `createAdminClient()` z `SUPABASE_URL` + **`SUPABASE_SERVICE_ROLE_KEY`**
  - Cache singleton (żeby nie tworzyć klienta per request)

- **`.env.example`** (jeśli istnieje) lub dokumentacja w `.ai/tech-stack.md`
  - Dopisać `SUPABASE_SERVICE_ROLE_KEY=...`

### Zmienić
- **`src/env.d.ts`**
  - Dodać `readonly SUPABASE_SERVICE_ROLE_KEY: string;`

**Uwaga krytyczna**: klucz service-role ma być **tylko server-side** (Astro nie expose’uje env bez prefixu `PUBLIC_`, więc jest OK).

---

## 2) Naprawa “RLS vs mutacje”: przenieść `ai_requests` na admin client (AI quota/suggest musi działać)
### Zmienić
- **`src/lib/services/ai/ai-requests.ts`**
  - Wszystkie `.insert()`/`.update()` wykonywać na admin kliencie.
  - Najprościej: zmienić sygnatury na:
    - `createAiRequest(supabaseAdmin, { userId, plantId, ... })`
    - `markAiRequestSuccess(supabaseAdmin, ...)` itd.

- **`src/lib/services/watering-plans/suggest-watering-plan.ts`**
  - Dodać parametr `supabaseAdmin` (albo import `createAdminClient()` wewnątrz)
  - `createAiRequest/mark...` wykonywać adminem.
  - **Ownership rośliny** może zostać na zwykłym `locals.supabase` (RLS) albo też adminem z `.eq('user_id', userId)` (ważne: w A1 i tak musimy robić jawne checki).

- **`src/pages/api/plants/[plantId]/watering-plan/suggest.ts`**
  - Utworzyć admin client na początku handlera i przekazać do serwisu.

---

## 3) Domknięcie PRD: AI w `POST /api/plants` (teraz jest stub “not implemented yet”)
### Zmienić
- **`src/pages/api/plants/index.ts`**
  - Po `createPlant(...)`:
    - jeśli `generate_watering_suggestion=false` → `watering_suggestion.status='skipped'`
    - jeśli `true` → wywołać **ten sam** serwis co `/watering-plan/suggest` (z adminem dla `ai_requests`)
  - Zmapować wynik `WateringPlanSuggestionDto` → `WateringSuggestionForCreationDto`:
    - sukces → `status: 'available'` + config + explanation + `ai_request_id`
    - rate limit → `status: 'rate_limited'` + `unlock_at` + `ai_request_id`
    - błąd → `status: 'error'` + `ai_request_id` (jeśli był) + `explanation` (opcjonalnie)

**Efekt**: spełniasz US-002/US-007 bez dodawania nowych endpointów.

---

## 4) Mutacje `watering_tasks` (adhoc/patch/delete) muszą używać admina + jawnych checków ownership
### Zmienić
- **`src/lib/services/watering-tasks/create-adhoc-watering-task.ts`**
  - Insert do `watering_tasks` robić adminem (bo dziś RLS blokuje).
  - Ownership rośliny weryfikować **zanim** wstawisz task (np. select z `.eq('id', plantId).eq('user_id', userId)`).

- **`src/lib/services/watering-tasks/update-watering-task.ts`**
  - `loadTask(...)` i `.update(...)` na `watering_tasks` robić adminem.
  - Regenerację (`supabase.rpc('regenerate_watering_tasks', ...)`) zostawić na **user kliencie** (`locals.supabase`), bo RPC ma `auth.uid()` guard i z service-role się wyłoży.
  - Czyli serwis powinien dostać **dwa klienty**: `supabaseUser` i `supabaseAdmin`.

- **`src/lib/services/watering-tasks/delete-watering-task.ts`**
  - `loadTask`, `delete`, `resetScheduledTask` robić adminem.
  - Po “undo” (scheduled → pending) rozważyć regenerację (patrz pkt 5).

### Zmienić route’y, żeby dostarczyć admin client
- `src/pages/api/plants/[plantId]/watering/adhoc.ts`
- `src/pages/api/watering-tasks/[taskId].ts`

---

## 5) Spójność kalendarza (w PRD “odświeża się po każdej zmianie”): regeneracja po adhoc i po delete/undo
### Zmienić
- **`src/lib/services/watering-tasks/create-adhoc-watering-task.ts`**
  - Po insercie adhoc: jeśli istnieje aktywny plan i `schedule_basis='completed_on'` → wywołać `regenerate_watering_tasks` user-clientem.

- **`src/lib/services/watering-tasks/delete-watering-task.ts`**
  - Po resecie scheduled task (undo completion): jeżeli aktywny plan `completed_on` → regeneracja.

- **`src/lib/services/watering-tasks/update-watering-task.ts`**
  - Dodać regenerację również gdy zmieniono **adhoc** `completed_on` (bo zmienia “last_completed_on”).

---