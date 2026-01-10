<plan_testów>

### 1) Wprowadzenie i cele testowania
- **Cel główny**: potwierdzenie jakości i bezpieczeństwa aplikacji Plant Planner (Astro + React, API w `src/pages/api`, backend Supabase) w obszarach: autoryzacja, zarządzanie roślinami, plany podlewania, zadania podlewania, kalendarz, integracja AI (OpenRouter) i limity.
- **Cele szczegółowe**:
  - **Poprawność domenowa**: zadania/plan podlewania i ich regeneracja, reguły „adhoc vs scheduled”, poprawne agregacje kalendarza.
  - **Bezpieczeństwo**: izolacja danych per użytkownik (RLS + filtry `user_id`), odporność na nadużycia (open redirect, injekcje w query/or).
  - **Stabilność API**: spójność kontraktu „envelope” (`data/error/meta`), przewidywalne kody błędów, walidacja wejścia (Zod).
  - **Użyteczność**: czytelne błędy w UI (mapowanie błędów klienta), poprawna nawigacja i przekierowania.
  - **Wydajność**: brak regresji w kluczowych endpointach, kontrola czasu odpowiedzi dla integracji AI.

---

### 2) Zakres testów
- **W zakresie (in-scope)**:
  - **UI (Astro + React)**: strony w `src/pages` (auth/plants/calendar), komponenty React `src/components/**` używane w krytycznych flow (logowanie, dodanie rośliny, ustawienie planu).
  - **API**: wszystkie endpointy w `src/pages/api/**` (auth, plants, calendar, watering-tasks, ai).
  - **Warstwa serwisów**: logika w `src/lib/services/**` (plants, watering-plans, watering-tasks, calendar, ai) + walidatory requestów w `src/lib/api/**`.
  - **Integracje**: Supabase (auth + DB + RPC), OpenRouter (AI suggest), mechanizm quota.
  - **Middleware**: ochrona ścieżek prywatnych (`/calendar`, `/plants`, `/settings`) i ładowanie timezone profilu (`src/middleware/index.ts`).
- **Poza zakresem (out-of-scope / tylko smoke)**:
  - **Wygląd/UX pixel-perfect** (poza podstawową walidacją UI i dostępnością).
  - **Zaawansowane testy kompatybilności przeglądarek** (na start: Chromium + 1 dodatkowa przeglądarka w E2E).
  - **Wysyłka maili resetu hasła** (w repo widać UI, ale backend może być częściowo planowany — testy zależne od finalnej implementacji).

---

### 3) Typy testów do przeprowadzenia
- **Testy jednostkowe (Unit)**:
  - **Co**: czyste funkcje i walidatory (Zod), mapery DTO→VM, budowa cursorów, utilsy dat/stref czasowych.
  - **Gdzie**: `src/lib/api/**`, `src/lib/services/**` (części bez I/O), `src/lib/utils/**`, `src/components/**` (view-model/validation).
  - **Narzędzie**: **Vitest** (już skonfigurowany).
- **Testy integracyjne (Service/DB)**:
  - **Co**: serwisy z realnym Supabase (lokalny/staging) i RPC (`set_watering_plan_version`, `regenerate_watering_tasks`), weryfikacja filtrów `user_id`.
  - **Narzędzie**: Vitest + środowisko Supabase (lokalne lub dedykowany projekt testowy).
- **Testy kontraktowe API (Contract)**:
  - **Co**: format odpowiedzi `{data,error,meta}`, kody statusów i `error.code`, obsługa błędów walidacji (`VALIDATION_ERROR`, `INVALID_QUERY_PARAMS`, `INVALID_CURSOR`, itd.).
  - **Forma**: testy „black-box” HTTP dla endpointów `src/pages/api/**`.
- **Testy E2E (UI + API)**:
  - **Co**: pełne ścieżki użytkownika: logowanie → rośliny → plan podlewania → kalendarz → zadania.
  - **Narzędzie (rekomendowane)**: Playwright (brak w `package.json` → do dodania w backlogu QA).
- **Testy bezpieczeństwa (AppSec)**:
  - **Co**: kontrola dostępu, open redirect, podatności związane z parametrami zapytań (cursor, `or(...)`, `ilike`), sanityzacja `photo_path`.
  - **Forma**: testy automatyczne + krótka sesja manualna OWASP Top 10 (w szczególności A01, A03, A05, A07).
- **Testy wydajnościowe (Non-functional)**:
  - **Co**: krytyczne endpointy listujące (plants, watering-tasks) + AI suggest/quota.
  - **Narzędzie (rekomendowane)**: k6 / Artillery (do dodania), minimum: pomiar latencji w CI (progi).

---

### 4) Scenariusze testowe dla kluczowych funkcjonalności

#### 4.1 Autoryzacja i sesja (UI + API + middleware)
- **AUTH-01**: Dostęp do `/calendar` bez sesji → przekierowanie 303 do `/auth/login` z poprawnym `returnTo`.
- **AUTH-02**: Dostęp do `/plants` bez sesji → przekierowanie jak wyżej.
- **AUTH-03**: `POST /api/auth/sign-in`:
  - **Poprawne dane** → `200`, `data.user`, `data.profile`, `meta.request_id`, brak cache (`Cache-Control: no-store`).
  - **Błędne hasło/email** → `401`, `error.code=INVALID_CREDENTIALS`.
  - **Zbyt wiele prób** → `429`, `error.code=RATE_LIMITED` (o ile Supabase zwraca 429).
  - **Niepoprawny JSON** → `400`, `INVALID_JSON`.
  - **Walidacja Zod** (np. email pusty, hasło <8) → `422`, `VALIDATION_ERROR` + `details.issues`.
- **AUTH-04**: Sesja po sign-in:
  - **Cel**: potwierdzić, że po logowaniu użytkownik jest traktowany jako zalogowany na ścieżkach prywatnych (cookies/Authorization).
- **AUTH-05**: `POST /api/auth/sign-out`:
  - **returnTo w formData** (prawidłowe) → redirect 303 do `/auth/login?returnTo=...`
  - **open redirect**: `returnTo=https://...` lub `//evil` → sanitizacja do bezpiecznego fallback.
- **AUTH-06**: Obsługa profilu timezone w middleware:
  - brak profilu/wyjątek → brak crash, log + `profileTimezone=null`.

#### 4.2 Rośliny (plants)
- **PLANT-01**: `GET /api/plants` bez auth → `401 UNAUTHENTICATED`.
- **PLANT-02**: `GET /api/plants` filtrowanie:
  - `q` (wyszukiwanie w `species_name`/`nickname`) i escapowanie wzorca.
  - `species` (normalizacja do `species_name_normalized`).
- **PLANT-03**: `GET /api/plants` paginacja cursor:
  - `next_cursor` obecny przy `limit+1`, brak przy końcu.
  - **Błędny cursor** → `400 INVALID_CURSOR`.
  - **Cursor innego usera** → `400 INVALID_CURSOR`.
  - **Cursor niezgodny z sort/order** → `400 INVALID_CURSOR`.
- **PLANT-04**: `POST /api/plants` walidacja:
  - `species_name` wymagane.
  - `purchase_date` tylko ISO (YYYY-MM-DD) i realna data.
  - `photo_path` nie może być URL, nie może zawierać `..`, `\`, `?`, `#`, nie może zaczynać się od `/`.
- **PLANT-05**: `POST /api/plants` konkurencja `duplicate_index`:
  - symulacja konfliktu unikalności → retry do 3 prób, finalnie `409 DUPLICATE_INDEX_CONFLICT` jeśli konflikt utrzymany.
- **PLANT-06**: `GET /api/plants/:id`:
  - własna roślina → `200`.
  - cudza roślina / brak → `404 PLANT_NOT_FOUND`.
- **PLANT-07**: `PATCH /api/plants/:id`:
  - aktualizacja pól opcjonalnych i ich nullowanie.
  - niepoprawny JSON → `400 INVALID_JSON`.
  - payload niezgodny → `4xx VALIDATION_ERROR`.
- **PLANT-08**: `DELETE /api/plants/:id`:
  - własna → `200 deleted=true`.
  - cudza/brak → `404 PLANT_NOT_FOUND`.

#### 4.3 Plany podlewania (watering-plans)
- **PLAN-01**: `PUT /api/plants/:plantId/watering-plan` (manual):
  - zapis planu → `200`, zwrot `plan` + `tasks_regenerated` (zakres dat + liczba).
- **PLAN-02**: `PUT .../watering-plan` (AI source):
  - `source.type=ai` → weryfikacja własności `ai_request_id`:
    - brak/cudzy → `404 AI_REQUEST_NOT_FOUND`.
- **PLAN-03**: Konflikt planu (unikalność / równoległy update) → `409 PLAN_CONFLICT`.
- **PLAN-04**: RPC `regenerate_watering_tasks`:
  - zwraca poprawny zakres dat (`from/to`) i `task_count`; jeśli nie → `500 TASK_REGENERATION_INVALID`.
- **PLAN-05**: Historia planów `GET /api/plants/:plantId/watering-plans`:
  - paginacja `next_cursor` (cursor po `valid_from` + `id`).
  - `activeOnly` (jeśli wspierane w parserze) i sort/order.
  - walidacja cursor (zależnie od implementacji `cursor.ts` i parsera).
- **PLAN-06**: Sugestia AI `POST /api/plants/:plantId/watering-plan/suggest`:
  - sukces → `200` + `suggestion` zgodna ze schematem (min/max, spójność `custom_start_on`).
  - rate limit quota → `429 AI_RATE_LIMITED` + `details.unlock_at`.
  - awaria providera / schema mismatch → błąd z `ai_requests` oznaczony jako error (weryfikacja po stronie DB w testach integracyjnych).

#### 4.4 Zadania podlewania (watering-tasks)
- **TASK-01**: `GET /api/watering-tasks` filtry:
  - zakres dat `from/to` ≤ 366 dni, `from <= to`.
  - `plant_id` UUID, `status`, `source`.
  - reguła: `source=adhoc` i `status=pending` → `400 VALIDATION_ERROR`.
- **TASK-02**: `GET /api/watering-tasks` paginacja cursor:
  - cursor zawiera snapshot filtrów; zmiana filtra → `INVALID_CURSOR`.
  - deterministyczny order (`sort` + `id`).
- **TASK-03**: `POST /api/plants/:plantId/watering/adhoc`:
  - tworzy task `completed` z `due_on=completed_on`.
  - unikalność „task already exists for this day” → `409 TASK_ALREADY_EXISTS`.
- **TASK-04**: `PATCH /api/watering-tasks/:taskId` (update):
  - **scheduled**:
    - `pending→completed` wymaga `completed_on`, ustawia `completed_at`.
    - `completed→pending` czyści `completed_on/completed_at`.
    - zmiana `completed_on` przy `status=completed` dozwolona.
    - gdy `schedule_basis=completed_on` → wywołanie RPC regeneracji i `schedule_effect.tasks_regenerated=true`.
  - **adhoc**:
    - nie wolno „odkompletować” (musi zostać `completed`) → `409 CONSTRAINT_VIOLATION`.
    - zmiana `completed_on` aktualizuje także `due_on`.
- **TASK-05**: `DELETE /api/watering-tasks/:taskId`:
  - **adhoc**: fizyczne usunięcie.
  - **scheduled**: tylko jeśli `status=completed`, reset do `pending`; jeśli `pending` → `409 NOT_ALLOWED`.
  - brak `plan_id` w scheduled → `500 TASK_INVALID_STATE`.

#### 4.5 Kalendarz (calendar)
- **CAL-01**: `/calendar` redirect na bieżący miesiąc w timezone profilu (fallback `UTC`).
- **CAL-02**: `GET /api/calendar/month?month=YYYY-MM&status=...`
  - walidacja `month` regex.
  - agregacja count per `due_on`; brak `due_on` w wierszu → `500 CALENDAR_MONTH_ROW_INVALID`.
- **CAL-03**: `GET /api/calendar/day?date=YYYY-MM-DD&status=...&sort=...`
  - sortowanie po `plants.species_name` + `duplicate_index` i stabilne dogrywki (`due_on`, `id`).
  - brak join `plants` → `500 CALENDAR_TASK_PLANT_MISSING`.
- **CAL-04**: Scenariusze stref czasowych/DST:
  - użytkownik `Europe/Warsaw` vs `America/Los_Angeles` na przełomie miesiąca (np. 23:30 UTC) → poprawny miesiąc/dzień.

#### 4.6 AI quota
- **AI-01**: `GET /api/ai/quota`:
  - bez auth → `401 UNAUTHENTICATED`.
  - z auth → `200` + `Cache-Control: no-store`, `Vary: Authorization, Cookie`.
  - poprawne okno godzinowe (UTC) i `unlock_at` gdy limit przekroczony.
- **AI-02**: Testy jednostkowe `getAiQuota`:
  - `now` invalid → `500 AI_QUOTA_INVALID_DATE`.
  - `userId` missing → `500 AI_QUOTA_USER_MISSING`.

---

### 5) Środowisko testowe
- **Środowiska**:
  - **Local**: Astro dev/preview + Supabase lokalnie (preferowane do integracyjnych i E2E).
  - **Staging**: dedykowany projekt Supabase testowy + mock/limitowane klucze OpenRouter.
  - **CI**: uruchamianie `vitest run` (już istnieje skrypt `npm test`).
- **Dane testowe** (seed):
  - min. **2 użytkowników** (UserA/UserB) do testów izolacji danych.
  - rośliny z tym samym `species_name_normalized` (test `duplicate_index`).
  - zadania `scheduled` i `adhoc` na te same dni, statusy `pending/completed`.
  - plany podlewania różne `schedule_basis` (`due_on` vs `completed_on`) + przypadki z AI.
- **Zmienne środowiskowe**:
  - `SUPABASE_URL`, `SUPABASE_KEY`
  - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `APP_BASE_URL` (w testach AI: preferować mock).

---

### 6) Narzędzia do testowania
- **Obecnie w repo**:
  - **Vitest**: unit + część integration/contract.
  - **ESLint/Prettier**: jako gate jakości (nie testy funkcjonalne, ale kontrola regresji).
- **Rekomendowane do dodania (backlog QA)**:
  - **Playwright**: E2E (UI + API + cookies/session).
  - **@testing-library/react** + **jsdom/happy-dom**: testy komponentów React (jeśli potrzebne interakcje DOM).
  - **MSW**: mockowanie fetch w testach UI/klientów API.
  - **axe-core**: testy dostępności podstawowej (WCAG smoke).
  - **k6/Artillery**: testy wydajności endpointów listujących i AI.
  - **Dependabot/Snyk (opcjonalnie)**: skan podatności zależności.

---

### 7) Harmonogram testów
- **Faza 0 (ciągła, od teraz)**: uruchamianie `vitest` w CI na każdy PR, smoke dla istniejących testów UI/VM.
- **Faza 1 (Sprint 1)**: unit + contract dla krytycznych endpointów:
  - auth (`sign-in`, `sign-out`, middleware redirect),
  - plants list/create (walidacja + cursor),
  - watering-tasks list/update/delete (walidacja + cursor + reguły).
- **Faza 2 (Sprint 2)**: integracyjne z Supabase + RPC:
  - set plan + regeneracja,
  - update task + regeneracja (schedule_basis=completed_on),
  - izolacja danych UserA/UserB.
- **Faza 3 (Sprint 3)**: E2E (Playwright) + podstawowe bezpieczeństwo i dostępność:
  - pełne flow użytkownika + testy open redirect, unauth access, session.
- **Faza 4 (przed release)**: performance smoke + regresja end-to-end na staging.

---

### 8) Kryteria akceptacji testów (Exit criteria)
- **Krytyczne**:
  - **0 otwartych defektów P0/P1** w obszarach: auth, izolacja danych, CRUD roślin, aktualizacja/undo zadań, set plan + RPC.
  - **100% pass** dla testów kontraktowych endpointów krytycznych (auth/plants/watering-tasks/calendar).
- **Jakościowe**:
  - Stabilny kontrakt odpowiedzi API: zawsze `Content-Type: application/json` dla endpointów JSON i spójny envelope.
  - Walidacja wejścia: brak nieobsłużonych wyjątków dla niepoprawnych danych (zwracane kontrolowane błędy 4xx).
- **Pokrycie (orientacyjne progi)**:
  - min. **80% pokrycia** (linie) dla `src/lib/api/**` i kluczowych mapperów/cursorów/utili.
  - testy integracyjne pokrywają przynajmniej 1 scenariusz na każde RPC.

---

### 9) Role i odpowiedzialności
- **QA Engineer**:
  - projektowanie scenariuszy, utrzymanie testów kontraktowych/E2E, triage defektów, raporty jakości.
- **Backend/Fullstack Developer**:
  - wsparcie w seed danych, poprawki błędów, ekspozycja stabilnych punktów integracyjnych (np. testowe RPC/fixtures).
- **Frontend Developer**:
  - testy view-model/walidacji UI, poprawki dostępności i UX błędów.
- **DevOps/Owner repo**:
  - konfiguracja CI, środowisk Supabase test/staging, zarządzanie sekretami (OpenRouter/Supabase).

---

### 10) Procedury raportowania błędów
- **Kanał**: GitHub Issues (lub narzędzie zespołu) + link do runu CI.
- **Wymagane informacje w zgłoszeniu**:
  - **Tytuł**: `[MODUŁ] krótki opis` (np. `[watering-tasks] DELETE scheduled pending zwraca 200 zamiast 409`).
  - **Środowisko**: local/staging/prod + wersja commit.
  - **Kroki odtworzenia**: numerowane, z payloadem requestu / parametrami URL.
  - **Oczekiwane vs rzeczywiste**: status HTTP, `error.code`, fragment response envelope.
  - **Dowody**: log `request_id` z `meta`, zrzut ekranu (UI), ewentualnie export danych testowych (ID user/plant/task).
- **Klasyfikacja**:
  - **P0**: wyciek danych / obejście auth / crash w krytycznym flow.
  - **P1**: błędne operacje domenowe (regeneracja zadań, nieprawidłowe statusy), brak możliwości użycia kluczowej funkcji.
  - **P2/P3**: błędy UX, edge-case’y, kosmetyka.

</plan_testów>