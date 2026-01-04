## API Endpoint Implementation Plan: GET `/api/watering-tasks`

## 1. Przegląd punktu końcowego
- **Cel**: Zwrócić listę zadań podlewania (`public.watering_tasks`) dla zalogowanego użytkownika z możliwością filtrowania, sortowania i paginacji kursorowej.
- **Główne zastosowanie**: debug/timeline i widoki pomocnicze (kalendarz ma osobne, zoptymalizowane endpointy).
- **Zasada bezpieczeństwa**: brak bezpośrednich zapisów z klienta do `watering_tasks` (ten endpoint jest tylko odczytowy).

## 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/api/watering-tasks`
- **Uwierzytelnianie**:
  - **Wymagane**: użytkownik zalogowany w Supabase.
  - **Obsługa tokenu**: zgodnie z istniejącymi endpointami:
    - jeśli `Authorization: Bearer <token>` obecny → `locals.supabase.auth.getUser(token)`
    - w przeciwnym wypadku → `locals.supabase.auth.getUser()` (cookies/session)

### Parametry zapytania (query params)
Wszystkie parametry są **opcjonalne** (ale część kombinacji może być walidowana jako niespójna).

- **`from`**: `YYYY-MM-DD` (ISO date) – dolna granica `due_on` (włącznie)
- **`to`**: `YYYY-MM-DD` (ISO date) – górna granica `due_on` (włącznie)
- **`plant_id`**: `uuid` – filtr po roślinie
- **`status`**: `pending | completed` – filtr statusu
- **`source`**: `scheduled | adhoc` – filtr po źródle zadania
- **`sort`**: `due_on | created_at` – pole sortowania
- **`order`**: `asc | desc` – kierunek sortowania
- **`limit`**: `int` – limit rekordów na stronę
- **`cursor`**: `string` – kursor paginacji (base64url-encoded JSON)

### Domyślne wartości i ograniczenia (zalecane)
- **`sort`**: domyślnie `due_on`
- **`order`**: domyślnie `asc`
- **`limit`**: domyślnie `50`, min `1`, max `100`
- **Zakres dat (`from`/`to`)**:
  - jeśli oba podane: `from <= to` (w przeciwnym razie błąd walidacji)
  - zalecany limit zakresu (np. max 366 dni) dla ochrony wydajności
- **Spójność filtrów** (na podstawie reguł DB):
  - jeśli `source=adhoc` oraz `status=pending` → **błąd walidacji** (w DB ad-hoc zawsze jest `completed`)

## 3. Wykorzystywane typy (DTO i modele komend)
### Typy DTO (frontend/backend shared) z `src/types.ts`
- **`WateringTaskListItemDto`**: pojedynczy element listy (odzwierciedla kolumny `watering_tasks`)
- **`WateringTaskListDto`**: `{ items: WateringTaskListItemDto[] }`
- **`PaginatedListDto<T>`**: wspólny generyk listy (meta paginacji w `meta`)

### Typy wewnętrzne (backend-only) – do dodania
W celu utrzymania spójnych kontraktów między parserem requestu i serwisem:
- **`GetWateringTasksFilters`** (np. w `src/lib/services/watering-tasks/types.ts`):
  - `from?: string`, `to?: string`, `plantId?: string`, `status?: 'pending' | 'completed'`, `source?: 'scheduled' | 'adhoc'`
  - `sort: 'due_on' | 'created_at'`, `order: 'asc' | 'desc'`
  - `limit: number`, `cursor?: string`
- **`GetWateringTasksQuery`**: `GetWateringTasksFilters & { userId: string }`
- **`ListWateringTasksResult`**: `{ items: WateringTaskListItemDto[]; nextCursor: string | null }`
- **Cursor payload** (np. `ListWateringTasksCursorPayload`):
  - minimalnie: `userId`, `sort`, `order`, `sortValue`, `id`
  - zalecane: również snapshot filtrów (`from`, `to`, `plantId`, `status`, `source`, `limit`) aby wykrywać niespójne użycie kursora

## 4. Szczegóły odpowiedzi
### Sukces (200)
Zwraca standardową kopertę JSON (jak w istniejących endpointach):
- **`data`**: `WateringTaskListDto`
- **`error`**: `null`
- **`meta`**: co najmniej `next_cursor` (jeśli jest kolejna strona) i (opcjonalnie) `request_id`

Przykład:

```json
{
  "data": {
    "items": [
      {
        "id": "…",
        "plant_id": "…",
        "plan_id": "…",
        "due_on": "2026-01-04",
        "status": "pending",
        "source": "scheduled",
        "note": null,
        "completed_at": null,
        "completed_on": null,
        "created_at": "2026-01-01T10:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      }
    ]
  },
  "error": null,
  "meta": {
    "next_cursor": null,
    "request_id": "…"
  }
}
```

### Błędy (kody i format)
- **400**: nieprawidłowe parametry query / niespójne filtry / nieprawidłowy `cursor`
  - kody: np. `VALIDATION_ERROR`, `INVALID_QUERY_PARAMS`, `INVALID_CURSOR`
- **401**: brak uwierzytelnienia
  - kod: `UNAUTHENTICATED`
- **404**: opcjonalnie, jeśli `plant_id` podany i roślina nie istnieje dla użytkownika
  - kod: `PLANT_NOT_FOUND`
- **500**: błąd serwera / błąd zapytania do DB
  - kod: `INTERNAL_SERVER_ERROR` oraz bardziej szczegółowy kod w `HttpError` w serwisie (np. `WATERING_TASKS_QUERY_FAILED`)

## 5. Przepływ danych
1. **Route handler**: `src/pages/api/watering-tasks/index.ts`
2. **Walidacja wejścia**: parser query w `src/lib/api/watering-tasks/get-watering-tasks-request.ts` (Zod)
3. **Autoryzacja**: `requireUserId()` (jak w `/api/calendar/*`)
4. **(Opcjonalnie) weryfikacja `plant_id`**:
   - jeśli `plant_id` podany → lekki SELECT `plants.id` z `.eq('user_id', userId).eq('id', plantId)`
   - jeśli brak → 404 `PLANT_NOT_FOUND` (bez wycieku danych innych tenantów)
5. **Serwis**: `src/lib/services/watering-tasks/list-watering-tasks.ts`
   - buduje zapytanie do `watering_tasks`:
     - zawsze `.eq('user_id', userId)`
     - filtry: `plant_id`, `status`, `source`, `from/to` (na `due_on`)
     - sortowanie: `.order(sort, …).order('id', …)` dla deterministyczności
     - paginacja: `limit + 1`, generowanie `next_cursor` na podstawie ostatniego elementu strony
6. **Odpowiedź**: koperta `{ data, error, meta }` zgodna z resztą API

## 6. Względy bezpieczeństwa
- **AuthN**: wymagany użytkownik (401 jeśli brak).
- **AuthZ / multi-tenant**:
  - zawsze filtr `.eq('user_id', userId)` w zapytaniu (dodatkowo do RLS) dla bezpieczeństwa i indeksów.
  - jeśli weryfikujemy `plant_id`, weryfikacja musi być wykonywana w kontekście `user_id`.
- **Walidacja wejścia**:
  - daty `from/to` jako poprawny ISO date (`YYYY-MM-DD`) z walidacją kalendarzową (nie tylko regex).
  - `plant_id` jako UUID.
  - whitelist dla enumów (`status`, `source`, `sort`, `order`).
  - limitowane `limit` (ochrona przed DoS).
- **Bezpieczeństwo kursora**:
  - kursor jest tylko wskaźnikiem – nie może umożliwiać eskalacji uprawnień (musi zawierać i weryfikować `userId`).
  - jeśli kursor zawiera filtry/sort, należy je porównać z aktualnym requestem (jak w `decodeListPlantsCursor`), aby uniknąć “mieszania” stron.
- **Wstrzyknięcia do stringowego filtra** (Supabase `.or(...)`):
  - przy budowie filtra kursora używać escapowania wartości (jak `escapeLogicalValue` w `list-plants.ts`).

## 7. Obsługa błędów
### Scenariusze błędów (minimalny zestaw)
- **400 INVALID_QUERY_PARAMS / VALIDATION_ERROR**:
  - niepoprawny format daty
  - `from > to`
  - `limit` poza zakresem
  - nieznane wartości enumów
  - `source=adhoc` + `status=pending`
- **400 INVALID_CURSOR**:
  - kursor nie jest base64url
  - JSON w kursorze niepoprawny
  - brak wymaganych pól kursora
  - kursor należy do innego użytkownika lub nie pasuje do sortowania/filtrów
- **401 UNAUTHENTICATED**: brak sesji/tokena
- **404 PLANT_NOT_FOUND** (jeśli zaimplementujemy weryfikację `plant_id`)
- **500 WATERING_TASKS_QUERY_FAILED**: Supabase zwraca `error` lub `data` jest puste

### Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)
- W obecnym planie bazy brak dedykowanej tabeli na błędy API (poza polami błędów w `public.ai_requests`, które dotyczą wyłącznie AI).
- **Rekomendacja MVP**: logowanie do `console.error` z kontekstem (`requestId`, `userId`, parametry filtrów) jak w `getCalendarDay/getCalendarMonthSummary`.
- **Opcja rozbudowy**: w przyszłości osobna tabela `api_error_events` (request_id, route, user_id, code, message, details, created_at) – poza zakresem tego endpointu.

## 8. Wydajność
- **Indeksy wspierające** (z `db-plan.md`):
  - `watering_tasks (user_id, due_on)`
  - `watering_tasks (user_id, status, due_on)`
  - `watering_tasks (plant_id, due_on)`
  - częściowy: `watering_tasks (user_id, due_on) WHERE status='pending'`
- **Ryzyko**: sortowanie po `created_at` może wymagać dodatkowego indeksu:
  - jeśli `sort=created_at` ma być częste → rozważyć `INDEX watering_tasks_user_created_at_idx ON watering_tasks (user_id, created_at)`
- **Paginacja kluczowa (keyset)**:
  - preferowana nad offset dla dużych zbiorów (stabilność i wydajność).
- **Limit zakresu dat**:
  - rekomendowany, aby unikać ciężkich zapytań bez sensownego “okna czasowego”.

## 9. Kroki implementacji
1. **Dodać route**: utworzyć `src/pages/api/watering-tasks/index.ts`
   - `export const prerender = false`
   - `export const GET: APIRoute = …`
   - skopiować sprawdzony wzorzec koperty i `requireUserId()` z `src/pages/api/calendar/day.ts`
   - obsługa błędów przez `HttpError/isHttpError`, 500 dla wyjątków nieobsłużonych
2. **Dodać parser query (Zod)**: `src/lib/api/watering-tasks/get-watering-tasks-request.ts`
   - schema dla wszystkich parametrów (daty, uuid, enumy, limit/cursor)
   - walidacja krzyżowa (`from <= to`, spójność `source`/`status`)
   - rzucanie `HttpError(400, …)` dla błędów walidacji (zgodnie z wymaganiem użycia 400 dla nieprawidłowych danych wejściowych)
3. **Zdefiniować typy serwisu**: `src/lib/services/watering-tasks/types.ts`
   - `GetWateringTasksFilters`, `GetWateringTasksQuery`, `ListWateringTasksResult`
   - typy sortowania i filtrów jako uniony literalne
4. **Zaimplementować kursor**:
   - `src/lib/services/watering-tasks/list-watering-tasks-cursor.ts`
   - wzorzec jak `src/lib/services/plants/list-plants-cursor.ts`:
     - wersjonowanie payload (`version`)
     - base64url encoding/decoding
     - walidacja kontekstu (`userId`, `sort`, `order` + opcjonalnie filtry)
     - błędy jako `InvalidCursorError` (400)
5. **Zaimplementować serwis listujący**: `src/lib/services/watering-tasks/list-watering-tasks.ts`
   - `select` tylko kolumn potrzebnych do `WateringTaskListItemDto`
   - zawsze `.eq('user_id', userId)`
   - dodać filtry:
     - `plant_id` → `.eq('plant_id', plantId)`
     - `status` → `.eq('status', status)`
     - `source` → `.eq('source', source)`
     - `from/to` → `.gte('due_on', from)`, `.lte('due_on', to)`
   - dodać paginację:
     - `cursor` → `.or(...)` z deterministycznym filtrem jak w `listPlants`
     - `limit + 1` i wyliczenie `nextCursor`
   - przy błędzie supabase: `console.error` + `throw new HttpError(500, …, 'WATERING_TASKS_QUERY_FAILED')`
6. **(Opcjonalnie) walidacja `plant_id` → 404**:
   - mały helper/serwis (np. `src/lib/services/plants/require-plant.ts`) lub inline check w route
7. **Integracja w route**:
   - `filters = parseGetWateringTasksQuery(url.searchParams)`
   - `userId = await requireUserId(locals, request)`
   - `result = await listWateringTasks(locals.supabase, { userId, filters })`
   - `data: WateringTaskListDto = { items: result.items }`
   - `meta: { next_cursor: result.nextCursor, request_id }`
8. **Spójność formatów i ergonomia klienta**:
   - utrzymać `meta.next_cursor` (jak `/api/plants`)
   - rozważyć `Cache-Control: no-store` (dane prywatne), jeśli w projekcie uznane za standard
9. **Weryfikacja manualna**:
   - sprawdzić przypadki: brak auth, złe daty, `from>to`, `source=adhoc&status=pending`, cursor mismatch, oraz filtrowanie i sortowanie.

