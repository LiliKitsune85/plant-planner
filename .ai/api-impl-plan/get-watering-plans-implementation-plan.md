# API Endpoint Implementation Plan: GET /api/plants/{plantId}/watering-plans

_Dokument zapisany w `.ai/view-implementation-plan.md`._

## 1. Przegląd punktu końcowego
Lista wszystkich wersji planów podlewania dla jednej rośliny użytkownika. Kończy się na danych właściciela, respektuje filtry (`active_only`) i umożliwia paginację z wykorzystaniem kursora po `valid_from` + `id`, aby zapewnić stabilne sortowanie zarówno rosnące, jak i malejące.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL: `/api/plants/{plantId}/watering-plans`
- Parametry:
  - Wymagane: `plantId` (UUID w ścieżce)
  - Opcjonalne (query):
    - `active_only` → `true|false`, domyślnie `false`
    - `sort` → obecnie tylko `valid_from`, domyślnie `valid_from`
    - `order` → `asc|desc`, domyślnie `desc`
    - `limit` → `1..50`, domyślnie 20
    - `cursor` → zakodowany w Base64 JSON `{"valid_from":"ISO","id":"uuid"}` wskazujący pierwszy rekord następnej strony
- Request body: brak (ignorować payload przychodzący).
- Walidacja:
  - Reużyj `parsePlantIdParams` dla `plantId`.
  - Nowy moduł `parseWateringPlanHistoryQuery` wykorzystujący `zod` do walidacji query stringów oraz dekodowania kursora (z weryfikacją ISO-timestamp i UUID).
  - Wymuś `limit` w zakresie 1..50 i znormalizuj `active_only`/`order` do boolean/enum.

## 3. Wykorzystywane typy
- `WateringPlanHistoryItemDto` oraz `WateringPlanSummaryDto` (`src/types.ts`) jako elementy listy.
- `PaginatedListDto<T>` + lokalny `MetaDto` `{ next_cursor: string | null }` dla odpowiedzi API.
- Nowy `ListWateringPlansQuery` (service layer) zawierający: `userId`, `plantId`, `activeOnly`, `limit`, `order`, `cursor` (`{validFrom: string; id: string} | null`).
- Nowy `ListWateringPlansResult` (service layer) z polami `items: WateringPlanHistoryItemDto[]` i `nextCursor: string | null`.
- `HttpError` z `src/lib/http/errors.ts` do sygnalizacji błędów warstwy HTTP.

## 4. Szczegóły odpowiedzi
- Status 200:
  ```json
  {
    "data": {
      "items": [WateringPlanHistoryItemDto, ...]
    },
    "error": null,
    "meta": {
      "next_cursor": "opaque|string|null"
    }
  }
  ```
- `meta.next_cursor` ustawiaj tylko, jeśli liczba rekordów == `limit`; buduj kursor na podstawie ostatniego rekordu (`valid_from`, `id`) i koduj `Buffer.from(JSON.stringify(cursor)).toString('base64url')`.
- `items` muszą odzwierciedlać kolejność wynikającą z `order`. Przy `active_only=true` filtruj `is_active=true`.

## 5. Przepływ danych
1. `GET` trafia do Astro endpointu `src/pages/api/plants/[plantId]/watering-plans.ts`.
2. Handler wywołuje `requireAuthUser(locals)` → uzyskuje `userId`.
3. Parsuje params (`parsePlantIdParams`) i query (`parseWateringPlanHistoryQuery`).
4. Wywołuje nowy serwis `listWateringPlans(supabase, query)`:
   - Najpierw potwierdza istnienie rośliny dla `userId` (select `id` z `plants`, `.eq('id', plantId).eq('user_id', userId)`).
   - Buduje zapytanie do `watering_plans` z filtrami `plant_id`, `is_active` (gdy potrzebne), sortowaniem `.order('valid_from', { ascending: order === 'asc' })` oraz drugorzędnie `.order('id', { ascending: ... })`.
   - Jeśli przekazano kursor, dodaje warunek `gte/lte` na (`valid_from`, `id`) zgodnie z kierunkiem sortowania, aby uzyskać stronicowanie typu keyset.
   - Ogranicza wynik `.limit(limit + 1)` dla rozpoznania istnienia kolejnej strony.
5. Serwis mapuje wiersze Supabase (kolumny: `id`, `is_active`, `valid_from`, `valid_to`, `interval_days`, `horizon_days`, `schedule_basis`, `start_from`, `custom_start_on`, `overdue_policy`, `was_ai_suggested`, `was_ai_accepted_without_changes`, `ai_request_id`) do `WateringPlanHistoryItemDto`.
6. Handler serializuje wynik do kontraktu API i ustawia `meta.next_cursor`.

## 6. Względy bezpieczeństwa
- Autoryzacja: tylko zalogowany użytkownik (Supabase auth). Brak user → `HttpError(401)`.
- Kontrola dostępu: dodatkowe zapytanie w serwisie upewnia się, że `plant_id` należy do `userId`. Jeśli nie, zwróć `HttpError(404, 'Plant not found', 'PLANT_NOT_FOUND')` aby unikać ujawniania obecności zasobów.
- Walidacja wejścia: Zod + rygorystyczne parsery eliminują możliwość SQL injection (Supabase query builder + whitelist kolumn).
- Kursor: walidacja i limit długości (np. `<= 256` znaków) zapobiegają atakom DOS poprzez ogromne kursory i pętle dekodowania.
- Brak danych wrażliwych w odpowiedzi; ewentualne `ai_request_id` to UUID - potwierdź, że nie ujawnia cudzych rekordów (pochodzi z tej samej tabeli, więc jest OK).

## 7. Obsługa błędów
- `401 UNAUTHORIZED`: zwracany przez `requireAuthUser`.
- `400 BAD_REQUEST`: niepoprawny `plantId`, `limit`, `cursor` nie do zdekodowania (`INVALID_CURSOR`), nieobsługiwany `order`/`sort`.
- `404 NOT_FOUND`: roślina nie istnieje dla użytkownika.
- `500 INTERNAL_SERVER_ERROR`: błąd Supabase (`WATERING_PLAN_QUERY_FAILED`), niespodziewane wyjątki. Loguj stack w konsoli Astro; jeśli w przyszłości powstanie tabela logów, to ten sam punkt będzie służyć do insertu.
- Użyj standardowego envelope `{ data: null, error: { code, message }, meta: null }` jeśli repo już taki stosuje; w przeciwnym razie zachowaj strukturę wg PRD (items + error + meta).

## 8. Rozważania dotyczące wydajności
- Keyset pagination na `valid_from` + `id` eliminuje koszty `OFFSET`.
- Indeks: polegamy na unikatowym `(plant_id) WHERE (is_active)` oraz domyślnym PK `id`; warto rozważyć dodanie indeksu `CREATE INDEX ON watering_plans (plant_id, valid_from DESC)` jeśli zapytania będą wolne (plan do backlogu).
- Limit górny 50 wierszy ogranicza ilość danych; w przypadku większych list front może stronicować.
- Zapytania wykorzystują tylko dwie tabele (`plants`, `watering_plans`) i proste filtry, więc mieszczą się w limitach Supabase bez dodatkowej optymalizacji.

## 9. Etapy wdrożenia
1. **Dodaj walidator zapytań** `src/lib/api/plants/get-watering-plan-history-request.ts` (lub rozszerz istniejący plik) z definicją Zod dla query parametrów oraz funkcją `parseWateringPlanHistoryQuery`.
2. **Utwórz serwis** `src/lib/services/watering-plans/list-watering-plans.ts`:
   - Typy zapytań/rezultatów.
   - Zapytanie Supabase z kontrolą plant ownership i keyset pagination.
   - Mapowanie rekordów → DTO.
3. **Zaimplementuj endpoint** `src/pages/api/plants/[plantId]/watering-plans.ts`:
   - `export const GET`.
   - Pobranie usera, parsowanie parametrów, wywołanie serwisu, budowa odpowiedzi JSON + ustawienie `export const prerender = false`.
   - Obsługa błędów przez `try/catch` i `isHttpError`.
