## API Endpoint Implementation Plan: POST `/api/plants/{plantId}/watering/adhoc`

## 1. Przegląd punktu końcowego
- **Cel**: zapis „ad-hoc” podlewania jako natychmiast wykonanego zadania (`watering_tasks`) dla konkretnej rośliny i dnia.
- **Zastosowanie**: użytkownik podlewa poza harmonogramem albo nie ma aktywnego planu; wpis ma stanowić spójny rekord wykonania.
- **Zasób DB**: `public.watering_tasks` (unikalność per roślina per dzień + spójność pól completion + reguły dla `source`).
- **Kontrakt biznesowy** (z `api-plan.md` / `db-plan.md`):
  - **Unikalność**: maks. 1 zadanie na roślinę na dzień: `(plant_id, due_on)` → konflikt przy duplikacie.
  - **Ad-hoc invariants**:
    - `source = 'adhoc'`
    - `status = 'completed'`
    - `due_on = completed_on`
    - `completed_at` i `completed_on` wymagane
    - `plan_id` **NULL** (dopuszczalne dla adhoc)

## 2. Szczegóły żądania
- **Metoda HTTP**: `POST`
- **Ścieżka**: `/api/plants/{plantId}/watering/adhoc`
- **Wymagania dot. Astro**:
  - handler: `export const POST`
  - `export const prerender = false`
  - Supabase: korzystać z `locals.supabase` (nie importować klienta bezpośrednio)

### Parametry
- **Path params**:
  - **wymagane**: `plantId: uuid`
- **Query params**: brak

### Body (JSON)
- **Wymagane**:
  - `completed_on: string` – data w formacie ISO `YYYY-MM-DD`
- **Opcjonalne**:
  - `note: string | null` – notatka do wpisu (np. „Extra watering due to heat”)

### Walidacja wejścia (Zod + guard clauses)
- **JSON parse**:
  - jeśli `request.json()` rzuci wyjątek → `400 INVALID_JSON`
- **`plantId`**:
  - musi być poprawnym UUID (np. schema jak `parsePlantIdParams`)
  - błąd → `400 INVALID_PLANT_ID` (lub `VALIDATION_ERROR` – decyzja zespołu, patrz sekcja „Obsługa błędów”)
- **`completed_on`**:
  - string, trim, format `YYYY-MM-DD`
  - walidacja semantyczna: date round-trip (jak w `SetWateringPlanPayloadSchema`)
  - błąd → błąd walidacji (preferowany kod wg kontraktu, patrz sekcja 6)
- **`note`**:
  - `optional`
  - rekomendacja: `trim()`, zamiana pustego stringa na `null`
  - rekomendacja limitu długości (np. 0–500 lub 0–1000) – spójnie z UI/DB
- **Strict mode**:
  - `.strict()` na obiekcie body, żeby odrzucać nieznane pola

### Wykorzystywane typy (DTO + Command modele)
- **Command**: `AdhocWateringCommand` (`src/types.ts`)
  - pola: `completed_on`, `note`
- **DTO response**: `AdhocWateringResultDto` (`src/types.ts`)
  - `task`: podzbiór `watering_tasks` (m.in. `id`, `plant_id`, `due_on`, `status`, `source`, `note`, `completed_at`, `completed_on`)
- **Pomocnicze**:
  - `HttpError` / `isHttpError` (`src/lib/http/errors.ts`)
  - (opcjonalnie) wspólny envelope `ApiEnvelope<T>`

## 3. Szczegóły odpowiedzi
- **Format**: standardowy envelope jak w pozostałych endpointach:
  - `data`: obiekt lub `null`
  - `error`: `{ code: string; message: string; details?: unknown } | null`
  - `meta`: `{}` (opcjonalnie `{ request_id }` dla korelacji)

### 201 CREATED (sukces)
- Zwracane pola:
  - `data.task` z:
    - `id`
    - `plant_id`
    - `due_on` (równe `completed_on`)
    - `status = "completed"`
    - `source = "adhoc"`
    - `note`
    - `completed_at` (server time, UTC)
    - `completed_on`
- **Rekomendowane nagłówki**:
  - `Content-Type: application/json; charset=utf-8`
  - `Cache-Control: no-store`
  - (opcjonalnie) `Location: /api/watering-tasks/{id}` jeśli/ gdy taki zasób istnieje w API

## 4. Przepływ danych
1. **Route** (`src/pages/api/plants/[plantId]/watering/adhoc.ts`):
   - odczyt params + body
   - auth: pobranie `userId` (session lub Bearer token)
   - walidacja Zod → `AdhocWateringCommand`
2. **Service** (`src/lib/services/watering-tasks/create-adhoc-watering-task.ts`):
   - weryfikacja własności rośliny:
     - query `plants` po `id = plantId` i `user_id = userId`
     - brak → `404 PLANT_NOT_FOUND`
   - insert do `watering_tasks`:
     - `user_id = userId`
     - `plant_id = plantId`
     - `plan_id = null`
     - `due_on = command.completed_on`
     - `status = 'completed'`
     - `source = 'adhoc'`
     - `note = command.note ?? null`
     - `completed_at = now()` (np. `new Date().toISOString()` lub default DB jeśli istnieje)
     - `completed_on = command.completed_on`
   - obsługa błędów z PostgREST:
     - unique violation (`code === '23505'`) → `409 CONFLICT` (task already exists for plant+day)
     - inne → `500`
3. **Response mapping**:
   - mapowanie row → `WateringTaskSummaryFields` + `plant_id` (jak w `AdhocWateringResultDto`)
   - envelope + status `201`

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**:
  - wymagane (Supabase Auth)
  - rekomendacja: wspólny helper `requireUserId(locals, request)` (wzorzec z `/api/calendar/*` i `/api/plants`)
- **Autoryzacja / Ownership**:
  - przed insertem potwierdzić, że roślina należy do `userId` (query `plants` z `user_id`)
  - nie polegać wyłącznie na tym, że `plantId` jest UUID (zapobiega IDOR)
- **RLS**:
  - zakładamy, że RLS na `plants` i `watering_tasks` egzekwuje `user_id = auth.uid()`
  - mimo RLS, jawna kontrola własności pozwala zwrócić czytelne `404` zamiast ogólnego błędu.
- **Odporność na nadużycia**:
  - powtórne wysłanie żądania (retry/double click) → obsłużyć deterministycznie przez unikalność `(plant_id, due_on)` i mapowanie na `409`.
- **Wrażliwe dane**:
  - nie logować pełnego body; logować jedynie `plantId`, `userId`, `completed_on`, `request_id` i błąd.
- **CORS/CSRF**:
  - jeśli API jest używane z cookie-session, upewnić się, że polityka CORS/CSRF jest zgodna z resztą aplikacji (middleware).

## 6. Obsługa błędów
### Scenariusze i kody statusu
- **400 BAD REQUEST**
  - `INVALID_JSON`: body nie jest poprawnym JSON
  - `INVALID_PLANT_ID`: `plantId` nie jest UUID
  - `VALIDATION_ERROR`: `completed_on` (lub `note`) nie przechodzi walidacji
- **401 UNAUTHORIZED**
  - `UNAUTHENTICATED`: brak sesji / nieprawidłowy token
- **404 NOT FOUND**
  - `PLANT_NOT_FOUND`: roślina nie istnieje albo nie należy do użytkownika
- **409 CONFLICT**
  - `TASK_ALREADY_EXISTS`: istnieje już `watering_tasks` dla `(plant_id, due_on)` (np. scheduled lub adhoc)
- **500 INTERNAL SERVER ERROR**
  - `PLANT_LOOKUP_FAILED`, `TASK_INSERT_FAILED`, `INTERNAL_SERVER_ERROR`

### Uwaga o spójności kodów walidacji (400 vs 422)
- W repo istnieją endpointy zwracające `422 VALIDATION_ERROR` (np. `parseSetWateringPlanRequest`), ale w wymaganiach tego planu przyjmujemy **400** dla nieprawidłowych danych wejściowych.
- Rekomendacja: zespół powinien ustalić jeden standard (400 lub 422) i stosować go konsekwentnie we wszystkich parserach Zod.

### Rejestrowanie błędów („tabela błędów”)
- W dostarczonych zasobach brak dedykowanej tabeli do logów błędów API.
- **Rekomendacja**:
  - logować przez `console.error` z obiektem kontekstowym + `request_id` (jak w endpointach calendar)
  - jeśli w przyszłości pojawi się tabela (np. `api_errors`), dodać opcjonalny insert w sekcji „Unhandled error” (bez wpływu na response).

## 7. Wydajność
- **Koszt DB**: 2 zapytania w typowej ścieżce:
  - `SELECT plants` (ownership) + `INSERT watering_tasks`
- **Indeksy/ograniczenia**:
  - unikalność `(plant_id, due_on)` zapewnia szybkie wykrywanie duplikatów.
- **Optymalizacje**:
  - brak potrzeby dodatkowych joinów.
  - odpowiedź powinna zwracać tylko potrzebne pola (nie cały rekord).

## 8. Kroki implementacji
1. **Dodać route Astro**:
   - utworzyć plik `src/pages/api/plants/[plantId]/watering/adhoc.ts`
   - dodać `export const prerender = false`
   - zaimplementować `export const POST: APIRoute`
2. **Dodać parser requestu (Zod)**:
   - nowy moduł, np. `src/lib/api/watering-tasks/create-adhoc-watering-request.ts`
   - funkcje:
     - `parseAdhocWateringParams(params)` → `{ plantId }`
     - `parseAdhocWateringRequest(body)` → `AdhocWateringCommand`
   - stosować `.strict()` i spójny format błędów (`HttpError`)
3. **Dodać service**:
   - nowy katalog `src/lib/services/watering-tasks/`
   - plik `create-adhoc-watering-task.ts` z funkcją:
     - `createAdhocWateringTask(supabase, { userId, plantId, command }): Promise<AdhocWateringResultDto>`
   - dodać:
     - `ensurePlantOwnership(...)` (analogicznie do `setPlantWateringPlan`)
     - `isUniqueViolation(error)` (jak w `set-watering-plan.ts`) i mapowanie na `409`
4. **Obsługa auth w route**:
   - skopiować wzorzec `getBearerToken` + `requireUserId` z `/api/calendar/*` (żeby działało i z Bearer tokenem, i z sesją)
5. **Zwrócić odpowiedź 201**:
   - envelope `{ data: { task }, error: null, meta: {} }`
   - dodać `Cache-Control: no-store`
6. **Dodać spójne logowanie**:
   - (opcjonalnie) generować `request_id` (`randomUUID`) i dodawać do `meta`
   - `console.error` dla błędów obsłużonych i nieobsłużonych z kontekstem
7. **Weryfikacja kontraktu**:
   - potwierdzić, że inserty spełniają check constraints:
     - `status/completed_*` spójne
     - `source/plan_id` spójne
     - `due_on = completed_on`
   - potwierdzić mapowanie konfliktu na `409` (unikalność plant+day)
