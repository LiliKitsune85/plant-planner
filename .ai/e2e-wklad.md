### Cel testu E2E (MVP / PRD)
Pokryć **US-001 (Dodanie rośliny ręcznie)**: użytkownik podaje minimalnie **nazwę gatunku**, zapis przechodzi, a aplikacja przechodzi do kolejnego kroku konfiguracji (**redirect do `/plants/:id/watering-plan`**).

Żeby test był **stabilny** na Supabase w chmurze, test celowo **wyłącza AI** (nie testujemy US-002 w tym scenariuszu), bo AI wymaga dodatkowych sekretów (service-role/OpenRouter) i jest podatne na limity/timeouty.

---

### Założenia środowiskowe (Supabase cloud + `.env.test`)
- **Aplikacja** uruchamia się lokalnie (`astro dev`) i łączy się z **Supabase w chmurze**.
- W `.env.test` muszą być (nazwy zgodne z kodem):
  - **`SUPABASE_URL`**
  - **`SUPABASE_KEY`** (to jest public/anon key – w PRD/treści masz „SUPABASE_PUBLIC_KEY”, ale w kodzie używacie `SUPABASE_KEY`)
  - Dane testowego użytkownika (dodajcie, bo obecnie testy E2E tego nie używają):
    - **`E2E_USER_EMAIL`**
    - **`E2E_USER_PASSWORD`**
- Playwright już jest w repo (`@playwright/test`) i jest skonfigurowany na **Chromium/Desktop Chrome**.

---

### Krok po kroku: plan implementacji (instrukcja)
#### 1) Napraw i dopnij konfigurację Playwright (żeby w ogóle ruszyło)
- **Plik**: `playwright.config.ts`
- **Fix krytyczny**: brakuje importu `path`, a jest używany w `dotenv.config({ path: path.resolve(...) })`.
  - Dodaj import z Node: `import path from 'node:path'` (albo `import * as path from 'node:path'`).
- **Upewnij się, że dev server działa w trybie testowym** (żeby Astro/Vite wczytało `.env.test`):
  - W `webServer.command` preferuj uruchomienie skryptu `dev:e2e` (macie go w `package.json`): `astro dev --mode test`.
  - Docelowo: `npm run dev:e2e -- --host 127.0.0.1 --port ${DEV_SERVER_PORT}`.

#### 2) Przygotuj testowego użytkownika w Supabase (dane stałe dla E2E)
- W Supabase Dashboard → **Authentication → Users**:
  - Utwórz użytkownika dla E2E (email/hasło).
- W `.env.test` ustaw `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`.
- (Opcjonalnie) ustaw mu profil/timezone – middleware i tak ma bezpieczny fallback (`profileTimezone=null`), więc nie blokuje testu.

#### 3) Ustal selektory: preferuj stabilne (`data-testid`) albo istniejące `label/id`
Macie już bardzo stabilne `id` + `Label htmlFor`:
- Login:
  - email: `#auth-email`
  - password: `#auth-password`
  - przycisk: `role=button name="Zaloguj się"`
- Create plant:
  - species: `#species_name`
  - AI toggle: `#create-plant-ai-toggle` (Radix Switch zwykle ma `role="switch"`)
  - submit: `role=button name="Dodaj roślinę"`

**Rekomendacja (zgodnie z regułą Playwright):** dodaj `data-testid` w UI, jeśli chcecie super-odporne testy (np. `data-testid="create-plant-species"`, `data-testid="create-plant-submit"`, `data-testid="create-plant-ai-toggle"`). To nie jest konieczne do 1 prostego testu, ale bardzo pomaga w utrzymaniu.

#### 4) Rozszerz Page Object dla logowania (macie już `LoginPage`)
- **Plik**: `tests/e2e/pages/LoginPage.ts`
- Dodaj locatory dla pól i metodę `signIn(email, password)`:
  - wypełnij email/hasło
  - kliknij “Zaloguj się”
  - `await page.waitForURL('**/plants/new')` (bo `SignInForm` robi `window.location.assign(returnTo)`)

#### 5) Dodaj Page Object dla “Dodaj roślinę”
- **Nowy plik**: `tests/e2e/pages/CreatePlantPage.ts`
- Co powinien udostępniać:
  - `speciesNameInput`
  - `aiToggleSwitch`
  - `submitButton`
  - `goto()` (nawigacja na `/plants/new`, ale uwaga: bez sesji middleware i tak przekieruje do login)
  - `disableAiIfEnabled()`:
    - sprawdź `aria-checked === 'true'` na switchu i kliknij, żeby wyłączyć
  - `createPlant({ speciesName })`:
    - wypełnij `species_name`
    - kliknij submit
    - poczekaj na redirect do `/plants/:uuid/watering-plan`

#### 6) Dodaj minimalny Page Object dla ekranu “Plan podlewania”
- **Nowy plik**: `tests/e2e/pages/PlantWateringPlanPage.ts`
- Wystarczy:
  - `heading` = `getByRole('heading', { name: /Ustaw plan podlewania/i })`
  - `speciesLine` = tekst “Na podstawie preferencji gatunku: …” (asercja zawiera speciesName)

#### 7) Napisz 1 test E2E: “create plant (AI off) → redirect to watering-plan”
- **Nowy plik testu**: `tests/e2e/create-plant.spec.ts`
- Struktura testu wg AAA:
  - **Arrange**
    - `const context = await browser.newContext()` (izolacja)
    - `const page = await context.newPage()`
    - `loginPage.goto('/plants/new')` (macie już taki pattern)
    - zaloguj się danymi z env
  - **Act**
    - na `/plants/new` wyłącz AI (switch)
    - wpisz unikalną nazwę gatunku, np. `E2E Sansevieria ${Date.now()}`
    - wyślij formularz
  - **Assert**
    - `expect(page).toHaveURL(/\/plants\/[0-9a-f-]{36}\/watering-plan/)`
    - `expect(heading).toBeVisible()`
    - `expect(speciesLine).toContainText(speciesName)`
  - **Cleanup (ważne przy Supabase cloud)**
    - wyciągnij `plantId` z URL (regex)
    - usuń roślinę przez API w `finally`:
      - `await page.request.delete(\`/api/plants/${plantId}?confirm=true\`)`
      - asercja: status 200 i `data.deleted === true`
