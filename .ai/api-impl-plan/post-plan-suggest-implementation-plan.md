## API Endpoint Implementation Plan: POST `/api/plants/{plantId}/watering-plan/suggest`

### 1. Przegląd punktu końcowego
- **Cel**: Wygenerować (server-side) sugestię planu podlewania dla wskazanej rośliny przy użyciu OpenRouter, **z audytem** w `public.ai_requests` oraz **egzekwowaniem limitu** (20 zapytań / godzinę / użytkownik).
- **Metoda HTTP**: `POST`
- **URL**: `/api/plants/{plantId}/watering-plan/suggest`
- **Charakterystyka**:
  - Sugestia i krótkie uzasadnienie **nie są zapisywane** jako plan podlewania (to robi dopiero osobny endpoint “set/accept”).
  - Endpoint **zawsze** tworzy rekord audytowy `ai_requests` dla próby (również w przypadku błędu/rate-limit) – zgodnie ze spec.
  - W przypadku przekroczenia limitu zwraca `429` i `suggestion: null` wraz z `unlock_at`.

### 2. Szczegóły żądania
- **Nagłówki**:
  - `Authorization: Bearer <token>` (opcjonalnie, ale jeśli brak ważnej sesji -> `401`)
  - `Content-Type: application/json`
- **Parametry URL**:
  - **Wymagane**:
    - `plantId` (UUID) – identyfikator rośliny.
- **Request Body**:
  - **Wymagane**:
    - `context.species_name` (string) – nazwa gatunku (np. `"Monstera deliciosa"`).

#### 2.1 Walidacja wejścia (Zod)
Zgodnie z zasadami projektu (Zod w API routes) i specyfikacją:
- **Param `plantId`**:
  - musi być UUID
  - błąd -> `400 INVALID_PLANT_ID`
- **Body**:
  - musi być poprawnym JSON (`request.json()`); błąd parsowania -> `400 INVALID_JSON`
  - schema (strict):
    - `context`: obiekt
    - `context.species_name`: string, `.trim().min(1).max(200)` (max do ustalenia; ważne, by ograniczyć prompt injection + koszty)
  - błąd walidacji -> `400 VALIDATION_ERROR` (z `details.issues[]` w stylu istniejących walidatorów)

#### 2.2 Wykorzystywane typy (DTO i Command modele)
Repo już posiada kluczowe typy w `src/types.ts`:
- **Command**:
  - `SuggestWateringPlanCommand`:
    - `context: { species_name: string }`
- **DTO**:
  - `WateringPlanSuggestionDto`:
    - `ai_request_id: uuid`
    - `suggestion: WateringPlanConfigFields | null`
    - `explanation?: string | null`
- **Reużywalne pola**:
  - `WateringPlanConfigFields` (interval/horizon/schedule_basis/start_from/custom_start_on/overdue_policy)
  - `AiQuotaDto` (jeśli zdecydujemy się zwracać dodatkowe meta, np. limit)

Dodatkowo do implementacji endpointu będą potrzebne (jeśli nie istnieją, należy je dodać lokalnie w pliku route lub jako typy współdzielone):
- `ApiEnvelope<TData>`: `{ data: TData | null; error: { code; message; details? } | null; meta: Record<string, unknown> }`
- `ApiError` (shape jak w innych endpointach)

### 3. Szczegóły odpowiedzi
#### 3.1 Sukces — `200 OK`
Zwracamy sugestię i uzasadnienie:
- `data.ai_request_id` (UUID)
- `data.suggestion` (obiekt z polami planu)
- `data.explanation` (string; krótki tekst dla UI)
- `meta.response_time_budget_ms = 5000` (jak w spec)

#### 3.2 Rate limit — `429 Too Many Requests`
Zwracamy:
- `data.ai_request_id` (UUID) – audyt utworzony
- `data.suggestion = null`
- `error.code = AI_RATE_LIMITED`
- `error.details.unlock_at` (ISO timestamptz)
- `meta.limit_per_hour = 20`

#### 3.3 Pozostałe kody statusu (zob. sekcja 6)
- `400` – błędne dane wejściowe (parametry/body)
- `401` – brak autoryzacji
- `404` – roślina nie istnieje lub nie należy do użytkownika
- `408` – przekroczenie budżetu czasu na upstream AI
- `502` – błąd providera AI (OpenRouter)
- `500` – błąd serwera

### 4. Przepływ danych
Poniżej docelowy przepływ w warstwach, zgodnie z konwencją repo:

#### 4.1 Warstwa route (`src/pages/api/...`)
1. **Auth**:
   - pobierz `userId` przez istniejący helper `requireUserId(locals, request)` (używa `locals.supabase`).
2. **Walidacja**:
   - `plantId` z `params` (UUID).
   - parse JSON body; walidacja Zod do `SuggestWateringPlanCommand`.
3. **Autoryzacja zasobu**:
   - upewnij się, że plant należy do usera (preferowane: proste zapytanie `plants` po `id` i `user_id`; w razie potrzeby re-use `getPlantDetail`).
4. **Wywołanie serwisu**:
   - `suggestWateringPlan(locals.supabase, { userId, plantId, command }, { requestId? })`
5. **Mapowanie wyniku**:
   - sukces -> `200` + envelope z `meta.response_time_budget_ms`.
   - rate-limit -> `429` + envelope jak w spec.
6. **Obsługa błędów**:
   - `HttpError` -> mapuj status, code, message, details.
   - nieobsłużone -> `500 INTERNAL_SERVER_ERROR` + log.

#### 4.2 Warstwa serwisów (`src/lib/services/**`)
Proponowany podział odpowiedzialności:
- `src/lib/services/ai/ai-quota.ts`
  - oblicza użycie w oknie 1h oraz `unlock_at` w oparciu o `public.ai_requests`.
  - zawiera metodę atomową lub “best-effort” do odrzucenia requestu, gdy limit przekroczony.
- `src/lib/services/ai/ai-requests.ts`
  - tworzy/aktualizuje wpis w `public.ai_requests`:
    - start: `status='started'|'pending'` (nazwa zależy od enum `public.ai_request_status`)
    - end: `status='ok'|'error'|'rate_limited'`, metryki `latency_ms`, `tokens`, `model`, `error_*`
  - wymusza regułę: **optional numeric metrics >= 0** (null albo liczba >= 0).
- `src/lib/services/ai/openrouter.ts`
  - klient HTTP do OpenRouter (timeout, retry policy, budget 5000ms).
  - buduje prompt i parsuje wynik do `WateringPlanConfigFields` + `explanation`.
- `src/lib/services/watering-plans/suggest-watering-plan.ts`
  - orkiestracja:
    - weryfikacja rośliny (ownership)
    - check quota
    - insert ai_requests
    - call OpenRouter
    - update ai_requests metrykami/statusami
    - zwrot `WateringPlanSuggestionDto`

#### 4.3 Baza danych (`public.ai_requests`)
Wymagania ze spec / DB planu:
- Insert **wyłącznie** server-side (ten endpoint spełnia).
- `user_id` wymagany, `plant_id` opcjonalny (dla tego endpointu: ustawiamy `plant_id = plantId`).
- Pola metryk (latency/tokens) tylko `null` lub `>= 0`.

### 5. Względy bezpieczeństwa
- **Uwierzytelnianie**:
  - wymagane (sesja cookie lub Bearer token); brak -> `401`.
- **Autoryzacja zasobu**:
  - nie ujawniamy, czy `plantId` istnieje u innych użytkowników; jeśli nie znaleziono po `(id, user_id)` -> `404 NOT_FOUND`.
- **Prompt injection / nadużycia**:
  - ograniczyć długość `species_name`, wykonać `.trim()`, opcjonalnie znormalizować whitespace.
  - prompt powinien traktować `species_name` jako dane, nie instrukcje.
- **Sekrety i konfiguracja**:
  - klucz OpenRouter tylko po stronie serwera (`import.meta.env`), nigdy do klienta.
- **RLS / Supabase**:
  - używać `locals.supabase` (z context.locals, zgodnie z regułami projektu).
  - polegać na RLS + dodatkowo filtrować po `user_id` w zapytaniach.
- **Rate limiting / abuse**:
  - podstawowy limit zgodny ze spec: 20/h per user w oparciu o `ai_requests`.
  - opcjonalnie (plan B): dodatkowy limit per-IP na warstwie middleware/edge (jeśli projekt ma taki komponent).

### 6. Obsługa błędów
#### 6.1 Scenariusze błędów i mapowanie
- **400 INVALID_PLANT_ID**: `plantId` nie-UUID.
- **400 INVALID_JSON**: body nie jest poprawnym JSON.
- **400 VALIDATION_ERROR**: body nie spełnia schema (np. brak `context.species_name`).
- **401 UNAUTHENTICATED**: brak sesji/nieprawidłowy token.
- **404 NOT_FOUND**: roślina nie istnieje lub nie należy do usera.
- **429 AI_RATE_LIMITED**: quota przekroczona; zwrócić `unlock_at`.
- **408 AI_TIMEOUT**:
  - upstream przekroczył budżet czasu (np. 5000ms).
  - wymaganie: serwer **musi** oznaczyć `ai_requests.status='error'` (oraz `error_code='AI_TIMEOUT'` / `error_message`).
- **502 AI_PROVIDER_ERROR**:
  - OpenRouter zwrócił błąd 5xx/4xx, sieć, invalid response.
  - wymaganie: `ai_requests.status='error'` + `error_code='AI_PROVIDER_ERROR'` (plus szczegóły).
- **500 INTERNAL_SERVER_ERROR**:
  - niespodziewany wyjątek; log + bezpieczny komunikat.

#### 6.2 Logowanie i audyt (ai_requests)
Zasada: **jeden request -> jeden rekord `ai_requests`**.
Proponowany standard:
- przy starcie:
  - insert `ai_requests` z:
    - `user_id`, `plant_id`, `provider='openrouter'`, `status='started'` (lub adekwatny enum)
    - `model` można pozostawić null do momentu poznania
- przy zakończeniu sukcesem:
  - update:
    - `status='ok'`
    - `model`
    - `latency_ms`, `prompt_tokens`, `completion_tokens`, `total_tokens` (jeśli dostępne)
- przy rate-limit:
  - update `status='rate_limited'` (jeśli enum wspiera; w przeciwnym razie `error` + `error_code='AI_RATE_LIMITED'`)
  - `error_message`/`error_code` wg potrzeb audytu
- przy błędach:
  - update `status='error'`, `error_code`, `error_message`

Uwaga: dokładne wartości `status` zależą od `public.ai_request_status` w schemacie bazy (należy sprawdzić `database.types`/migracje).

### 7. Wydajność
- **Budżet czasu**: 5000ms (meta + realny timeout na fetch do OpenRouter).
- **Zapytania DB**:
  - 1x weryfikacja plant ownership.
  - 1x quota check (agregacja po `ai_requests` w oknie 1h) – zadbać o indeks (jeśli brak, rozważyć indeks na `(user_id, requested_at desc)`).
  - 1x insert `ai_requests`.
  - 1x update `ai_requests` po wyniku.
- **Ograniczenie kosztów AI**:
  - w prompt’cie i modelu preferować tańszy model.
  - odpowiedź modelu wymusić na JSON (strict) i walidować Zod po stronie serwera.
- **Cache**:
  - w route zwracać `Cache-Control: no-store` (jak w innych mutacjach / wrażliwych danych).

### 8. Kroki implementacji (checklista dla zespołu)
1. **Route i ścieżka pliku**
   - Utworzyć `src/pages/api/plants/[plantId]/watering-plan/suggest.ts`.
   - Dodać `export const prerender = false`.
   - Zaimplementować `export const POST: APIRoute = ...`.
2. **Parser requestu (Zod)**
   - Dodać plik parsera: `src/lib/api/watering-plans/suggest-watering-plan-request.ts`:
     - `parseSuggestWateringPlanParams(params)` (UUID `plantId`)
     - `parseSuggestWateringPlanRequest(body)` -> `SuggestWateringPlanCommand`
   - Uzgodnić standard statusu walidacji: **400** dla invalid input (zgodnie z wymaganiami zadania).
3. **Serwis orkiestrujący**
   - Utworzyć `src/lib/services/watering-plans/suggest-watering-plan.ts`:
     - wejście: `{ userId, plantId, command }`
     - wyjście: `WateringPlanSuggestionDto` + informacja czy rate-limited (do mapowania na 429)
4. **Quota (20/h)**
   - Utworzyć `src/lib/services/ai/ai-quota.ts`:
     - funkcja `getAiQuota(supabase, { userId, now }) -> { remaining, unlockAt, used }`
     - logika: liczyć `ai_requests` w oknie `(now - 1h, now]` (niezależnie od statusu, bo spec mówi “zapytania/h”).
     - jeśli `used >= 20` -> rate-limited.
5. **Repozytorium audytu ai_requests**
   - Utworzyć `src/lib/services/ai/ai-requests.ts`:
     - `createAiRequest({ userId, plantId, provider, status, model? }) -> ai_request_id`
     - `markAiRequestSuccess(...)`, `markAiRequestError(...)`, `markAiRequestRateLimited(...)`
     - w każdym update pilnować: metryki `null` lub `>= 0`.
6. **Klient OpenRouter**
   - Utworzyć `src/lib/services/ai/openrouter-client.ts`:
     - `callOpenRouter({ apiKey, model, messages, timeoutMs })`
     - timeout 5000ms (lub 4500ms na upstream + margines na DB)
     - mapowanie błędów na `HttpError(408|502, ...)`
   - Prompt:
     - wejście: `species_name`
     - wyjście: JSON z polami `interval_days`, `horizon_days`, `schedule_basis`, `start_from`, `custom_start_on`, `overdue_policy`, `explanation`
   - Walidacja odpowiedzi Zod (nie ufać AI).
7. **Mapowanie statusów i envelope**
   - W route:
     - sukces -> `200` + `meta.response_time_budget_ms: 5000`
     - rate-limit -> `429` z formatem ze spec (meta + error.details.unlock_at)
     - błędy -> wg sekcji 6
   - Dodać `Cache-Control: no-store` w odpowiedziach.
8. **Testy / weryfikacja manualna**
   - Scenariusze:
     - 401 bez sesji
     - 400 invalid UUID
     - 400 invalid body
     - 404 plant nie należy do usera
     - 429 po przekroczeniu 20/h (symulacja przez inserty `ai_requests`)
     - 408 poprzez wymuszenie krótkiego timeoutu / mock
     - 502 przy błędnym kluczu OpenRouter lub mock 5xx
   - Sprawdzić, że `ai_requests` ma rekord dla każdego wywołania (success/error/rate-limited).

