## API Endpoint Implementation Plan: GET `/api/calendar/day`

## 1. Przegląd punktu końcowego
- **Cel**: Zwrócić dzienną listę zadań podlewania (watering tasks) dla wskazanego dnia, wraz ze statusem oraz podstawowymi danymi rośliny.
- **Źródło danych**: `public.watering_tasks` (zadania) + `public.plants` (szczegóły rośliny).
- **Auth**: wymagane uwierzytelnienie (Supabase Auth), zgodnie z konwencją API (`Authorization: Bearer <token>` lub sesja z cookies SSR).
- **Zachowanie „brak danych”**: brak zadań dla dnia ≠ błąd; zwracamy `200` z pustą listą `items: []`.

## 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **Ścieżka**: `/api/calendar/day`
- **Query params**:
  - **Wymagane**:
    - **`date`**: `YYYY-MM-DD` (mapuje do `watering_tasks.due_on`)
  - **Opcjonalne**:
    - **`status`**: `pending | completed | all` (domyślnie `all`)
    - **`sort`**: `species_name | due_on`
    - **`order`**: `asc | desc`
- **Request body**: brak

## 3. Wykorzystywane typy (DTO i modele poleceń)
### DTO (już zdefiniowane w `src/types.ts`)
- **`CalendarDayResponseDto`**: `{ date: IsoDate; items: CalendarTaskSummaryDto[] }`
- **`CalendarTaskSummaryDto`**: `{ task: WateringTaskSummaryFields; plant: CalendarTaskPlantDto }`
- **`CalendarTaskPlantDto`**: `{ id: string; nickname: string | null; display_name: string }`
- **`WateringTaskSummaryFields`**: pola: `id, due_on, status, source, note, completed_at, completed_on`

### Nowe modele wejściowe (proponowane)
- **`GetCalendarDayQuery`** (service-level):
  - `userId: string`
  - `date: string` (IsoDate)
  - `status: 'pending' | 'completed' | 'all'`
  - `sort: 'species_name' | 'due_on'`
  - `order: 'asc' | 'desc'`

### Wspólne typy „envelope”
Zgodnie z konwencją w `.ai/api-plan.md` odpowiedzi mają kopertę:
- `data: ...`
- `error: null | { code: string; message: string; details?: Record<string, unknown> }`
- `meta: Record<string, unknown>`

## 4. Szczegóły odpowiedzi
### Sukces — `200 OK`

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
  "meta": {}
}
```

### Błędy (kody HTTP zgodnie z wymaganiami zadania)
- **`400`**: nieprawidłowe dane wejściowe (walidacja query params, niedozwolone wartości sort/order/status, błędny format daty)
- **`401`**: brak uwierzytelnienia / nieważny token
- **`500`**: błąd po stronie serwera (np. błąd zapytania do Supabase/Postgres)

## 5. Przepływ danych
1. **Route**: `src/pages/api/calendar/day.ts`
2. **Auth**: pobranie usera poprzez `locals.supabase.auth.getUser()` (wzorzec jak w `requireAuthUser`).
3. **Walidacja wejścia**: parse i walidacja `date/status/sort/order` (Zod).
4. **Service**: delegacja do serwisu domenowego (np. `src/lib/services/calendar/get-calendar-day.ts`), który:
   - wykonuje zapytanie do `watering_tasks` filtrowane po `user_id` i `due_on`,
   - opcjonalnie filtruje po `status`,
   - dołącza dane rośliny z `plants`,
   - mapuje wynik na `CalendarDayResponseDto`.
5. **Response**: zwrócenie obiektu w kopercie `{ data, error, meta }`.

## 6. Wyodrębnienie logiki do service
### Nowy serwis (zalecane)
- **Plik**: `src/lib/services/calendar/get-calendar-day.ts`
- **Odpowiedzialność**:
  - jedyne miejsce, w którym budujemy zapytanie Supabase do `watering_tasks` + join do `plants`
  - mapowanie rekordów DB → DTO
  - egzekwowanie „allow-list” sortowania (żeby route był cienki)

### Pomocniczy formatter nazwy rośliny (zalecane)
Ponieważ DTO wymaga `display_name`, a baza przechowuje `species_name` + `duplicate_index`, warto dodać helper:
- **Propozycja**: `src/lib/services/plants/format-plant-display-name.ts`
- **Reguła** (zgodna z przykładem): `display_name = `${species_name} #${duplicate_index + 1}``
- Cel: spójne wyświetlanie w całej aplikacji (frontend i API).

## 7. Walidacja danych wejściowych (Zod)
### Schemat query (route-level)
- **`date`**:
  - wymagane
  - regex: `^\d{4}-\d{2}-\d{2}$`
  - dodatkowo: walidacja semantyczna (np. `new Date(date + 'T00:00:00Z')` nie może być `Invalid Date`)
- **`status`**: enum `['pending','completed','all']`, default `all`
- **`sort`**: enum `['species_name','due_on']`, default (zalecenie): `due_on`
- **`order`**: enum `['asc','desc']`, default `asc`

### Mapowanie błędów walidacji → HTTP 400
- Dla `safeParse` niepowodzenia: rzucić `HttpError(400, 'Invalid query', 'VALIDATION_ERROR')`
- `details`: obiekt z polami i powodami (np. z `zodError.flatten().fieldErrors`)

## 8. Interakcja z bazą danych (zapytanie)
### Minimalny zakres pól
- Z `watering_tasks`: `id, due_on, status, source, note, completed_at, completed_on`
- Z `plants`: `id, nickname, species_name, duplicate_index` (do wyliczenia `display_name`)

### Filtry
- zawsze: `watering_tasks.user_id = user.id`
- zawsze: `watering_tasks.due_on = date`
- opcjonalnie: jeśli `status !== 'all'` → `watering_tasks.status = status`

### Sortowanie (allow-list)
- `sort=due_on`: `order('due_on', { ascending: order === 'asc' })` (opcjonalnie + dodatkowy porządek po roślinie)
- `sort=species_name`: sort po `plants.species_name` (w Supabase: `order('species_name', { foreignTable: 'plants', ascending: ... })` lub równoważnie przez relację FK)

## 9. Względy bezpieczeństwa
- **Uwierzytelnienie**:
  - endpoint wymaga zalogowanego użytkownika; brak usera → `401`
  - nie ufać `user_id` z klienta; zawsze brać `user.id` z Supabase Auth
- **Autoryzacja / izolacja tenantów**:
  - wymusić filtr po `user_id` w zapytaniu (dodatkowo do RLS)
  - RLS na `watering_tasks`/`plants` już istnieje (migration), ale nie należy polegać wyłącznie na RLS
- **Zapobieganie wstrzyknięciom przez sortowanie**:
  - `sort` i `order` wyłącznie z allow-list (Zod enum)
  - żadnego budowania SQL stringami
- **Ryzyko „missing auth propagation” (istotne w tym projekcie)**:
  - zapytania Supabase muszą wykonywać się w kontekście JWT użytkownika (Bearer/cookies),
  - jeżeli `locals.supabase` jest klientem „anon-only” bez tokena, `auth.getUser()` i selecty będą zwracać `401`/puste dane przez RLS.
  - **Plan wdrożeniowy** musi zapewnić request-scoped klienta z ustawionym tokenem (patrz kroki implementacji).

## 10. Obsługa błędów
### Scenariusze błędów i odpowiedzi
- **Brak `date`** → `400 VALIDATION_ERROR`
- **Błędny format `date`** → `400 VALIDATION_ERROR`
- **`status` spoza enum** → `400 VALIDATION_ERROR`
- **`sort`/`order` spoza enum** → `400 VALIDATION_ERROR`
- **Brak uwierzytelnienia / nieważny token** → `401 UNAUTHORIZED`
- **Błąd Supabase (np. `error` z `.select`)** → `500 <CODE>_QUERY_FAILED`
- **Nieoczekiwany wyjątek** → `500 INTERNAL_SERVER_ERROR`

### Rejestrowanie błędów „w tabeli błędów”
- W aktualnym schemacie migracji nie ma dedykowanej tabeli błędów HTTP/API.
- Dla MVP:
  - logować na serwerze (np. `console.error`) z korelacją: `request_id` (generowany per request) + `user_id` (jeśli dostępny).
- (Opcjonalnie, jeśli projekt przewiduje audyt): dodać osobną tabelę `api_errors` w przyszłej migracji — poza zakresem tego endpointu.

## 11. Wydajność
- Zapytanie jest selektywne: `user_id + due_on` (w migracji istnieje indeks `watering_tasks_user_due_on_idx`).
- Przy filtrowaniu `status` korzystny jest indeks `watering_tasks_user_status_due_on_idx`.
- Oczekiwany rozmiar wyniku dziennego jest mały (zwykle dziesiątki rekordów), więc nie wymaga paginacji.
- Unikać pobierania nieużywanych pól (select tylko wymaganych kolumn).

## 12. Kroki implementacji
1. **Dodać route**: utworzyć `src/pages/api/calendar/day.ts`
   - `export const prerender = false`
   - `export async function GET(context)` jako handler
2. **Zapewnić poprawny Supabase klient per-request (wymóg krytyczny)**
   - Upewnić się, że `context.locals.supabase` ma dostęp do JWT użytkownika z:
     - `Authorization: Bearer ...` **lub**
     - cookies SSR (jeśli stosowane)
   - Jeśli obecny middleware nie propaguje tokena:
     - zaktualizować `src/middleware/index.ts`, by tworzył request-scoped klienta z nagłówkiem `Authorization` (albo dodać `@supabase/ssr` i stworzyć server client oparty o cookies).
3. **Dodać parser query (Zod)**:
   - Plik: `src/lib/api/calendar/get-calendar-day-request.ts`
   - Eksport: `parseGetCalendarDayQuery(requestUrlOrSearchParams)` zwracający wartości z defaultami
   - W razie błędu: rzucać `HttpError(400, ..., 'VALIDATION_ERROR')` + `details`
4. **Zaimplementować service**:
   - Plik: `src/lib/services/calendar/get-calendar-day.ts`
   - Wejście: `GetCalendarDayQuery` + `supabase` (z `locals`)
   - Wyjście: `CalendarDayResponseDto`
   - Obsługa błędów Supabase: rzucać `HttpError(500, 'Failed to load calendar day', 'CALENDAR_DAY_QUERY_FAILED')`
5. **Dodać helper do `display_name`**:
   - Plik: `src/lib/services/plants/format-plant-display-name.ts`
   - Używać w service podczas mapowania DTO
6. **Zbudować odpowiedź w kopercie**:
   - `200`: `{ data: CalendarDayResponseDto, error: null, meta: {} }`
   - błędy: `{ data: null, error: { code, message, details? }, meta: {} }`
