# API Endpoint Implementation Plan: POST `/api/plants`

## 1. Przegląd punktu końcowego
- Tworzy nową roślinę przypisaną do aktualnie uwierzytelnionego użytkownika Supabase.
- Automatycznie wyznacza `duplicate_index` w oparciu o znormalizowaną nazwę gatunku per użytkownik i generuje pole `display_name`.
- Opcjonalnie uruchamia proces AI do zasugerowania planu podlewania; niezależnie od wyniku AI, rekord rośliny musi zostać utworzony.
- Zachowuje niezmienność `species_name` po wstawieniu (wspiera to DB trigger zdefiniowany w schemacie).

## 2. Szczegóły żądania
- **Metoda HTTP**: `POST`
- **URL**: `/api/plants`
- **Nagłówki**: `Content-Type: application/json`, `Authorization: Bearer <supabase-access-token>`
- **Parametry body**:
  - **Wymagane**: `species_name` (string 1–120, trim, niepusty).
  - **Opcjonalne**: `nickname` (null lub string 1–80), `description` (string/null), `purchase_date` (ISO date `YYYY-MM-DD`), `photo_path` (string/null, tylko ścieżki Supabase Storage), `generate_watering_suggestion` (boolean, domyślnie `false`).
- **Walidacja**:
  - Zod schema w `src/lib/api/plants/create-plant-request.ts`.
  - Trimowanie pól tekstowych, normalizacja `species_name` do użycia w kwerendzie.
  - `purchase_date` parsowane przez `z.string().pipe(z.coerce.date())`, następnie serializowane do `YYYY-MM-DD`.
  - Ustawienie domyślnych wartości (np. `generate_watering_suggestion ?? false`) w warstwie walidacji, aby warstwa serwisowa przyjęła kompletny `CreatePlantCommand`.
- **Powiązane typy (DTO/Commands)**:
  - `CreatePlantCommand` – struktura wejściowa przekazywana do serwisu.
  - `PlantSummaryDto`, `CreatePlantResultDto`, `WateringSuggestionForCreationDto` – kształt odpowiedzi.
  - Pomocniczo `SuggestWateringPlanCommand`/`WateringPlanSuggestionDto` dla logiki AI.

## 3. Szczegóły odpowiedzi
- **Status HTTP**: `201 Created` na sukces; inne statusy przy błędach (401/400/409/500).
- **Body** (`CreatePlantResultDto`):
  - `plant`: `PlantSummaryDto` (zawiera `display_name`, `created_source`, `created_at`, `updated_at`).
  - `watering_suggestion`: union
    - `status: "available"` + parametry planu z `WateringPlanConfigFields`, `ai_request_id`, `explanation`.
    - `status: "rate_limited"` + `unlock_at`, `ai_request_id`.
    - `status: "error" | "skipped"` + opcjonalne `explanation`, `ai_request_id` może być null.
- **Nagłówki**: `Location: /api/plants/{id}` (opcjonalnie, ale wskazane), `Cache-Control: no-store`.
- **Błędy**:
  - 400 – struktura JSON nie przechodzi walidacji.
  - 401 – brak/niepoprawny token.
  - 409 – konflikt `duplicate_index` po powtórzonych próbach.
  - 500 – nieoczekiwany błąd serwera/Supabase.

## 4. Przepływ danych
1. **Middleware/Auth**: `src/middleware/index.ts` zapewnia `locals.supabase` i `locals.user`. Handler w `src/pages/api/plants/index.ts` wymusza obecność użytkownika (401 w przeciwnym razie).
2. **Walidacja**: request body → Zod schema; w razie błędu zwracamy 400 z listą pól (z reużyciem helpera z `src/lib/http`).
3. **Service orchestration** (`src/lib/services/plants/create-plant.ts`):
   - Przyjmuje `userId` oraz `CreatePlantCommand`.
   - Oblicza `species_name_normalized` (np. SQL funkcją `normalize_species_name`), pobiera `max(duplicate_index)` dla `(user_id, normalized)` i zwiększa o 1. Dla bezpieczeństwa otacza w transakcji (Supabase RPC `pg`).
   - Wstawia rekord do `public.plants` (kolumny wg planu DB). W razie konfliktu unikalnego ponawia zapytanie do ustalonego limitu (np. 3 razy).
   - Buduje `display_name` (`species_name` + `#duplicate_index+1`).
4. **AI sugestia** (warunkowa):
   - Serwis sprawdza flagę `generate_watering_suggestion`.
   - Wywołuje dedykowaną funkcję (np. `requestWateringSuggestion(userId, plant)`), która:
     - Sprawdza limit godzinowy (`ai_requests`).
     - Wstawia rekord `ai_requests` z `status:'pending'`.
     - Wywołuje zewnętrzną usługę (lub placeholder) i mapuje wynik do `WateringSuggestionForCreationDto`.
     - W przypadku przekroczenia limitu ustawia `status:'rate_limited'`, `unlock_at`.
     - W przypadku błędu – rejestruje go, zwraca `status:'error'` z `explanation`.
5. **Response assembly**:
   - Handler formatuje wynik (`CreatePlantResultDto`), ustawia status 201, ustawia `Location`.
   - Wszelkie błędy serwisu mapowane są do odpowiednich HTTP via `mapServiceError`.
6. **Logging/Audyt**:
   - Wstawienia do `plants` i `ai_requests` zapewniają ślad w DB.
   - Dodatkowo logujemy (`logger.error`) niepowodzenia insertów/AI i, jeśli dostępne, wysyłamy do Sentry.

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**: korzystamy z `locals.supabase` (sesja pochodząca z middleware). Żądania anonimowe kończą się 401.
- **Autoryzacja**: wszystkie zapytania do DB filtrowane po `user_id = locals.user.id`; brak ekspozycji obcych danych.
- **Walidacja danych**: Zod + dodatkowe serwisowe strażniki; odrzucamy `photo_path` spoza dozwolonych prefixów.
- **Race conditions**: transakcyjny insert z pętlą retry minimalizuje możliwość ujawnienia duplikatów innych użytkowników.
- **Rate limiting AI**: odczyt limitów z `ai_requests` + ewentualny globalny limiter (np. w Redis); zwracamy `status:'rate_limited'` zamiast błędu HTTP.
- **Sekrety**: żadnych kluczy w odpowiedzi; `explanation` AI nie może zawierać prywatnych danych innych użytkowników.
- **Error leakage**: komunikaty 500 maskują szczegóły; szczegóły logowane jedynie po stronie serwera.

## 6. Obsługa błędów
- **400 Bad Request**: naruszenia schematu (puste `species_name`, niepoprawna data). Format błędu JSON `{ error: { code: 'VALIDATION_ERROR', details: [...] } }`.
- **401 Unauthorized**: brak sesji Supabase (np. `locals.user` null).
- **409 Conflict**: unikalny indeks `(user_id, species_name_normalized, duplicate_index)` naruszony po kilkukrotnym retry → zwracamy komunikat „duplicate index conflict, retry later”.
- **500 Internal Server Error**: insert/select fail, niekontrolowany błąd AI. Log do obserwacji + fallback `watering_suggestion.status = 'error'`.
- **AI rate limit**: HTTP 201, jednak `watering_suggestion.status = 'rate_limited'`, `unlock_at` ustawione na wartość z `ai_requests`. Nie jest to błąd HTTP.
- **Logowanie błędów**: helper `logApiError(endpoint, userId, error)` wpisuje do centralnego logu/Sentry; w przypadku AI odnotowujemy status w `ai_requests` (kolumny `was_ai_suggested`, `was_ai_accepted_without_changes` aktualizowane w kolejnych etapach).

## 7. Wydajność
- **Zapytania DB**: pojedynczy select `max(duplicate_index)` + insert; oba indeksowane przez `user_id` i znormalizowaną nazwę (gwarantuje UNIQ). Warto wykorzystać `insert ... returning` by uniknąć dodatkowych round-tripów.
- **Transakcje**: jeśli używamy RPC do PostgreSQL, łączymy select/insert w jednej funkcji, redukując wyścigi i liczbę zapytań.
- **AI wywołania**: uruchamiamy równolegle po wstawieniu rośliny (await w tym samym request-cyklu). Jeśli zewnętrzna usługa jest wolna, można dodać timeout (np. 2s) i w razie przekroczenia zwrócić `status:'skipped'`.
- **Caching/Headers**: ustawiamy `Cache-Control: no-store` – odpowiedzi personalizowane. Brak potrzeby dodatkowego cache.
- **Payload size**: odpowiedź niewielka (<2 KB); nie wymaga kompresji, ale `Content-Encoding: gzip` pozostaje domyślne na platformie.

## 8. Kroki implementacji
1. **Zdefiniuj schemat Zod** w `src/lib/api/plants/create-plant-request.ts`, eksportuj `parseCreatePlantRequest`.
2. **Stwórz helpery HTTP** jeśli brak (np. `jsonResponse`, `validationErrorResponse`) lub użyj istniejących w `src/lib/http`.
3. **Dodaj serwis `create-plant`** w `src/lib/services/plants/create-plant.ts`:
   - Przyjmij `SupabaseClient`, `userId`, `CreatePlantCommand`.
   - Zaimplementuj select `max(duplicate_index)` + insert z retry i generacją `display_name`.
   - Zwróć `PlantSummaryDto`.
4. **Rozszerz warstwę AI**:
   - Jeśli istnieje moduł `src/lib/services/plants/suggest-watering-plan.ts`, dodaj funkcję `requestSuggestionForCreatedPlant`.
   - Zapewnij odczyt limitu (`ai_requests`) i mapowanie do `WateringSuggestionForCreationDto`.
5. **Zaimplementuj handler API** w `src/pages/api/plants/index.ts`:
   - `export const prerender = false`.
   - `export async function POST(context: APIContext)` – walidacja, autoryzacja, wywołanie serwisu, mapowanie odpowiedzi, ustawienie HTTP 201 + `Location`.
