## API Endpoint Implementation Plan: DELETE `/api/watering-tasks/{taskId}`

## 1. Przegląd punktu końcowego
- **Cel**: usunięcie wpisu podlewania (zadania) z tabeli `public.watering_tasks`.
- **Zachowanie zależne od `source`**:
  - **`source = "adhoc"`**: endpoint wykonuje **twarde usunięcie rekordu** (DELETE row).
  - **`source = "scheduled"`**: endpoint działa jako **“remove log / undo completion”**:
    - dozwolone tylko, gdy `status = "completed"`,
    - zamiast hard delete serwer **konwertuje zadanie na `pending`** (czyści pola completion), aby nie niszczyć materializowanego harmonogramu.
- **Inwarianty DB (muszą pozostać spełnione)**:
  - unikalność: `UNIQUE (plant_id, due_on)`,
  - spójność completion:
    - `completed` → `completed_at` i `completed_on` wymagane,
    - `pending` → oba NULL,
  - spójność source:
    - `scheduled` → `plan_id` NOT NULL,
    - `adhoc` → `status=completed` oraz `due_on = completed_on`.

## 2. Szczegóły żądania
- **Metoda HTTP**: `DELETE`
- **URL**: `/api/watering-tasks/{taskId}`
- **Parametry**:
  - **Wymagane**:
    - **Path param**: `taskId` (UUID)
    - **Query param**: `confirm=true` (dosłownie string `'true'`, jako bezpiecznik przed przypadkowym usunięciem)
  - **Opcjonalne**: brak
- **Body**: brak

### Walidacja wejścia (Zod + guard clauses)
- `taskId`:
  - schemat: `z.string().uuid()`
  - błąd → `400 INVALID_TASK_ID`
- `confirm`:
  - schemat: `z.literal('true')`
  - brak / inna wartość → `400 CONFIRMATION_REQUIRED`

### Wykorzystywane typy (DTO i Command modele)
#### DTO (już istniejące)
- `DeleteWateringTaskResultDto` (z `src/types.ts`): wynik w polu `data`.

#### Nowe modele (do dodania)
- **Command/Params** (dla service):
  - `DeleteWateringTaskCommand = { userId: string; taskId: string }`
- **Request parsing types** (dla `src/lib/api/...`):
  - `DeleteWateringTaskParams` (taskId)
  - `DeleteWateringTaskQuery` (confirm)
  - `DeleteWateringTaskRequest = DeleteWateringTaskParams & DeleteWateringTaskQuery`

## 3. Szczegóły odpowiedzi
- **Success 200**:
  - Envelope: `{ data, error, meta }`
  - `data` (zgodnie ze specyfikacją): `{ "deleted": true, "task_id": "uuid" }`
  - `error`: `null`
  - `meta`: `{}` (lub `{ request_id }` jeśli zespół zdecyduje się ujednolicić z `calendar/*`; patrz Kroki implementacji)

### Kody statusu (zgodnie ze specyfikacją endpointa)
- `200` — sukces
- `400` — błędne dane wejściowe (np. brak `confirm=true`, nieprawidłowy UUID)
- `401` — brak uwierzytelnienia
- `404` — zadanie nie istnieje / nie należy do użytkownika
- `409` — operacja niedozwolona (np. `source=scheduled` i `status=pending`)
- `500` — błąd serwera / błąd Supabase/PostgREST

## 4. Przepływ danych
### Warstwa API route (`src/pages/api/watering-tasks/[taskId].ts`)
1. Wygeneruj `request_id` (opcjonalnie; rekomendowane dla spójnego logowania).
2. Uwierzytelnienie:
   - użyj `requireAuthUser(locals)` (czyta sesję z cookies i/lub Authorization ustawione w middleware).
   - brak user → `401 UNAUTHORIZED/UNAUTHENTICATED` (zgodnie z konwencją błędów w repo).
3. Walidacja:
   - `parseDeleteWateringTaskRequest(params, url.searchParams)` (Zod).
4. Wywołaj service: `deleteWateringTask(locals.supabase, { userId, taskId })`.
5. Zwróć `200` z envelope `{ data: result, error: null, meta: {} }`.
6. Obsłuż błędy:
   - `HttpError` → `json(error.status, { data: null, error: { code, message, details? }, meta })`
   - pozostałe → `500 INTERNAL_SERVER_ERROR` + log `console.error(...)`

### Warstwa service (`src/lib/services/watering-tasks/delete-watering-task.ts`)
1. Pobierz task (single source of truth do rozgałęzienia):
   - SELECT minimalnych pól: `id, user_id, plant_id, plan_id, source, status`
   - filtrowanie: `.eq('id', taskId).eq('user_id', userId)`
   - brak → `404 TASK_NOT_FOUND`
2. Rozgałęzienie:
   - **Jeśli `source = 'adhoc'`**:
     - wykonaj `.delete()` po `id + user_id` i `.select('id').maybeSingle()`
     - brak data (race: już usunięte) → `404 TASK_NOT_FOUND`
   - **Jeśli `source = 'scheduled'`**:
     - jeśli `status !== 'completed'` → `409 NOT_ALLOWED`
     - wykonaj `.update({ status: 'pending', completed_at: null, completed_on: null, note: null })`
       - rekomendacja: **czyścić `note`** aby nie pozostawić “notatki o wykonaniu” po cofnięciu.
     - `.select('id').maybeSingle()`, brak → `404 TASK_NOT_FOUND` (race)
   - **W przeciwnym razie** (nieznany enum / niespójne dane): `500 TASK_INVALID_STATE`
3. (Opcjonalnie, ale rekomendowane) Regeneracja przyszłych zadań:
   - Cel: utrzymać spójność kalendarza po “usunieciu logu”, zwłaszcza gdy plan ma `schedule_basis` zależne od historii wykonań.
   - Podejście:
     - jeśli task ma `plan_id` (scheduled) → pobierz plan po `id+user_id` i wywołaj RPC `regenerate_watering_tasks` analogicznie do `setPlantWateringPlan`.
     - jeśli task jest `adhoc` (plan_id = null) → pobierz aktywny plan dla `plant_id` (`is_active=true`) i jeśli istnieje, wywołaj `regenerate_watering_tasks`.
   - Jeśli regeneracja się nie powiedzie:
     - MVP: rzucić `500 TASK_REGENERATION_FAILED` (i log), żeby klient wiedział, że stan może być niespójny.
     - Docelowo: rozważyć transakcyjne RPC (patrz “Zagrożenia”).

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**: wymagane (Supabase Auth); brak user → `401`.
- **Autoryzacja / izolacja tenantów**:
  - zawsze filtruj po `user_id` w zapytaniach (`eq('user_id', userId)`);
  - zakładaj, że RLS jest włączone, ale nie polegaj wyłącznie na nim w service (defense-in-depth).
- **CSRF (sesje cookie)**:
  - DELETE jest operacją mutującą; jeśli aplikacja dopuszcza auth przez cookies, rozważ:
    - wymaganie `Authorization: Bearer` dla metod nie-GET **albo**
    - walidację `Origin`/`Host` dla metod mutujących.
- **Bezpiecznik `confirm=true`**:
  - wymusza intencjonalność operacji i redukuje ryzyko przypadkowych kliknięć / błędów klienta.

## 6. Obsługa błędów
### Scenariusze błędów (przykładowe mapowanie)
- `401 UNAUTHORIZED/UNAUTHENTICATED`: brak sesji / tokena.
- `400 INVALID_TASK_ID`: `taskId` nie jest UUID.
- `400 CONFIRMATION_REQUIRED`: brak `confirm=true`.
- `404 TASK_NOT_FOUND`: brak rekordu o podanym `id` dla `user_id`.
- `409 NOT_ALLOWED`: próba “delete” dla `source=scheduled` gdy `status=pending` (lub inny stan niedozwolony).
- `500`:
  - błąd PostgREST/Supabase przy SELECT/UPDATE/DELETE,
  - niespójny stan danych (np. nieoczekiwany `source/status`),
  - (jeśli włączone) błąd regeneracji zadań.

### Logowanie błędów
- Repo nie ma dedykowanej “tabeli błędów”; standardem jest `console.error(...)` z kontekstem.
- Rekomendacja minimum:
  - loguj `request_id`, `userId` (opcjonalnie), `taskId`, oraz `error`.
- Opcjonalnie (później): wprowadzić tabelę audytu/zdarzeń dla operacji mutujących (poza zakresem tego endpointa).

## 7. Wydajność
- Operacje DB są lekkie (SELECT + UPDATE/DELETE).
- (Opcjonalna) regeneracja zadań to potencjalnie najdroższy krok:
  - ogranicz ją do przypadków, gdy plan jest aktywny i logika harmonogramu tego wymaga,
  - RPC powinno regenerować wyłącznie “przyszłe niewykonane” (zgodnie z założeniami DB planu).

## 8. Kroki implementacji
1. **Dodaj parser requestu**:
   - `src/lib/api/watering-tasks/delete-watering-task-request.ts`
   - Zod schemas: `taskId` UUID + `confirm: 'true'`
   - eksport: `parseDeleteWateringTaskRequest(...)` + typy requestu.
2. **Dodaj service**:
   - `src/lib/services/watering-tasks/delete-watering-task.ts`
   - logika rozgałęzienia `adhoc` vs `scheduled` zgodnie z inwariantami DB i specyfikacją.
   - mapowanie błędów do `HttpError` z kodami z sekcji “Obsługa błędów”.
3. **Dodaj API route**:
   - `src/pages/api/watering-tasks/[taskId].ts`
   - `export const prerender = false`
   - `DELETE` handler:
     - `requireAuthUser(locals)`
     - `parseDeleteWateringTaskRequest(params, url.searchParams)`
     - `deleteWateringTask(locals.supabase, { userId, taskId })`
     - odpowiedź `200` z envelope.
4. **Ujednolicenie envelope i meta**:
   - wybierz jeden styl dla `meta`:
     - `meta: {}` (jak `plants/*`) **albo**
     - `meta: { request_id }` (jak `calendar/*`)
   - rekomendacja: **dodać `request_id`** dla lepszego debugowania produkcji (bez zmiany kontraktu `data`).
5. **(Opcjonalnie) Regeneracja przyszłych zadań po “delete”**:
   - jeśli zespół uzna to za wymagane w MVP, dodać w service:
     - lookup aktywnego planu / planu z `plan_id`,
     - wywołanie RPC `regenerate_watering_tasks` analogicznie do `setPlantWateringPlan`.
6. **Testy i weryfikacja ręczna (checklista)**:
   - `401`: brak tokena/cookies.
   - `400`: brak `confirm=true`.
   - `404`: taskId nie istnieje / jest cudzy.
   - `200` + hard delete: `adhoc`.
   - `409`: `scheduled` + `pending`.
   - `200` + undo: `scheduled` + `completed` (sprawdź, że `completed_at/completed_on` są NULL i `status=pending`).
   - (Jeśli włączone) sprawdź, że kalendarz/regeneracja odzwierciedla zmianę.

