## API Endpoint Implementation Plan: GET `/api/ai/quota`

## 1. Przegląd punktu końcowego
- **Cel**: zwrócić bieżące limity i wykorzystanie zapytań AI dla zalogowanego użytkownika (**20 requestów / godzinę**).
- **Źródło prawdy**: tabela `public.ai_requests` (audyt + limitowanie).
- **Charakterystyka**: endpoint tylko do odczytu; nie tworzy żadnych rekordów w DB.
- **Tech stack**: Astro 5 Server Endpoint (`src/pages/api/**`), Supabase (Postgres), TypeScript 5, walidacja i obsługa błędów zgodnie z istniejącymi wzorcami (`HttpError`, `{ data, error, meta }`).

## 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **URL**: `/api/ai/quota`
- **Nagłówki**:
  - **Wymagane (logicznie)**: uwierzytelnienie użytkownika
    - preferowany: `Authorization: Bearer <access_token>`
    - alternatywnie: sesja cookie obsługiwana przez `locals.supabase.auth.getUser()`
- **Parametry**:
  - **Wymagane**: brak
  - **Opcjonalne**: brak
- **Request Body**: brak

### Wykorzystywane typy (DTO / Command modele)
- **DTO**:
  - `AiQuotaDto` (`src/types.ts`) – payload w `data`
  - `ApiEnvelope<AiQuotaDto>` – lokalny typ pomocniczy endpointu (spójny z innymi route’ami)
- **Command modele**: brak (endpoint nie przyjmuje body ani query params)

### Walidacja wejścia
- Brak danych wejściowych do walidacji (poza wymogiem sesji).
- Guard clause: jeśli użytkownik niezalogowany → `401 UNAUTHENTICATED`.

## 3. Szczegóły odpowiedzi
### 200 OK
Envelope JSON:
- `data`: obiekt typu `AiQuotaDto`
- `error`: `null`
- `meta`: `{}` (zgodnie ze specyfikacją)

Wartości w `data`:
- `limit_per_hour`: stała `20`
- `used_in_current_window`: liczba rekordów `ai_requests` w bieżącym oknie
- `remaining`: `max(0, limit_per_hour - used_in_current_window)`
- `window_resets_at`: czas końca bieżącego okna (ISO8601, UTC)
- `is_rate_limited`: `used_in_current_window >= limit_per_hour`
- `unlock_at`: `window_resets_at` jeśli `is_rate_limited=true`, w przeciwnym razie `null`

Przykład:
```json
{
  "data": {
    "limit_per_hour": 20,
    "used_in_current_window": 3,
    "remaining": 17,
    "window_resets_at": "2026-01-03T13:00:00Z",
    "is_rate_limited": false,
    "unlock_at": null
  },
  "error": null,
  "meta": {}
}
```

### 401 UNAUTHENTICATED
- Gdy brak poprawnej sesji lub tokenu.

### 500 INTERNAL_SERVER_ERROR
- Gdy wystąpi błąd zapytania do Supabase/Postgres lub inny nieobsłużony wyjątek.

## 4. Przepływ danych
### Okno limitu (definicja)
Aby uzyskać `window_resets_at` w formacie jak w specyfikacji (`...:00:00Z`), przyjmujemy **stałe okno godzinne wyrównane do pełnej godziny w UTC**:
- `window_start_utc` = początek bieżącej godziny (UTC)
- `window_end_utc` = `window_start_utc + 1h` (**to jest `window_resets_at`**)

### Odczyt z DB (zliczanie)
- Wykonać zapytanie count do `public.ai_requests` filtrowane:
  - `user_id = <current_user_id>`
  - `requested_at >= window_start_utc`
  - `requested_at < window_end_utc`
- Zwrócić `count` jako `used_in_current_window`.

### Miejsce logiki (service)
Wyodrębnić całą logikę do serwisu, aby:
- nie duplikować obliczeń w kolejnych endpointach AI (np. `POST /api/plants/{plantId}/watering-plan/suggest`)
- zapewnić spójne `window_resets_at/unlock_at`

Proponowane moduły:
- `src/lib/services/ai/get-ai-quota.ts`
  - `getAiQuota(supabase, { userId, now? }) => Promise<AiQuotaDto>`
  - `now` opcjonalnie dla testowalności (domyślnie `new Date()`).

Endpoint:
- `src/pages/api/ai/quota.ts`
  - wywołuje `requireUserId()`
  - wywołuje `getAiQuota()`
  - zwraca envelope z `200`

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**: wymagany zalogowany użytkownik (`locals.supabase.auth.getUser()`), analogicznie do istniejących endpointów.
- **Autoryzacja / izolacja danych**:
  - zapytanie zawsze filtruje po `user_id`
  - dodatkowo zakładamy RLS na `ai_requests` (SELECT tylko właściciel) — nawet przy błędzie filtrów nie powinno dojść do wycieku.
- **Brak danych wrażliwych w odpowiedzi**: nie zwracamy `user_id`, `provider`, `model`, błędów AI, itp.
- **Cache**:
  - odpowiedź jest per-user i dynamiczna → ustawić `Cache-Control: no-store`
  - rozważyć `Vary: Authorization, Cookie` (jeśli aplikacja stoi za proxy/CDN).
- **Odporność na nadużycia**:
  - endpoint nie modyfikuje stanu; nie powoduje kosztów zewnętrznych (brak OpenRouter call)
  - mimo to warto utrzymywać prostą ochronę przed nadmiernym pollingiem na poziomie edge/CDN (poza zakresem tego endpointu).

## 6. Obsługa błędów
### Scenariusze i kody statusu
- **401 UNAUTHENTICATED**
  - Brak sesji lub błąd `supabase.auth.getUser()`
  - Envelope: `data: null`, `error.code: "UNAUTHENTICATED"`
- **500 INTERNAL_SERVER_ERROR**
  - Błąd supabase query (`ai_requests` count)
  - Inne nieobsłużone wyjątki
  - Envelope: `data: null`, `error.code: "INTERNAL_SERVER_ERROR"` lub bardziej szczegółowy kod serwisowy (np. `AI_QUOTA_LOOKUP_FAILED`) mapowany na 500

### Logowanie / audyt błędów
- Dla tego endpointu **nie zapisujemy nic do `public.ai_requests`** (to nie jest request do AI).
- Logowanie do stdout:
  - na błędach kontrolowanych (`HttpError`) → `console.error` z kontekstem (endpoint, `userId` jeśli bezpieczne)
  - na błędach niekontrolowanych → `console.error('Unhandled error in GET /api/ai/quota', { error })`
- Jeśli w projekcie istnieje centralna tabela błędów/telemetrii (nie wynika ze specyfikacji), można dodać integrację jako osobny krok (out of scope).

## 7. Wydajność
- Zastosować **count bez pobierania wierszy** (np. `select('id', { count: 'exact', head: true })`), by minimalizować transfer.
- Zapytanie wspierane przez indeks: `ai_requests_user_requested_at_idx (user_id, requested_at DESC)`.
- Koszt O(1) w praktyce (limit 20/h) — nawet przy większych wartościach count w oknie, index range scan powinien być szybki.
- Zalecenie UX: klient może odświeżać quota po akcjach AI, a nie w pętli co sekundę.

## 8. Kroki implementacji
1. **Ustalić kontrakt i typy**
   - Potwierdzić, że `src/types.ts` zawiera `AiQuotaDto` (już istnieje).
   - Ustalić, że `meta` w odpowiedzi pozostaje `{}` (zgodnie z API planem).

2. **Dodać serwis do wyliczania quota**
   - Utworzyć `src/lib/services/ai/get-ai-quota.ts`:
     - stała `AI_LIMIT_PER_HOUR = 20`
     - funkcja obliczająca `window_start_utc` i `window_end_utc` wyrównane do pełnej godziny w UTC
     - zapytanie count do `ai_requests` (filtry: `user_id`, `requested_at` w oknie)
     - obliczenie pól DTO z guardami (wartości nieujemne)
     - w razie błędów z Supabase → `throw new HttpError(500, 'Failed to read AI quota', 'AI_QUOTA_LOOKUP_FAILED')`

3. **Dodać endpoint Astro**
   - Utworzyć plik `src/pages/api/ai/quota.ts` oraz katalog `src/pages/api/ai/` (jeśli nie istnieje).
   - W pliku:
     - `export const prerender = false`
     - zdefiniować lokalny `ApiEnvelope<T>` i helper `json(...)` (jak w innych endpointach)
     - skopiować sprawdzony wzorzec `getBearerToken()` + `requireUserId()` (Bearer lub cookie)
     - `GET`:
       - `userId = await requireUserId(...)`
       - `quota = await getAiQuota(locals.supabase, { userId })`
       - `return json(200, { data: quota, error: null, meta: {} }, { 'Cache-Control': 'no-store' })`
     - `catch`:
       - jeśli `isHttpError` → mapować `error.status` i envelope
       - w innym przypadku → `500` z `INTERNAL_SERVER_ERROR`

4. **Walidacja i zgodność czasowa**
   - Upewnić się, że `window_resets_at` i `unlock_at` zwracane są w ISO8601 UTC (`toISOString()`).
   - Upewnić się, że logika okna (wyrównanie do pełnej godziny) jest spójna z planowanym `unlock_at` w odpowiedzi 429 na AI suggest.

5. **Bezpieczeństwo i RLS**
   - Zweryfikować, że `ai_requests` ma RLS i politykę SELECT tylko dla właściciela.
   - Sprawdzić, że endpoint nie używa klucza serwisowego i nie omija RLS (powinien używać `locals.supabase`).

