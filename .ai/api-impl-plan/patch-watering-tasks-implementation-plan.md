## API Endpoint Implementation Plan: PATCH `/api/watering-tasks/{taskId}`

## 1. Przegląd punktu końcowego
- **Cel**: edycja wpisu podlewania (zadania) w `public.watering_tasks`: oznaczenie jako wykonane, cofnięcie wykonania, korekta daty wykonania (`completed_on`) oraz notatki (`note`).
- **Konsekwencje harmonogramu**: serwer egzekwuje inwarianty tabeli i **może zregenerować przyszłe zadania** dla aktywnego planu, jeśli zmiana wpływa na bazę harmonogramu (np. przy `schedule_basis="completed_on"`).
- **Zasoby DB**: `public.watering_tasks` z ograniczeniami:
  - unikalność `(plant_id, due_on)`
  - spójność statusu i pól completion
  - spójność źródła (`source`)
- **Tech**: Astro API routes (`src/pages/api`), TypeScript, Supabase (`locals.supabase`), walidacja Zod (parsers w `src/lib/api/*`), logika biznesowa w serwisach (`src/lib/services/*`).

## 2. Szczegóły żądania
- **Metoda HTTP**: `PATCH`
- **URL**: `/api/watering-tasks/{taskId}`
- **Parametry**:
  - **Wymagane**:
    - `taskId` (path) — UUID zadania
  - **Opcjonalne**: brak
- **Nagłówki**:
  - **Wymagane**: `Content-Type: application/json`
  - **Wymagane dla autoryzacji**: `Authorization: Bearer <token>` (opcjonalnie, jeżeli sesja jest już w cookies; zgodnie z istniejącymi endpointami warto wspierać oba warianty)
- **Request body (JSON)**: obiekt *strict* (brak dodatkowych pól) wspierający częściowe aktualizacje:
  - `status?: "pending" | "completed"`
  - `completed_on?: "YYYY-MM-DD"` (ISO date)
  - `note?: string | null`

### Reguły walidacji wejścia (Zod + walidacja biznesowa)
- **JSON**:
  - brak/niepoprawny JSON → błąd `400 INVALID_JSON`
- **Parametr `taskId`**:
  - nie-UUID → błąd `400 INVALID_TASK_ID`
- **Body**:
  - co najmniej jedno pole z: `status`, `completed_on`, `note` musi być podane
  - `note`:
    - `string` → trim; pusty string może być normalizowany do `null`
    - limit długości (np. `max(10_000)`) spójny z innymi parserami
  - `completed_on`:
    - format i poprawność daty (walidacja jak w `create-plant-request` / `set-watering-plan-request`)
- **Zależności między polami (na bazie specyfikacji i constraintów DB)**:
  - jeżeli wynikowy `status === "completed"` → `completed_on` musi być niepuste (w PATCH dopuszczamy:
    - albo `status="completed"` i `completed_on` w payload
    - albo samo `completed_on` *tylko gdy zadanie już jest `completed`*)
  - jeżeli wynikowy `status === "pending"` → `completed_on` nie może być ustawiane (w payload) i serwer wyzeruje `completed_at` oraz `completed_on`
  - dla `source="adhoc"`:
    - nie wolno przejść do `status="pending"` (constraint: adhoc musi być completed)
    - `due_on` musi pozostać równe `completed_on` (jeśli edytujemy `completed_on`, serwer musi skorygować także `due_on`)
  - dla `source="scheduled"`:
    - `plan_id` musi istnieć (constraint) — endpoint nie zmienia `source` ani `plan_id`, ale serwis powinien defensywnie zareagować, jeśli w danych występuje stan niepoprawny

## 3. Szczegóły odpowiedzi
- **Response envelope (spójny z istniejącymi endpointami)**:
  - `data`: wynik lub `null`
  - `error`: `{ code, message, details? }` lub `null`
  - `meta`: `{ request_id?: string, ... }` (rekomendowane `request_id` jak w `/api/calendar/*`)

### Sukces
- **200 OK**
  - `data`: `UpdateWateringTaskResultDto` (z `src/types.ts`)
    - `task`: podsumowanie zadania (`id`, `due_on`, `status`, `source`, `note`, `completed_at`, `completed_on`)
    - `schedule_effect`: `{ tasks_regenerated: boolean, reason: string | null }`
  - `error: null`

### Kody statusu i mapowanie błędów
Repo już wykorzystuje `409` i `422` (np. `update-plant-request`, `set-watering-plan-request`), a specyfikacja endpointu wskazuje `409` dla constraintów — dlatego plan zakłada:
- **400** — niepoprawny JSON (`INVALID_JSON`) lub niepoprawny `taskId` (`INVALID_TASK_ID`)
- **401** — brak autoryzacji (`UNAUTHENTICATED` / `UNAUTHORIZED`)
- **404** — brak zasobu (`NOT_FOUND` / `WATERING_TASK_NOT_FOUND`)
- **409** — konflikt/constraint (np. unikalność `(plant_id, due_on)`, niedozwolona zmiana adhoc) (`CONSTRAINT_VIOLATION`)
- **422** — błąd walidacji payloadu (Zod) (`VALIDATION_ERROR`)
- **500** — błąd serwera (`INTERNAL_SERVER_ERROR`)

## 4. Przepływ danych
### Warstwa route (`src/pages/api/watering-tasks/[taskId].ts`)
1. Wygeneruj `request_id` (np. `randomUUID()`).
2. Uwierzytelnij użytkownika przez `locals.supabase.auth.getUser()` (i opcjonalnie obsłuż `Authorization: Bearer ...` jak w `/api/calendar/*`).
3. Zparsuj `taskId` (Zod).
4. Odczytaj i zparsuj JSON body:
   - błąd parsowania JSON → `HttpError(400, ..., 'INVALID_JSON')`
   - walidacja Zod → `HttpError(422, ..., 'VALIDATION_ERROR', details)`
5. Wywołaj serwis `updateWateringTask(locals.supabase, { userId, taskId, command })`.
6. Zwróć `200` z envelopem i `schedule_effect`.
7. `catch`:
   - `HttpError` → zwróć `error.status` + `error.code/message/details`
   - pozostałe → log `console.error(...)` + `500`

### Warstwa service (`src/lib/services/watering-tasks/update-watering-task.ts`)
1. **Załaduj zadanie** po `id` i `user_id`:
   - select minimalny zestaw pól potrzebnych do walidacji i decyzji o regeneracji:
     - `id, user_id, plant_id, plan_id, due_on, status, source, note, completed_at, completed_on`
   - brak rekordu → `HttpError(404, 'Watering task not found', 'WATERING_TASK_NOT_FOUND')`
2. **Wylicz stan docelowy (merge PATCH)**:
   - `nextStatus`: `command.status ?? current.status`
   - `nextCompletedOn`: zależnie od payloadu i reguł (np. edycja `completed_on` tylko, gdy `nextStatus==='completed'`)
   - `nextNote`: gdy `note` w payloadzie → ustaw; gdy brak → pozostaw bez zmian
3. **Walidacja biznesowa (przed DB)**:
   - `adhoc`:
     - jeśli `source==='adhoc'` i `nextStatus!=='completed'` → `HttpError(409, 'Adhoc tasks must remain completed', 'CONSTRAINT_VIOLATION')`
   - `completed/pending`:
     - jeśli `nextStatus==='completed'` i brak docelowego `completed_on` → `HttpError(422, 'completed_on is required when status is completed', 'VALIDATION_ERROR')`
     - jeśli `nextStatus==='pending'` i `command.completed_on` jest ustawione → `HttpError(422, 'completed_on cannot be set when status is pending', 'VALIDATION_ERROR')`
4. **Przygotuj payload update’u** zgodnie z constraintami:
   - przejście do `completed`:
     - `status='completed'`
     - `completed_on=nextCompletedOn`
     - `completed_at=now()` (serwerowy timestamp; w Astro: `new Date().toISOString()`)
   - przejście do `pending`:
     - `status='pending'`
     - `completed_on=null`
     - `completed_at=null`
   - sama edycja `completed_on` (gdy już `completed`):
     - `completed_on=...` (bez zmiany `completed_at`)
   - `adhoc` i zmiana `completed_on`:
     - dodatkowo `due_on = completed_on` (żeby spełnić constraint `due_on = completed_on`)
5. **Zapis do DB**:
   - wykonaj `update` z `.eq('id', taskId).eq('user_id', userId)` i `.select(...)` dla zwrotu zaktualizowanego rekordu
   - mapuj błędy Postgres:
     - `23505` → `HttpError(409, 'Task conflicts with existing task for the same day', 'CONSTRAINT_VIOLATION')`
     - `23514` (check violation) → `HttpError(409, 'Constraint violation', 'CONSTRAINT_VIOLATION')`
     - inne → `HttpError(500, 'Failed to update watering task', 'UPDATE_WATERING_TASK_FAILED')`
6. **Decyzja o regeneracji harmonogramu**:
   - pobierz aktywny plan dla `plant_id` (jeśli istnieje):
     - `watering_plans` gdzie `user_id=userId`, `plant_id=...`, `is_active=true`
   - warunki minimalne do rozważenia regeneracji:
     - istnieje aktywny plan
     - plan ma `schedule_basis === 'completed_on'`
     - zmiana wpływa na bazę (status/`completed_on` zmienione lub cofnięte)
   - rekomendowana logika „czy to naprawdę zmienia bazę” (żeby nie regenerować niepotrzebnie):
     - policz „basisBefore” i „basisAfter” jako `max(completed_on)` dla danego `plant_id` (z uwzględnieniem `source='scheduled'|'adhoc'`), porównaj i regeneruj tylko jeśli się zmieniło
   - jeśli regeneracja jest potrzebna:
     - wywołaj istniejące RPC `regenerate_watering_tasks` (jak w `setPlantWateringPlan`) z parametrami aktywnego planu
     - ustaw `schedule_effect.tasks_regenerated=true` oraz `reason` (np. `'COMPLETION_DATE_CHANGED'`, `'TASK_COMPLETED'`, `'TASK_UNDONE'`)
   - jeśli nie:
     - `tasks_regenerated=false`, `reason=null`
7. Zwróć `UpdateWateringTaskResultDto`.

### Uwaga dot. atomowości
Aktualizacja zadania + (opcjonalna) regeneracja to logicznie jedna operacja. Dla pełnej spójności warto rozważyć **jedną funkcję Postgres RPC** (transakcja), np. `update_watering_task_and_regenerate_if_needed(...)`, która:
- weryfikuje ownership i constrainty,
- aktualizuje rekord,
- podejmuje decyzję o regeneracji i ją wykonuje,
- zwraca zaktualizowane zadanie + `schedule_effect`.

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**: Supabase Auth (`locals.supabase.auth.getUser(...)`).
- **Autoryzacja**:
  - zawsze filtr `eq('user_id', userId)` przy odczycie/aktualizacji
  - zakładamy (i weryfikujemy w migracjach) RLS na `watering_tasks` (defense in depth)
- **Walidacja i hardening**:
  - Zod `strict()` w body → blokada mass-assignment
  - limit długości `note`
  - walidacja ISO date (brak „pływających” dat)
- **Ochrona przed nadużyciami**:
  - endpoint może wyzwalać regenerację (kosztowną) — rozważyć:
    - ograniczenie częstotliwości (soft-rate-limit) per użytkownik/roślina
    - debounce w UI; po stronie API: proste guardy (np. nie regeneruj, jeśli brak realnej zmiany basis)

## 6. Obsługa błędów
- **Błędy kontrolowane (`HttpError`)**: zwracane w envelopie; logowane jako „handled” (z `request_id` i kontekstem: `userId`, `taskId`, `plantId` gdy znane).
- **Błędy nieoczekiwane**: `console.error` + `500 INTERNAL_SERVER_ERROR` (bez ujawniania szczegółów).
- **Rejestrowanie błędów w tabeli**:
  - w obecnym kodzie brak dedykowanej tabeli error logów; standardem jest `console.error(...)`.
  - jeśli projekt posiada/planował tabelę logów (np. `api_errors`), można dodać opcjonalny zapis w bloku obsługi błędów, ale nie jest to wymagane do wdrożenia endpointu.

## 7. Wydajność
- **Happy path**: 1× select (task) + 1× update (+ ewentualnie 1× select plan) → tanie.
- **Regeneracja**: potencjalnie ciężka; minimalizować wywołania:
  - regenerować tylko gdy faktycznie zmienia się „basis”
  - trzymać regenerację w Postgres (RPC) dla mniejszej liczby round-tripów
- **Indeksy/constraints**:
  - `UNIQUE (plant_id, due_on)` już wspiera spójność i szybkie wykrycie konfliktu
  - warto mieć indeks(y) wspierające zapytania:
    - `watering_tasks(user_id, id)`
    - `watering_tasks(user_id, plant_id, completed_on)` (dla `max(completed_on)`), jeśli okaże się wąskim gardłem

## 8. Kroki implementacji
1. **Dodaj parser parametrów i body**:
   - plik: `src/lib/api/watering-tasks/update-watering-task-request.ts`
   - eksport:
     - `parseUpdateWateringTaskParams(params)` → `{ taskId }`
     - `parseUpdateWateringTaskRequest(body)` → `UpdateWateringTaskCommand` (z `src/types.ts`)
   - walidacje: UUID, ISO date, `strict()`, „at least one field”, zależności `status`/`completed_on`.
2. **Dodaj serwis**:
   - plik: `src/lib/services/watering-tasks/update-watering-task.ts`
   - funkcja: `updateWateringTask(supabase, { userId, taskId, command }): Promise<UpdateWateringTaskResultDto>`
   - implementacja:
     - odczyt taska + walidacja biznesowa
     - update z poprawnym ustawieniem `completed_at/completed_on` i (dla `adhoc`) `due_on`
     - mapowanie błędów Postgres na `HttpError`
     - decyzja o regeneracji + wywołanie RPC (lub przygotowanie pod przyszłe RPC atomowe)
3. **Dodaj route API**:
   - plik: `src/pages/api/watering-tasks/[taskId].ts`
   - `export const prerender = false`
   - `export const PATCH: APIRoute = ...`
   - envelope + obsługa błędów w stylu `plants/[plantId]/index.ts` i (opcjonalnie) `request_id` jak w `calendar/*`.
4. **Doprecyzuj/uzupełnij funkcje DB (jeśli potrzeba)**:
   - potwierdź dostępność `regenerate_watering_tasks` i jego kontraktu
   - jeśli brakuje atomowości lub warunkowej regeneracji:
     - dodaj RPC `update_watering_task_and_regenerate_if_needed` (nazwa do ustalenia) oraz typ wyniku
5. **Spójność typów DTO**:
   - użyj istniejących:
     - `UpdateWateringTaskCommand`
     - `UpdateWateringTaskResultDto`
     - `ScheduleEffectDto`
   - doprecyzuj kody błędów (`code`) w jednym miejscu (np. stałe), jeśli zaczynają się mnożyć.

