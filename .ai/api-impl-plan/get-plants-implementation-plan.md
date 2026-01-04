# API Endpoint Implementation Plan: GET `/api/plants`

## 1. Przegląd punktu końcowego
Lista wszystkich roślin zalogowanego użytkownika wraz z metadanymi i informacją o kolejności duplikatów. Endpoint zapewnia filtrowanie, wyszukiwanie pełnotekstowe, sortowanie, paginację kursorem i obsługę scenariuszy nieautoryzowanych.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL: `/api/plants`
- Parametry zapytań:
  - **Wymagane:** brak (poza ważną sesją Supabase).
  - **Opcjonalne:**
    - `q`: string 1..120 znaków; case-insensitive ILIKE na `species_name`/`nickname`.
    - `species`: dokładny string dopasowujący `species_name_normalized` (service powinien znormalizować wejście pomocniczą funkcją).
    - `sort`: jedno z `created_at | species_name | updated_at`; domyślnie `created_at`.
    - `order`: `asc | desc`; domyślnie `desc`.
    - `limit`: liczba całkowita 1..100 (domyślnie 20) kontrolująca liczbę rekordów.
    - `cursor`: opcjonalny opaque string (np. base64 JSON `{ sortField, sortValue, id }`) potrzebny do stronicowania.
- Body: brak.
- Walidacja: Zod schema w handlerze (np. `z.object({ q: z.string().min(1).max(120).optional(), ... })`) + niestandardowa walidacja kursora (decode + shape check). Błędne wartości → `400`.

## 3. Wykorzystywane typy
- `PlantListItemDto`, `PlantSummaryDto`, `PlantListDto` z `src/types.ts` dla warstwy odpowiedzi.
- Nowy `ListPlantsQuery` (np. w `src/lib/services/plants/types.ts`) opisujący zweryfikowane parametry (`search`, `speciesNormalized`, `sort`, `order`, `limit`, `cursor`).
- Nowy `ListPlantsResult` zawierający `items: PlantListItemDto[]` i `nextCursor: string | null`.
- Ewentualny helper `CursorPayload` (np. `{ sortValue: string | Date, id: string }`) używany tylko w serwisie.

## 4. Szczegóły odpowiedzi
- Statusy:
  - `200 OK`: poprawna lista (nawet gdy pusta).
  - `400 Bad Request`: niepoprawne parametry (`limit`, `cursor`, `sort`).
  - `401 Unauthorized`: brak/niepoprawny token Supabase.
  - `500 Internal Server Error`: błąd Supabase/lokalny wyjątek.
- Struktura sukcesu (zgodna z planem API):
  ```json
  {
    "data": {
      "items": [PlantListItemDto]
    },
    "error": null,
    "meta": {
      "next_cursor": "opaque|string|null"
    }
  }
  ```
- `PlantListItemDto` obejmuje pola roślin + obliczane `display_name` (`species_name` + `#(duplicate_index + 1)`).

## 5. Przepływ danych
1. Astro API handler (`src/pages/api/plants.ts`) pobiera `locals.supabase` oraz `locals.session`.
2. Waliduje parametry za pomocą Zod → tworzy `ListPlantsQuery`.
3. Wywołuje serwis `listPlants` (np. `src/lib/services/plants/list-plants.ts`) z Supabase clientem i `userId`.
4. Serwis buduje zapytanie:
   - `from('plants').select('*')`.
   - `eq('user_id', userId)`.
   - `ilike('species_name', %q%)` i `ilike('nickname', %q%)` poprzez `or`.
   - `eq('species_name_normalized', normalizeSpecies(species))` dla filtru.
   - Sortowanie po polu + `id` jako tie-breaker.
   - Paginacja kursorem: decode `cursor`, dodaj warunek `greaterThan`/`lessThan` w zależności od `order`.
   - `limit(limit + 1)` w celu detekcji `next_cursor`.
5. Serwis mapuje rekordy do `PlantListItemDto`, oblicza `display_name`.
6. Tworzy nowy cursor (jeśli `limit + 1` rekord) i zwraca `items` skrócone do limitu + `nextCursor`.
7. Handler opakowuje wynik w `data/meta` i zwraca JSON 200.

## 6. Względy bezpieczeństwa
- Autoryzacja: wymagaj aktywnej sesji Supabase (middleware). Brak sesji → `401`.
- Multi-tenant isolation: każdorazowo filtrować `user_id`.
- Walidować `limit` i `cursor`, aby zapobiec DoS / enumeracji ID.
- Traktować `cursor` jako opaque; podpisywać HMAC lub co najmniej kodować base64 JSON + include `user_id` aby uniemożliwić reuse między kontami.
- Używać typowanych zapytań Supabase, brak raw SQL → ochrona przed injection.
- Logować próby błędnych kursów / nadużyć przez centralny logger (np. `console.error` lub `AstroLogger.error`), nie przekazując szczegółów klientowi.

## 7. Obsługa błędów
- Walidacja:
  - `ZodError` → 400 z komunikatem `Invalid query parameters`.
  - `InvalidCursorError` (własna klasa) → 400.
- Autoryzacja:
  - Brak `session` → 401 i `error: { code: 'unauthenticated' }`.
- Błędy danych:
  - Gdy `species` nie istnieje → wciąż 200 z pustą listą (nie 404, bo to lista).
- Błędy serwera:
  - Supabase throws → log stack trace, zwróć 500 `error: { code: 'internal_error' }`.
- Każdy błąd powinien być zarejestrowany w loggerze (brak dedykowanej tabeli błędów; jeżeli w przyszłości będzie `error_logs`, można dodać hook).

## 8. Rozważania dotyczące wydajności
- Indeksy:
  - DB ma unikalny `(user_id, species_name_normalized, duplicate_index)`; dodać composite index `(user_id, created_at, id)` jeśli brak (sprawdzić w migracji) dla optymalnego sortu.
- Limit <= 100 zapobiega dużym transferom.
- Cursor pagination eliminuje offset scans → stała złożoność przy dużych danych.
- Używać `select('id, species_name, ...')` zamiast `select('*')` aby ograniczyć payload.
- Można cache'ować `normalizeSpecies` helper aby uniknąć wielokrotnych importów.

## 9. Etapy wdrożenia
1. **Przygotowanie typów**: utwórz `ListPlantsQuery` i ewentualne cursor helpers w `src/lib/services/plants/types.ts`.
2. **Helpery cursorów**: dodaj `encodeCursor`/`decodeCursor` (np. w `src/lib/utils.ts` lub dedykowanym pliku) z walidacją struktury i `user_id`.
3. **Serwis listujący**: utwórz `src/lib/services/plants/list-plants.ts` implementujący logikę filtrów, sortowania i paginacji, zwracający `items` + `nextCursor`.
4. **Walidacja zapytań**: w handlerze utwórz Zod schema; zamapuj na `ListPlantsQuery`.
5. **Endpoint Astro**: utwórz/uzupełnij `src/pages/api/plants.ts`:
   - `export const prerender = false`.
   - Pobierz user session z `locals`.
   - Obsłuż walidację, wywołaj serwis, zbuduj odpowiedź.
   - Dodaj strukturalny error handling (try/catch + mapowanie kodów).
6. **Testy/manual QA**:
   - Jednostkowe dla `decodeCursor` i `listPlants`.
   - Ręczne curl/httpie: bez auth (401), z auth i filtrami, weryfikacja `next_cursor`.
7. **Observability**: upewnij się, że logi błędów trafiają do konsoli/monitoringu; dodaj structured logging (np. `logger.error({ err, userId }, 'listPlants failed')`).
