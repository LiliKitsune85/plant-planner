### 1. Opis usługi

**Cel:** dostarczyć serwerową usługę „OpenRouter” (OpenAI-compatible Chat Completions), która:
- wysyła wiadomości czatu do OpenRouter,
- opcjonalnie wymusza **ustrukturyzowaną odpowiedź JSON** przez `response_format`,
- waliduje odpowiedź (np. przez Zod),
- obsługuje timeouty i błędy w spójny sposób (`HttpError`),
- integruje się z istniejącym mechanizmem **quota** i **metryk** (`ai_requests`),
- jest używana przez endpointy Astro (`src/pages/api/...`) bez ujawniania klucza API do frontendu.

**Dopasowanie do repo:** w projekcie już istnieje referencyjna implementacja dla jednego use-case:
- klient OpenRouter: `src/lib/services/ai/openrouter-client.ts`
- quota + tracking: `src/lib/services/ai/ai-quota.ts`, `src/lib/services/ai/ai-requests.ts`
- serwis domenowy: `src/lib/services/watering-plans/suggest-watering-plan.ts`
- endpoint API: `src/pages/api/plants/[plantId]/watering-plan/suggest.ts`

#### 1.1 Kluczowe komponenty usługi (numerowane) + cel

1. **Konfiguracja środowiska (ENV)**
   - **Cel:** bezpieczne przechowywanie i wstrzykiwanie `OPENROUTER_API_KEY`, domyślnego modelu i metadanych aplikacji.
2. **Klient HTTP do OpenRouter**
   - **Cel:** jednolita obsługa `fetch`, nagłówków, timeoutu, kodów HTTP, parsowania błędów i payloadu.
3. **Warstwa czatu (Chat API)**
   - **Cel:** przyjmować `system`/`user`/`assistant` messages i mapować je na request OpenRouter.
4. **Warstwa structured output (`response_format`)**
   - **Cel:** wymusić odpowiedź modelu w JSON zgodnym z dostarczonym schematem, a następnie zwalidować ją po stronie serwera.
5. **Walidacja danych wejściowych**
   - **Cel:** chronić usługę przed niepoprawnymi payloadami z UI/API (np. zbyt długie treści, brak wymaganych pól).
6. **Quota + tracking w bazie (`ai_requests`)**
   - **Cel:** limitować zużycie AI per user oraz zapisywać metryki (latency/tokens/model) i błędy do analityki/diagnozy.
7. **Warstwa API (Astro `src/pages/api`)**
   - **Cel:** wystawić bezpieczne endpointy serwerowe dla UI; ujednolicić envelope odpowiedzi, statusy i kody błędów.
8. **Klient frontendowy**
   - **Cel:** proste wywołania `/api/...` z czytelnymi komunikatami błędów (np. `AiQuotaApiError`).
9. **Obserwowalność i logowanie**
   - **Cel:** logować awarie z request_id, bez wycieku danych wrażliwych.

#### 1.2 Komponenty: funkcjonalność → wyzwania → rozwiązania (technology-agnostic)

1) **Konfiguracja środowiska (ENV)**
- **Funkcjonalność:** dostarczenie klucza i ustawień do klienta OpenRouter; separacja konfiguracji serwerowej od klienta.
- **Wyzwania:**
  1. Wycieki klucza API do przeglądarki.
  2. Rozjazd konfiguracji między środowiskami (dev/prod).
  3. Brak wymaganych zmiennych w runtime (puste stringi).
- **Rozwiązania:**
  1. Trzymaj klucz wyłącznie po stronie serwera (endpointy Astro); nie importuj konfiguracji do komponentów klientowych.
  2. Zdefiniuj jedno źródło prawdy: funkcja `resolveOpenRouterConfig()` w `src/lib/services/ai/...` + dokumentacja env.
  3. Stosuj guard clauses: jeśli `apiKey` puste → `HttpError(500, ..., 'AI_PROVIDER_CONFIG_MISSING')`.

2) **Klient HTTP do OpenRouter**
- **Funkcjonalność:** `POST` do `chat/completions`, timeout przez `AbortController`, obsługa `!response.ok`, parse JSON, ekstrakcja `choices[0].message.content`.
- **Wyzwania:**
  1. Timeouty i abort (niestabilna sieć / wolne modele).
  2. Odpowiedzi nie-JSON lub niezgodne z oczekiwanym kształtem.
  3. Różnice w formacie `message.content` (string vs parts).
  4. Modele nie wspierają `response_format`.
- **Rozwiązania:**
  1. Stosuj budżet czasu (np. 5000ms) i mapuj abort na błąd domenowy `AI_TIMEOUT`.
  2. Oddziel „parse body” od „validate payload”; loguj skrót/fragment content zamiast całości.
  3. Utrzymuj funkcję `extractMessageContent()` z fallbackami (string/parts).
  4. W razie braku wsparcia: fallback do „wymuszenia JSON w prompt” + walidacja; ewentualnie retry z innym modelem.

3) **Warstwa czatu (Chat API)**
- **Funkcjonalność:** budowanie messages, opcjonalny kontekst (np. „persona”), oraz ścisłe ograniczenia wejścia (długości, dozwolone role).
- **Wyzwania:**
  1. Prompt injection (użytkownik próbuje przejąć instrukcje).
  2. Nieprzewidywalne zachowanie modelu bez spójnego system prompt.
- **Rozwiązania:**
  1. Stosuj stały, krótki system prompt + walidację wyjścia; nie ufaj treści użytkownika.
  2. Dla każdego endpointu zdefiniuj minimalny kontrakt: „co zwracamy” + `response_format`.

4) **Structured output (`response_format`)**
- **Funkcjonalność:** dostarczenie JSON schema do modelu i wymaganie ścisłej odpowiedzi; walidacja JSON po stronie serwera.
- **Wyzwania:**
  1. Model zwraca tekst + JSON albo niepoprawny JSON.
  2. Schemat „pływa” między wersjami, a UI oczekuje stabilnego DTO.
- **Rozwiązania:**
  1. Parsuj `JSON.parse` + waliduj (Zod); w razie błędu mapuj na `AI_PROVIDER_ERROR` i zwracaj 502.
  2. Traktuj schema jako kontrakt API: wersjonuj `name` (np. `watering_plan_suggestion_v1`), utrzymuj kompatybilność wstecz.

5) **Walidacja danych wejściowych**
- **Funkcjonalność:** sanity-check requestów do API (np. `species_name`, `messages`, parametry modelu).
- **Wyzwania:**
  1. Przeciążenie (bardzo długie treści).
  2. Niepoprawne typy/pola.
- **Rozwiązania:**
  1. Twarde limity długości (np. max chars per message).
  2. Zod/parse functions w `src/lib/api/...` (tak jak istnieje `parseSuggestWateringPlanRequest`).

6) **Quota + tracking (`ai_requests`)**
- **Funkcjonalność:** limit per user/time window + metryki + zapis statusu: `success/error/rate_limited`.
- **Wyzwania:**
  1. Spójność (request zapisany, ale brak aktualizacji metryk).
  2. Brak rozróżnienia typów błędów (timeout vs provider vs validation).
- **Rozwiązania:**
  1. Zawsze twórz `ai_requests` na starcie, a w `finally`/catch aktualizuj status.
  2. Kody błędów: `AI_TIMEOUT`, `AI_RATE_LIMITED`, `AI_PROVIDER_ERROR`, `AI_PROVIDER_CONFIG_MISSING`, `INVALID_JSON`, itp.

7) **Warstwa API (Astro)**
- **Funkcjonalność:** auth (Supabase), parsowanie JSON body, walidacja, wywołanie serwisu, envelope `{ data, error, meta }`.
- **Wyzwania:**
  1. Ujednolicenie błędów dla UI (czytelne komunikaty i kody).
  2. Cache per-user.
- **Rozwiązania:**
  1. Stosuj `HttpError` + `isHttpError` i mapowanie na envelope.
  2. Ustaw `Cache-Control: no-store` i `Vary: Authorization, Cookie` dla per-user.

8) **Klient frontendowy**
- **Funkcjonalność:** fetch do endpointów, mapowanie envelope, obsługa komunikatów i statusów.
- **Wyzwania:**
  1. Rozróżnienie „rate limited” vs „błąd” przy zachowaniu UX.
- **Rozwiązania:**
  1. W DTO przekazuj `unlock_at`/limity w `error.details` i pokazuj to w UI.

9) **Obserwowalność**
- **Funkcjonalność:** logi z `request_id`, statusy, czasy, bez wrażliwych danych.
- **Wyzwania:**
  1. Logowanie promptów może ujawniać PII.
- **Rozwiązania:**
  1. Loguj metadane + skróty/rozmiary, nie pełne treści.

---

### 2. Opis konstruktora

W repo jest już gotowy wzorzec „funkcyjny” (`requestWateringPlanSuggestion`). Dla uogólnienia czatów warto wprowadzić klasę serwerową (lub moduł) np. `OpenRouterService`, która spina konfigurację + klienta.

**Proponowana lokalizacja:** `src/lib/services/ai/openrouter-service.ts`

**Konstruktor (`new OpenRouterService(config)`) powinien przyjmować:**
- **`apiKey: string`** (wymagane; pochodzi z `import.meta.env.OPENROUTER_API_KEY`)
- **`defaultModel: string`** (opcjonalne; np. `import.meta.env.OPENROUTER_MODEL ?? 'xiaomi/mimo-v2-flash:free'`)
- **`timeoutMs: number`** (np. 5000)
- **`appUrl: string`** (do `HTTP-Referer`, np. `import.meta.env.APP_BASE_URL`)
- **`appTitle: string`** (do `X-Title`, np. `Plant Planner`)
- **`fetchImpl?: typeof fetch`** (opcjonalnie dla testów)

**Zasady konstruktora (guard clauses):**
- jeśli `apiKey` jest puste → rzucić `HttpError(500, 'Missing OpenRouter API key', 'AI_PROVIDER_CONFIG_MISSING')`
- jeśli `timeoutMs <= 0` → `HttpError(500, 'Invalid OpenRouter timeout', 'AI_PROVIDER_CONFIG_INVALID')`

---

### 3. Publiczne metody i pola

Poniżej minimalny zestaw publicznego API usługi (dopasowany do „chatów opartych na LLM” i istniejących wzorców w repo).

#### 3.1 Publiczne pola
- **`defaultModel: string`**: model używany, jeśli call nie poda swojego.
- **`timeoutMs: number`**: domyślny budżet czasu.

#### 3.2 Publiczne metody

1. **`chat(request)`**
   - **Wejście (conceptual):**
     - `model?: string`
     - `messages: Array<{ role: 'system'|'user'|'assistant', content: string | parts }>`
     - `responseFormat?: ResponseFormatJsonSchema` (opcjonalne)
     - `modelParams?: { temperature?: number; max_tokens?: number; top_p?: number; stop?: string[]; presence_penalty?: number; frequency_penalty?: number }`
   - **Wyjście (conceptual):**
     - `{ content: string; model: string; usage: { promptTokens; completionTokens; totalTokens }; latencyMs }`
   - **Cel:** podstawowe wywołanie czatu bez narzucania typu odpowiedzi.

2. **`chatJson<T>(request, schema)`**
   - **Wejście:** jak `chat`, ale wymagane `responseFormat` i walidator (`schema`).
   - **Wyjście:** `{ data: T; model; usage; latencyMs }`
   - **Cel:** ustrukturyzowane odpowiedzi dla endpointów, które muszą zwrócić stabilne DTO.

3. **`buildResponseFormatJsonSchema(name, schemaObj)`**
   - **Cel:** centralne, spójne budowanie obiektu `response_format` (bez duplikacji).

4. **`normalizeMessages(messages)`**
   - **Cel:** ujednolicić format content, trim, walidacja długości; przygotowanie do requestu.

---

### 4. Prywatne metody i pola

#### 4.1 Prywatne pola
- **`apiUrl`**: `https://openrouter.ai/api/v1/chat/completions`
- **`apiKey`**: klucz z env (tylko serwer)
- **`appUrl`**, **`appTitle`**
- **`fetchImpl`**: domyślnie global `fetch`

#### 4.2 Prywatne metody

1. **`postChatCompletions(payload, { signal })`**
   - buduje `fetch` z nagłówkami:
     - `Authorization: Bearer ${apiKey}`
     - `Content-Type: application/json`
     - `HTTP-Referer: appUrl`
     - `X-Title: appTitle`
   - mapuje błędy HTTP na `HttpError` (szczegóły w sekcji 5).

2. **`readErrorBody(response)`**
   - bezpiecznie odczytuje body błędu (może być nieczytelne).

3. **`extractMessageContent(choice)`**
   - wspiera `message.content` jako string lub parts (text).

4. **`parseJsonContent(content)`**
   - robi `JSON.parse`, w razie błędu rzuca `HttpError(502, ..., 'AI_PROVIDER_ERROR')`.

5. **`validate<T>(parsed, zodSchema)`**
   - `safeParse`, loguje issues, rzuca `HttpError(502, ..., 'AI_PROVIDER_ERROR')`.

---

### 5. Obsługa błędów

Poniższe scenariusze powinny być obsługiwane w całej usłudze (numerowane), z mapowaniem na `HttpError` oraz kodami błędów, które UI może interpretować.

1. **Brak konfiguracji (`OPENROUTER_API_KEY`)**
   - **Status:** 500
   - **Kod:** `AI_PROVIDER_CONFIG_MISSING`
   - **Kiedy:** `apiKey === ''`.

2. **Timeout / abort**
   - **Status:** 408
   - **Kod:** `AI_TIMEOUT`
   - **Kiedy:** `AbortController` przerwie request.

3. **Brak sieci / błąd `fetch`**
   - **Status:** 502
   - **Kod:** `AI_PROVIDER_ERROR`
   - **Kiedy:** wyjątek sieciowy.

4. **OpenRouter zwraca `!ok` (np. 400/401/403/429/500/502/503)**
   - **Status (dla klienta API):** najczęściej 502, chyba że chcesz „przepuszczać” 401/403/429.
   - **Kod:** `AI_PROVIDER_ERROR` (lub bardziej szczegółowe, jeśli wprowadzisz mapowanie).
   - **Uwaga:** niezależnie od tego, quota aplikacji (`ai_requests`) nadal powinna zapisać błąd.

5. **Niepoprawny JSON w odpowiedzi provider’a**
   - **Status:** 502
   - **Kod:** `AI_PROVIDER_ERROR`
   - **Kiedy:** `response.json()` lub `JSON.parse(content)` się nie uda.

6. **Odpowiedź niezgodna ze schematem (walidacja)**
   - **Status:** 502
   - **Kod:** `AI_PROVIDER_ERROR`
   - **Details:** `issues` (opcjonalnie, tak jak w istniejącym kliencie).

7. **Brak `choices` / brak `message` / brak tekstu**
   - **Status:** 502
   - **Kod:** `AI_PROVIDER_ERROR`

8. **Błędy wejścia (API)**
   - **Status:** 400
   - **Kod:** `INVALID_JSON` / `VALIDATION_ERROR`
   - **Kiedy:** body nie jest JSON lub nie przechodzi walidacji requestu.

9. **Rate limit aplikacji (quota po stronie Supabase)**
   - **Status:** 429
   - **Kod:** `AI_RATE_LIMITED`
   - **Details:** `{ unlock_at, limit_per_hour, used_in_current_window }`

---

### 6. Kwestie bezpieczeństwa

- **Klucz API tylko na serwerze**: `OPENROUTER_API_KEY` nie może trafić do bundle klienta; wywołuj OpenRouter wyłącznie w `src/pages/api/...` lub w serwerowych `src/lib/services/...`.
- **Ochrona per-user cache**: dla endpointów AI ustaw `Cache-Control: no-store` i `Vary: Authorization, Cookie` (jak w `GET /api/ai/quota`).
- **Redakcja logów**: nie loguj pełnej treści promptów/odpowiedzi; loguj metryki, status, `request_id`, długości, ewentualnie skróty.
- **Prompt injection**: zakładaj, że user-message jest nieufna; system prompt powinien ograniczać zachowanie i wymuszać format.
- **Walidacja odpowiedzi**: zawsze waliduj JSON (np. Zod), nawet gdy używasz `response_format`.
- **Limity wejścia**: w API narzuć maksymalną długość wiadomości i liczbę message’ów; zabezpiecza koszty i stabilność.

---

### 7. Plan wdrożenia krok po kroku

#### 7.1 Konfiguracja (ENV)

1. Dodaj/utrzymaj zmienne środowiskowe (serwer):
   - `OPENROUTER_API_KEY` (wymagane)
   - `OPENROUTER_MODEL` (opcjonalne, **zalecane ustawienie**: `xiaomi/mimo-v2-flash:free`)
   - `APP_BASE_URL` (opcjonalne, ale zalecane do `HTTP-Referer`)
2. Upewnij się, że typy env są zadeklarowane (w repo już są):
   - `src/env.d.ts` zawiera `OPENROUTER_API_KEY?: string` i `OPENROUTER_MODEL?: string`.

#### 7.2 Zdefiniuj kontrakt czatu (DTO) i lokacje kodu

1. Dodaj typy (jeśli budujesz ogólny chat, a nie tylko „watering plan”):
   - **Rekomendowana lokalizacja:** `src/types.ts`
   - DTO: `ChatMessageDto`, `ChatRequestDto`, `ChatResponseDto`, `ApiEnvelope<T>`.
2. Dodaj walidatory requestu:
   - **Rekomendowana lokalizacja:** `src/lib/api/ai/chat-request.ts`
   - Zasady: role tylko z whitelisty, content trim, limit długości.

#### 7.3 Implementacja/ekstrakcja serwisów OpenRouter

Opcja A (minimalna, zgodna z repo): utrzymuj wyspecjalizowane funkcje (tak jak `requestWateringPlanSuggestion`).

Opcja B (zalecana dla „czatów LLM”): wprowadź uogólniony serwis `OpenRouterService` i buduj na nim konkretne use-case’y.

**Rekomendacja:** B — ułatwia dodawanie kolejnych chatów/formatów, bez kopiowania `fetch`/timeout/parse/walidacji.

#### 7.4 Włączenie elementów wymaganych przez OpenRouter API (z przykładami)

Poniższe przykłady pokazują, jak składać request do endpointu `chat/completions` i jak to mapować w serwisie.

##### 7.4.1 Komunikat systemowy (przykłady)

1. **Wymuszenie JSON i ograniczenie źródeł:**
   - `role: 'system'`
   - `content: "You are a helpful assistant. Always respond with JSON matching the schema. Use only user-provided data."`

2. **Persona + bezpieczeństwo:**
   - `content: "You are Plant Planner assistant. Never reveal secrets. If input is ambiguous, ask one clarifying question."`

##### 7.4.2 Komunikat użytkownika (przykłady)

1. **Prosty tekst:**
   - `role: 'user'`
   - `content: "Suggest a watering plan for Monstera deliciosa."`

2. **Formatowanie w treści:**
   - `content: "Species: Monstera deliciosa\nLocation: indoor\nLight: medium\nPot: 20cm"`

##### 7.4.3 `response_format` (JSON schema) – ustrukturyzowane odpowiedzi (przykłady)

Wzór wymagany:
`{ type: 'json_schema', json_schema: { name: [schema-name], strict: true, schema: [schema-obj] } }`

1. **Schemat odpowiedzi dla „watering plan suggestion” (spójny z repo):**

```ts
const response_format = {
  type: 'json_schema',
  json_schema: {
    name: 'watering_plan_suggestion_v1',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['suggestion', 'explanation'],
      properties: {
        suggestion: {
          type: 'object',
          additionalProperties: false,
          required: [
            'interval_days',
            'horizon_days',
            'schedule_basis',
            'start_from',
            'custom_start_on',
            'overdue_policy',
          ],
          properties: {
            interval_days: { type: 'integer', minimum: 1, maximum: 365 },
            horizon_days: { type: 'integer', minimum: 1, maximum: 365 },
            schedule_basis: { type: 'string', enum: ['due_on', 'completed_on'] },
            start_from: { type: 'string', enum: ['today', 'purchase_date', 'custom_date'] },
            custom_start_on: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
            overdue_policy: { type: 'string', enum: ['carry_forward', 'reschedule'] },
          },
        },
        explanation: { type: 'string', minLength: 1, maxLength: 800 },
      },
    },
  },
} as const
```

##### 7.4.4 Nazwa modelu (przykłady)

1. **Model wymagany w projekcie (domyślny):**
   - `model: 'xiaomi/mimo-v2-flash:free'`
2. **Konfiguracja przez ENV (z domyślnym fallback):**
   - `model: import.meta.env.OPENROUTER_MODEL ?? 'xiaomi/mimo-v2-flash:free'`

##### 7.4.5 Parametry modelu (przykłady)

1. **Stabilna odpowiedź JSON (mniej kreatywności):**
   - `temperature: 0.2`
   - `top_p: 0.9`
2. **Ograniczenie długości:**
   - `max_tokens: 500`
3. **Ochrona przed „lanie wody”:**
   - `presence_penalty: 0.0`, `frequency_penalty: 0.2`
4. **Stop sequences (jeśli używasz promptowych delimiterów):**
   - `stop: ['\n\nEND']`

#### 7.5 Warstwa API (Astro) – jak wystawić chat

1. Dodaj endpoint, np. `src/pages/api/ai/chat.ts`:
   - `export const prerender = false`
   - `POST`: auth użytkownika (Supabase), parse JSON body, walidacja, quota-check, zapis `ai_requests`, wywołanie OpenRouter, zapis metryk, response envelope.
2. Zwracaj jednolity envelope:
   - `{ data, error, meta }`
   - `meta.request_id` (UUID) dla korelacji logów.
3. Obsłuż `429` od quota aplikacji jako „rate limited” z `unlock_at` (UX-friendly).

#### 7.6 Integracja z quota i `ai_requests`

1. Przed wywołaniem OpenRouter:
   - `quota = await getAiQuota(...)`
   - `aiRequestId = await createAiRequest(...)`
2. Jeśli `quota.is_rate_limited`:
   - `await markAiRequestRateLimited(...)`
   - zwróć `429` z `unlock_at`.
3. W try/catch:
   - success → `markAiRequestSuccess(...)` (model + metryki)
   - error → `markAiRequestError(...)` (code + message)

#### 7.7 Weryfikacja i testy manualne (praktyczne checklisty)

- **Czy klucz API nie jest używany w kodzie klientowym?**
- **Czy endpointy mają `Cache-Control: no-store` i `Vary` (dla per-user)?**
- **Czy structured output jest walidowany (Zod) i błędy są mapowane na 502/400/429?**
- **Czy przy rate limit aplikacji `ai_requests` dostaje status `rate_limited`?**
- **Czy logi nie zawierają pełnych promptów / PII?**

#### 7.8 Linki referencyjne (do weryfikacji integracji)

- Dokumentacja OpenRouter: [OpenRouter API](https://openrouter.ai/docs)
- Endpoint chat completions (OpenAI-compatible): `https://openrouter.ai/api/v1/chat/completions`

