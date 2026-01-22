### 1) Naprawić `GET /api/ai/quota` (obecnie mock) + wymusić auth
- **Pliki**: `src/pages/api/ai/quota.ts`, `src/lib/services/ai/ai-quota.ts`, `src/lib/api/auth/require-user-id.ts`
- **Zmiany**:
  - usuń mock z `quota.ts`
  - użyj `requireUserId(locals, request)` i wywołaj `getAiQuota(locals.supabase, { userId })`
  - zwracaj envelope `{ data, error, meta:{} }` + `Cache-Control: no-store` + `Vary: Authorization, Cookie`
- **AC**:
  - zalogowany user dostaje realne `used/remaining/unlock_at`
  - niezalogowany dostaje `401 UNAUTHENTICATED`

### 2) Ujednolicić auth helper w endpointach “plants”
- **Pliki**: `src/pages/api/plants/index.ts`
- **Zmiany**:
  - usuń lokalne `getBearerToken()/requireUserId()` i przejdź na wspólne `src/lib/api/auth/require-user-id.ts`
- **AC**:
  - brak duplikacji logiki auth, identyczne zachowanie jak w innych route’ach

### 3) Dodać `meta.request_id` do `GET/POST /api/plants` (spójność z resztą API + debug)
- **Pliki**: `src/pages/api/plants/index.ts`
- **Zmiany**:
  - generuj `request_id` (jak w `watering-plan/*`) i zwracaj w `meta` dla sukcesu i błędów
- **AC**:
  - frontend (`PlantsApiError.requestId`) zaczyna dostawać `request_id`

### 4) Ujednolicić statusy walidacji do `422 VALIDATION_ERROR` (teraz część jest `400`)
- **Pliki**:
  - `src/lib/api/plants/create-plant-request.ts` (**teraz 400**)
  - `src/lib/api/watering-plans/suggest-watering-plan-request.ts` (**teraz 400**)
  - (opcjonalnie) inne request-parsere dla spójności
- **Zmiany**:
  - wszystkie błędy walidacji payload/params → `HttpError(422, "...", "VALIDATION_ERROR", details)`
- **AC**:
  - dokumentacja `@.ai/api-plan.md` i implementacja używają spójnie `422` dla walidacji

### 5) Zwracać `error.details` dla walidacji `POST /api/plants` (UI potrzebuje mapowania pól)
- **Pliki**: `src/lib/api/plants/create-plant-request.ts`, `src/pages/api/plants/index.ts`, `src/components/plants/new/validation.ts`
- **Zmiany**:
  - w `create-plant-request.ts` dołącz `details.issues` z walidacji Zod (analogicznie do `set-watering-plan-request.ts`)
  - w `src/pages/api/plants/index.ts` **nie gubić** `error.details` w envelope (teraz endpoint zwraca tylko `{code,message}`)
  - po stronie UI rozszerzyć `mergeFieldErrorsFromDetails()` tak, aby obsługiwał również `issues[].path` jako **string** (bo inne parsere tak już zwracają), nie tylko tablicę
- **AC**:
  - błąd walidacji z backendu podświetla konkretne pola w `/plants/new` (nie tylko “form error”)

### 6) Ujednolicić kształt error envelope w `plants` z resztą API
- **Pliki**: `src/pages/api/plants/index.ts`
- **Zmiany**:
  - envelope error powinien mieć `{ code, message, details? }` (jak w `watering-plan/suggest` i `watering-plan/index`)
- **AC**:
  - `plants-client.ts` przestaje dostawać `details: undefined` w typowych walidacjach

### 7) Decyzja i dopasowanie: domyślne `generate_watering_suggestion`
- **Pliki**: `src/lib/api/plants/create-plant-request.ts`, `src/components/plants/new/types.ts` (domyślne wartości UI)
- **Zmiany (wybierz jedno, żeby było spójnie z `@.ai/ui-plan.md`)**:
  - **Opcja A (rekomendowana wg UI planu)**: backend default `generate_watering_suggestion=true`
  - **Opcja B (bezpieczniejsza kosztowo)**: zostaje default `false`, ale UI **zawsze** wysyła jawnie `true/false` (i to dokumentujemy jako wymóg kontraktu)
- **AC**:
  - brak “cichego” pomijania AI, jeśli UI oczekuje sugestii

### 8) Doprecyzować statusy AI w `CreatePlantResultDto.watering_suggestion` (żeby UI miał czytelny powód braku sugestii)
- **Pliki**: `src/types.ts`, `src/pages/api/plants/index.ts`, `src/lib/services/watering-plans/suggest-watering-plan.ts`, komponenty sugerowania planu (np. `PlantWateringPlanView` i mapowanie `mapCreationSuggestionToState`)
- **Zmiany**:
  - rozszerzyć `WateringSuggestionForCreationDto` o rozróżnione statusy błędu: np. `timeout | provider_error | unknown_error` (z `ai_request_id` i opcjonalnym `message/code`)
  - w `generateWateringSuggestion()` mapować `HttpError.code`:
    - `AI_TIMEOUT` → `timeout`
    - `AI_PROVIDER_ERROR` → `provider_error`
    - reszta → `unknown_error`
- **AC**:
  - po `POST /api/plants` UI potrafi pokazać dokładny ekran (timeout/provider error) bez zgadywania

### 9) Spójność walidacji `species_name` dla suggest
- **Pliki**: `src/lib/api/watering-plans/suggest-watering-plan-request.ts`
- **Zmiany**:
  - limit długości `species_name` w suggest (teraz 200) dopasować do reguł z PRD/API (np. 120) albo jasno uzasadnić rozjazd
- **AC**:
  - te same reguły długości w create i suggest (mniej “niespodzianek”)

### 10) Dodać “security headers”/cache spójnie dla per-user danych
- **Pliki**: wszystkie route’y zwracające dane użytkownika, min. `src/pages/api/plants/index.ts`
- **Zmiany**:
  - `Cache-Control: no-store` + `Vary: Authorization, Cookie` (analogicznie do quota)
- **AC**:
  - brak ryzyka cache’owania per-user odpowiedzi przez proxy

### 11) Dopisać testy regresji kontraktu (min. parsowanie + error.details)
- **Pliki**:
  - backend: testy parserów requestów (na wzór istniejących `validation.test.ts` w UI)
  - frontend: ewentualnie test `mergeFieldErrorsFromDetails` pod `issues[].path` jako string
- **AC**:
  - test potwierdza: `VALIDATION_ERROR` → `422` + `details.issues` i poprawne mapowanie na pola

### 12) Aktualizacja dokumentacji (żeby kontrakt był “jednym źródłem prawdy”)
- **Pliki**: `@.ai/api-plan.md`
- **Zmiany**:
  - dopisać finalny format `error.details` dla walidacji (np. `details.issues[]`), oraz potwierdzić `422` jako standard
  - opisać finalną decyzję dot. default `generate_watering_suggestion`
- **AC**:
  - dokumentacja i implementacja nie rozjeżdżają się na podstawach (quota, statusy, walidacja)

Jeśli chcesz, mogę od razu zamienić tę listę w checklistę “PR-ready” (kolejność commitów + zakres plików na commit + co sprawdzić ręcznie w UI po każdej zmianie).