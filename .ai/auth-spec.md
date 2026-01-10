# Plant Planner — Specyfikacja architektury modułu autentykacji (US-008 + zależności)

Dokument opisuje docelową architekturę modułu **rejestracji, logowania, wylogowywania i odzyskiwania hasła** w aplikacji Plant Planner, oraz minimalne zależności potrzebne do realizacji:

- US-009 (usunięcie konta i danych),
- US-020 (ustawienia profilu: pseudonim i strefa czasowa),
- US-022 (spójne przechwytywanie 401 / redirect do logowania),

zgodnie z:

- wymaganiami z `@.ai/prd.md` (US-008, US-009, US-020, US-022),
- technologiami z `@.ai/tech-stack.md` (Astro 5 + React 19 + TypeScript 5 + Tailwind 4 + shadcn/ui + Supabase),
- istniejącymi konwencjami projektu (SSR, middleware Supabase, envelope JSON, walidacja Zod, `HttpError`).

To jest **specyfikacja** (architektura, kontrakty, odpowiedzialności), **bez implementacji**.

---

## 0. Kontekst w repozytorium (stan obecny)

### 0.1 SSR i adapter

- Aplikacja działa w trybie SSR (`output: "server"`) i na adapterze Node (`astro.config.mjs`).
- Strony aplikacyjne używają `export const prerender = false` (np. `src/pages/plants/...`), co jest kompatybilne z sesją w cookies.

### 0.2 Supabase w middleware (punkt integracji)

- `src/middleware/index.ts` tworzy `createServerClient` z `@supabase/ssr` i zapisuje go do `context.locals.supabase`.
- Cookie storage jest podpięty przez `context.cookies.getAll()/setAll()`.
- To oznacza, że:
  - endpointy i strony Astro mogą czytać sesję z cookies przez `locals.supabase.auth.getUser()`,
  - endpointy `POST` wykonujące operacje auth mogą ustawiać/usuwać cookies w odpowiedzi (przez `context.cookies.set()` w middleware).

### 0.3 Styl API (konwencje)

W API projektu istnieją stałe elementy, które należy zachować:

- **Envelope JSON**: `{ data, error, meta }` (por. `src/pages/api/plants/index.ts`).
- **Błędy**: `HttpError(status, message, code, details?)` z `src/lib/http/errors.ts`.
- **Walidacja wejścia**: Zod w `src/lib/api/**` (np. `parseCreatePlantRequest`), typowe kody błędów:
  - `INVALID_JSON`, `INVALID_QUERY_PARAMS`, `VALIDATION_ERROR`, `UNAUTHENTICATED`.
- **Autoryzacja w API**: helper `src/lib/api/auth/require-user-id.ts` wspiera bearer token i cookies.

---

## 1. ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA

### 1.1 Cele UX (US-008)

- Użytkownik ma dedykowane strony: **logowanie** i **rejestracja**.
- Użytkownik loguje się / wylogowuje przyciskiem w prawym górnym rogu w głównym layoucie (`src/layouts/Layout.astro`).
- Dostępne jest **odzyskiwanie hasła**.
- Brak logowania zewnętrznego (Google/GitHub) — tylko email+hasło.
- Aplikacja wspiera **pseudonim** użytkownika (US-020): jeśli brak pseudonimu, UI może pokazywać email jako fallback.

Uwaga dot. PRD:
- PRD opisuje konto jako „e-mail + hasło + pseudonim”, ale kryteria akceptacji US-008 nie wymagają pseudonimu podczas rejestracji — dlatego w MVP traktujemy go jako opcjonalny atrybut profilu, edytowalny w US-020.

### 1.2 Routing: strony auth i non-auth

#### 1.2.1 Strony auth (nowe)

Proponowane ścieżki (grupowanie pod `/auth` upraszcza ochronę tras i organizację):

- `src/pages/auth/login.astro` — logowanie
- `src/pages/auth/register.astro` — rejestracja
- `src/pages/auth/forgot-password.astro` — formularz prośby o reset hasła
- `src/pages/auth/reset-password.astro` — formularz ustawienia nowego hasła (po wejściu z linku)
- `src/pages/auth/callback.astro` — endpoint/page SSR do finalizacji sesji po linku email (recovery / magic link), a następnie przekierowanie

Wszystkie powyższe strony:

- powinny mieć `export const prerender = false`,
- powinny używać osobnego layoutu (patrz niżej), aby nie mieszać UI aplikacji z UI auth.

#### 1.2.2 Strony aplikacyjne (istniejące) — tryb non-auth vs auth

Istniejące strony (np. `/plants`, `/calendar`) są funkcjonalnie „aplikacją” i powinny być traktowane jako **chronione** (wymagają zalogowania), ponieważ:

- ich API (`/api/plants`, `/api/calendar/...`) zwraca 401 przy braku sesji,
- dane są per-user (DB ma `user_id`).

**Zasada UX**:

- jeśli user nie jest zalogowany i wejdzie na chronioną stronę UI → redirect do `/auth/login?next=<ścieżka>`,
- jeśli user jest zalogowany i wejdzie na `/auth/*` → redirect do `next` albo `/plants` (lub innej strony startowej).

### 1.3 Layouty i komponenty nawigacyjne

#### 1.3.1 `src/layouts/Layout.astro` (rozszerzenie)

Rozszerzamy główny layout o:

- **Top bar (header)** z akcjami:
  - w stanie niezalogowanym: przycisk „Zaloguj się” (+ opcjonalnie „Załóż konto”),
  - w stanie zalogowanym: identyfikacja użytkownika (email/nickname) + przycisk „Wyloguj”.
- (Opcjonalnie) podstawową nawigację do `/plants` i `/calendar` — tylko w stanie zalogowanym.

Źródło prawdy o stanie auth w layoucie:

- `Layout.astro` pobiera usera server-side przez `Astro.locals.supabase.auth.getUser()` (bez ładowania React).

Wylogowanie:

- preferowany UX bez-JS: `<form method="POST" action="/api/auth/sign-out">` z przyciskiem shadcn/ui,
- alternatywnie: przycisk React i `fetch('/api/auth/sign-out', { method: 'POST' })` (wtedy potrzebny wspólny handler błędów/CSRF).

#### 1.3.2 `src/layouts/AuthLayout.astro` (nowy)

Cel: spójny wygląd stron auth i izolacja od UI aplikacji.

Zawartość:

- prosta struktura „centered card” (shadcn/ui `Card`) + linki pomocnicze:
  - z loginu → rejestracja / reset hasła,
  - z rejestracji → login,
  - z forgot-password → login.

#### 1.3.3 Komponenty UI (nowe)

Minimalny zestaw (shadcn/ui + Tailwind):

- `src/components/auth/AuthCard.astro` lub `src/components/auth/AuthCard.tsx`
  - wrapper na nagłówek + opis + slot na formularz,
- `src/components/auth/AuthErrorAlert.tsx`
  - wspólny komponent do prezentacji błędów globalnych (np. 401/422/500),
- `src/components/auth/AuthLinks.tsx`
  - zestaw linków kontekstowych.

### 1.4 Rozdzielenie odpowiedzialności: Astro vs React

#### 1.4.1 Strony Astro (routing, SSR, redirecty, SEO)

Odpowiedzialności stron Astro (`src/pages/auth/*.astro`):

- SSR guard:
  - jeśli user już zalogowany → redirect do `next` albo `/plants`,
  - jeśli brak sesji → render strony auth.
- Obsługa `next` z query string i przekazanie go do formularza React.
- Ustawienie `<title>` i podstawowych metatagów.
- Brak logiki walidacji formularzy (ta jest w React + backend).

#### 1.4.2 Formularze React (interakcja, walidacja client-side, UX błędów)

Formularze React są odpowiedzialne za:

- stan pól, disabled/loading,
- walidację client-side (szybka, UX-owa) + wyświetlanie błędów per pole,
- wywołania do backendu `/api/auth/*`,
- nawigację po sukcesie (redirect do `next` albo domyślnego ekranu).

Proponowane komponenty:

- `src/components/auth/SignInForm.tsx` (client-side)
- `src/components/auth/SignUpForm.tsx` (client-side)
- `src/components/auth/ForgotPasswordForm.tsx` (client-side)
- `src/components/auth/ResetPasswordForm.tsx` (client-side)

Strony `.astro` używają ich w stylu jak istniejące widoki roślin:

- `<SignInForm next={next} client:load />` (lub `client:idle`, zależnie od preferencji).

### 1.5 Walidacja i komunikaty błędów (UI)

#### 1.5.1 Walidacja client-side (natychmiastowa)

**Login**

- email: trim, format email
- hasło: min. długość (np. 8), brak ujawniania szczegółów

**Rejestracja**

- email: jak wyżej
- hasło: min. długość + strength heurystyka (opcjonalnie)
- potwierdzenie hasła: musi się zgadzać
- timezone: **nie jest wymagane jako pole UI** w US-008; jeśli jest potrzebne w DB (US-020), UI powinno je wykryć automatycznie (np. z przeglądarki) i wysłać jako pole ukryte; backend musi mieć bezpieczny fallback (np. `UTC`).
- nickname (pseudonim): opcjonalny, długość 1..60 (US-020; nie wymagany przez kryteria akceptacji US-008).

**Forgot password**

- email: format email

**Reset password**

- nowe hasło: jak przy rejestracji
- potwierdzenie: musi się zgadzać

#### 1.5.2 Mapowanie błędów backend → UI

UI nie powinno pokazywać surowych komunikatów Supabase. Standard:

- backend zwraca `{ error: { code, message } }` w envelope,
- UI mapuje `code` na treść i zachowanie.

Przykładowe kody i UX:

- `VALIDATION_ERROR` / `INVALID_QUERY_PARAMS` / `INVALID_JSON`
  - komunikaty per pole (gdy backend zwraca `details.issues`) + globalnie „Popraw błędy w formularzu”.
- `UNAUTHENTICATED`
  - na stronach auth: „Sesja wygasła — zaloguj się ponownie”
  - na stronach aplikacyjnych: redirect do `/auth/login?next=...` (centralny handler).
- `EMAIL_ALREADY_REGISTERED` (projektowy kod, mapowany z Supabase)
  - „Konto z tym adresem już istnieje. Zaloguj się lub użyj resetu hasła.”
- `INVALID_CREDENTIALS`
  - „Nieprawidłowy e-mail lub hasło.”
- `PASSWORD_TOO_WEAK`
  - „Hasło jest zbyt słabe (min. X znaków, użyj cyfr/znaków specjalnych).”
- `RATE_LIMITED`
  - „Zbyt wiele prób — spróbuj ponownie później.”
- `INTERNAL_SERVER_ERROR`
  - „Coś poszło nie tak. Spróbuj ponownie.”

### 1.6 Najważniejsze scenariusze (UI)

#### 1.6.1 Rejestracja (happy path)

1. Użytkownik wchodzi na `/auth/register`.
2. Uzupełnia formularz.
3. React wysyła `POST /api/auth/sign-up`.
4. Po sukcesie:
   - jeśli Supabase ma email confirmation = OFF → użytkownik jest zalogowany (cookies ustawione) i następuje redirect do `next` lub `/plants`,
   - jeśli confirmation = ON → UI pokazuje ekran „Sprawdź email” i nie zakłada zalogowania (sesja może być pusta).

#### 1.6.2 Logowanie

1. Użytkownik wchodzi na `/auth/login?next=/plants`.
2. Wysyła `POST /api/auth/sign-in`.
3. Po 200/204 UI robi `window.location.assign(next)` (pełny reload preferowany, aby SSR layout widział sesję natychmiast).

#### 1.6.3 Wylogowanie

- Z poziomu top bara w `Layout.astro` → `POST /api/auth/sign-out`.
- Po sukcesie redirect do `/` lub `/auth/login`.

#### 1.6.4 Reset hasła (email)

1. `/auth/forgot-password` → `POST /api/auth/forgot-password`.
2. UI zawsze pokazuje neutralny komunikat „Jeśli konto istnieje, wysłaliśmy email” (ochrona przed enumeracją).
3. User klika link w emailu → trafia do `/auth/callback?code=...&next=/auth/reset-password`.
4. SSR callback wymienia `code` na sesję (cookies).
5. User trafia na `/auth/reset-password` i ustawia nowe hasło → `POST /api/auth/update-password`.

#### 1.6.5 Wejście na stronę aplikacyjną bez sesji

- Middleware albo SSR strony robi redirect do login.
- Dodatkowo (warstwa React) — jeśli API zwróci 401 w trakcie pracy, komponenty pokazują CTA „Zaloguj się” i/lub automatycznie przekierowują (spójne z US-022).

---

## 2. LOGIKA BACKENDOWA

### 2.1 Struktura endpointów API (nowe)

Wszystkie endpointy: `export const prerender = false`, envelope `{data, error, meta}` i `Cache-Control: no-store`.

#### 2.1.1 Auth: sesja i konto

- `POST /api/auth/sign-up`
  - request: `SignUpCommand` (`src/types.ts`)
  - response (proponowane): `SignUpResultDto` (user summary + profile)
  - efekt uboczny: utworzenie usera w Supabase Auth + utworzenie/aktualizacja `public.profiles`

- `POST /api/auth/sign-in`
  - request: `SignInCommand`
  - response (proponowane): `MeResponseDto` (zamiast tokenów w JS)
  - efekt uboczny: ustawienie cookies sesji przez Supabase (`HttpOnly`)

- `POST /api/auth/sign-out`
  - response: `{ data: { signed_out: true } }` lub 204
  - efekt uboczny: wyczyszczenie cookies sesji

- `GET /api/auth/me`
  - response: `MeResponseDto`
  - 401 gdy brak sesji
  - używane przez React do inicjalizacji / odświeżenia stanu użytkownika (opcjonalne, ale przydatne pod user menu bez pełnego SSR)

#### 2.1.2 Profil (US-020)

Aby US-020 było wykonalne, potrzebujemy prostego API do odczytu/zapisu `public.profiles` (pseudonim + strefa czasowa). Propozycja:

- `GET /api/profile/me`
  - response: `{ data: { nickname: string | null, timezone: string } }`
  - 401 gdy brak sesji
- `PATCH /api/profile/me`
  - request: `{ nickname?: string | null, timezone?: string }`
  - response: `{ data: { nickname: string | null, timezone: string } }`
  - 401 gdy brak sesji

Uwagi:
- UI ustawień profilu (strona/komponent) jest poza US-008, ale endpointy powyżej są minimalnym kontraktem wymaganym przez PRD.

#### 2.1.3 Odzyskiwanie hasła

- `POST /api/auth/forgot-password`
  - request: `{ email: string }`
  - response: `{ data: { ok: true } }` zawsze 200 (anti-enumeration)
  - efekt: `supabase.auth.resetPasswordForEmail(email, { redirectTo })`

- `POST /api/auth/update-password`
  - request: `{ password: string }`
  - wymaga zalogowanej sesji recovery (po `/auth/callback`)
  - response: `{ data: { ok: true } }`

#### 2.1.4 Callback SSR (strona)

- `/auth/callback` (strona Astro, nie `/api`)
  - query: `?code=...&next=...`
  - logika SSR:
    - waliduje `next` (tylko ścieżki lokalne),
    - `locals.supabase.auth.exchangeCodeForSession(code)` (ustawia cookies),
    - redirect do `next` (domyślnie `/plants` lub `/auth/reset-password` zależnie od typu flow).

#### 2.1.5 Usunięcie konta (US-009)

PRD wymaga trwałego usunięcia konta i danych „natychmiast” oraz podwójnego potwierdzenia. W Supabase oznacza to, że operacja musi być wykonana **z uprawnieniami admin/service role** (nie da się bezpiecznie usunąć `auth.users` z uprawnień zwykłej sesji).

Propozycja kontraktu:

- `POST /api/account/delete`
  - request: `{ password: string, confirm: true }`
  - response: `{ data: { deleted: true } }`
  - zachowanie:
    - weryfikuje hasło (np. próbą `signInWithPassword` na anon kluczu, bez ustawiania cookies),
    - usuwa użytkownika przez admin API,
    - czyści cookies sesji (defensywnie) i kończy flow.

Wymagania DB dla „natychmiastowego” usuwania danych:
- tabele aplikacyjne z `user_id` muszą usuwać się kaskadowo po usunięciu `auth.users` (FK `ON DELETE CASCADE` lub równoważny mechanizm),
- ewentualne pliki (np. zdjęcia roślin) wymagają osobnej strategii sprzątania (np. trigger/worker).

### 2.2 Modele danych i kontrakty

#### 2.2.1 Profile (`public.profiles`)

- `profiles` jest 1:1 z `auth.users` i zawiera pola aplikacyjne:
  - `nickname` (opcjonalny),
  - `timezone` (wymagane).

Strategia tworzenia profilu:

- rekomendowane: trigger w DB tworzący rekord profilu przy nowym `auth.users` (do opisania w osobnej specyfikacji DB),
- niezależnie od triggera endpoint `sign-up` powinien:
  - po `signUp` wykonać upsert do `profiles` z przekazaną `timezone`/`nickname` (lub fallbackami),
  - być idempotentny (powtórka requestu nie tworzy duplikatu),
  - zapewniać wartość `timezone` nawet gdy klient jej nie poda (np. domyślnie `UTC`).

#### 2.2.2 Session: cookies zamiast tokenów w JS

Kontrakt bezpieczeństwa:

- sesja przeglądarki jest utrzymywana w **HttpOnly cookies** (Supabase),
- frontend React nie przechowuje access/refresh tokenów w `localStorage`,
- istniejący mechanizm `Authorization: Bearer ...` pozostaje wspierany w API (kompatybilność), ale nie jest wymagany dla UI web.

### 2.3 Walidacja danych wejściowych (backend)

Zasada: **Zod w `src/lib/api/auth/*`**, analogicznie do `src/lib/api/plants/*`.

Proponowane pliki:

- `src/lib/api/auth/sign-in-request.ts`
  - schema: `{ email, password }` (trim, email, min/max)
- `src/lib/api/auth/sign-up-request.ts`
  - schema: `{ email, password, timezone?, nickname? }`
  - dodatkowo: sanityzacja `nickname` (puste → null)
  - dodatkowo: fallback `timezone` (gdy brak/nieprawidłowe) → `UTC` lub inna bezpieczna wartość
- `src/lib/api/auth/forgot-password-request.ts`
  - schema: `{ email }`
- `src/lib/api/auth/update-password-request.ts`
  - schema: `{ password }` + polityka siły hasła

Błędy walidacji:

- 400 dla `INVALID_JSON`,
- 422 dla `VALIDATION_ERROR` (rekomendowane, spójnie z `parseUpdatePlantRequest`),
- `details.issues` (format jak w `update-plant-request.ts`) aby UI mogło mapować błędy per pole.

### 2.4 Obsługa wyjątków i spójne odpowiedzi

W każdym endpointzie `/api/auth/*`:

- `try/catch`
- jeśli `isHttpError(error)`:
  - zwróć `json(error.status, { data: null, error: { code, message }, meta: {} })`
- inaczej:
  - `console.error('Unhandled error in ...', { error })`
  - zwróć 500 z `INTERNAL_SERVER_ERROR`

Uzupełnienie (opcjonalne, ale zalecane):

- w `meta` dodawać `request_id` (UUID) dla debugowania (spójnie z klientami, które już potrafią czytać `requestId` z meta).

### 2.5 Aktualizacja renderowania server-side (Astro) z uwzględnieniem `astro.config.mjs`

Ponieważ aplikacja jest SSR (`output: "server"`), renderowanie server-side może i powinno:

- czytać sesję z cookies i renderować top bar w `Layout.astro` odpowiednio do stanu zalogowania,
- wykonywać redirecty w stronach auth i stronach chronionych,
- nie używać `supabaseClient` z `src/db/supabase.client.ts` w routach Astro — tylko `Astro.locals.supabase` (zgodnie z regułami repo).

Nie są wymagane zmiany w `astro.config.mjs` dla samego auth.

---

## 3. SYSTEM AUTENTYKACJI (Supabase Auth + Astro)

### 3.1 Wariant: Supabase Auth + sesja w cookies (rekomendowany)

**Dlaczego**: jest najprostszy i najbezpieczniejszy dla web (HttpOnly), a istniejący kod API już wspiera odczyt usera z cookies.

Elementy:

- Middleware (`src/middleware/index.ts`) utrzymuje `locals.supabase` z cookie storage.
- Endpointy auth wykonują operacje `locals.supabase.auth.*`, a Supabase ustawia/usuwa cookies.

### 3.2 Rozszerzenie middleware: locals.user i ochrona tras (opcjonalne, ale docelowe)

Proponowane rozszerzenia do `src/middleware/index.ts` (na poziomie architektury):

- `context.locals.user` (Supabase user) i/lub `context.locals.userId`
  - ustawiane przez `await supabase.auth.getUser()` (z cookies)
- `context.locals.profile` (z tabeli `public.profiles`) — tylko jeśli potrzebne globalnie

Ochrona tras UI:

- jeśli `pathname` pasuje do chronionych:
  - `/plants`, `/calendar` oraz ewentualnie `/settings`, `/account/*`
- i brak `user`:
  - redirect do `/auth/login?next=<oryginalny path + query>`

Wyjątki (zawsze publiczne):

- `/` (landing),
- `/auth/*`,
- `/api/*` (API ma własne 401; nie robimy redirectów HTML).

### 3.3 Rejestracja (Supabase)

Operacja:

- `supabase.auth.signUp({ email, password, options })`

Ustalenia architektoniczne:

- `options.data` może przechowywać część metadanych (np. `timezone`), ale źródłem prawdy dla aplikacji jest `public.profiles`.
- Po `signUp`:
  - upsert `profiles` (`user_id`, `timezone`, `nickname`).
  - jeśli klient nie poda `timezone`, backend stosuje fallback (np. `UTC`), żeby spełnić wymagania US-020 bez rozszerzania kryteriów akceptacji US-008 o dodatkowe pole formularza.

Email confirmation:

- decyzja produktowa (MVP):
  - jeśli OFF: natychmiastowa sesja po rejestracji,
  - jeśli ON: UI „Sprawdź email”, a login dopiero po potwierdzeniu.

### 3.4 Logowanie (Supabase)

Operacja:

- `supabase.auth.signInWithPassword({ email, password })`

Kontrakt:

- sesja jest utrzymywana w cookies,
- endpoint zwraca minimalne dane (np. `MeResponseDto`) do natychmiastowego UI feedback.

### 3.5 Wylogowanie (Supabase)

Operacja:

- `supabase.auth.signOut()`

Efekt:

- usunięcie cookies sesyjnych,
- redirect do `/` albo `/auth/login`.

### 3.6 Odzyskiwanie hasła (Supabase)

#### 3.6.1 Żądanie resetu hasła

Operacja:

- `supabase.auth.resetPasswordForEmail(email, { redirectTo })`

`redirectTo`:

- budowane na bazie `import.meta.env.APP_BASE_URL` (jest już zdefiniowane w `src/env.d.ts`),
- fallback: `new URL(request.url).origin` (dla środowisk bez `APP_BASE_URL`).

Przykładowa ścieżka redirect:

- `${APP_BASE_URL}/auth/callback?next=/auth/reset-password`

#### 3.6.2 Finalizacja sesji po linku z emaila

W `/auth/callback`:

- `exchangeCodeForSession(code)` ustawia cookies,
- następuje redirect do `next`.

#### 3.6.3 Ustawienie nowego hasła

Operacja:

- `supabase.auth.updateUser({ password: newPassword })`

Wymagania bezpieczeństwa:

- endpoint wymaga aktywnej sesji (recovery),
- po zmianie hasła opcjonalnie można:
  - utrzymać użytkownika zalogowanego,
  - lub wymusić ponowne logowanie (decyzja UX).

### 3.7 Bezpieczeństwo (minimum dla MVP)

#### 3.7.1 CSRF

Ponieważ sesja jest w cookies, endpointy mutujące są potencjalnie wrażliwe na CSRF. Minimalny zestaw zabezpieczeń:

- `SameSite=Lax`/`Strict` dla cookies ustawianych przez Supabase (ustawienia Supabase),
- w endpointach `POST`:
  - weryfikacja `Origin` oraz `Host` (tylko żądania z własnej domeny),
  - dla wrażliwych operacji (`update-password`, `sign-out`) opcjonalnie podwójny token (double-submit cookie) w kolejnej iteracji.

#### 3.7.2 Anti-enumeration dla resetu hasła

- `POST /api/auth/forgot-password` zawsze zwraca 200 i neutralny komunikat w UI.

#### 3.7.3 Logowanie błędów

- nigdy nie logować hasła ani pełnego emaila w logach serwera,
- logować jedynie kody błędów i `request_id`.

---

## 4. Kontrakty na poziomie modułów (co gdzie będzie)

### 4.1 Frontend: pliki/komponenty

- `src/layouts/Layout.astro` — rozszerzony top bar + stan auth w SSR
- `src/layouts/AuthLayout.astro` — nowy layout dla `/auth/*`
- `src/pages/auth/login.astro`
- `src/pages/auth/register.astro`
- `src/pages/auth/forgot-password.astro`
- `src/pages/auth/reset-password.astro`
- `src/pages/auth/callback.astro`
- `src/components/auth/SignInForm.tsx`
- `src/components/auth/SignUpForm.tsx`
- `src/components/auth/ForgotPasswordForm.tsx`
- `src/components/auth/ResetPasswordForm.tsx`
- `src/components/auth/AuthErrorAlert.tsx`
- (US-020) `src/pages/settings/profile.astro` lub `src/pages/account/profile.astro` + komponent React do edycji profilu (pseudonim/strefa czasowa)
- (US-009) `src/pages/account/delete.astro` (lub w ustawieniach) + UI z podwójnym potwierdzeniem

### 4.2 Backend/API: pliki/endpointy

- `src/pages/api/auth/sign-in.ts`
- `src/pages/api/auth/sign-up.ts`
- `src/pages/api/auth/sign-out.ts`
- `src/pages/api/auth/me.ts`
- `src/pages/api/auth/forgot-password.ts`
- `src/pages/api/auth/update-password.ts`
- (US-020) `src/pages/api/profile/me.ts` (GET/PATCH)
- (US-009) `src/pages/api/account/delete.ts`

### 4.3 Parsowanie/walidacja (Zod)

- `src/lib/api/auth/sign-in-request.ts`
- `src/lib/api/auth/sign-up-request.ts`
- `src/lib/api/auth/forgot-password-request.ts`
- `src/lib/api/auth/update-password-request.ts`

### 4.4 Serwisy (logika domenowa)

- `src/lib/services/auth/sign-in.ts`
- `src/lib/services/auth/sign-up.ts`
- `src/lib/services/auth/sign-out.ts`
- `src/lib/services/auth/get-me.ts`
- `src/lib/services/auth/request-password-reset.ts`
- `src/lib/services/auth/update-password.ts`

Wszystkie serwisy przyjmują `SupabaseClient` (z `Astro.locals.supabase`) jako parametr — jak reszta serwisów w repo.

---

## 5. Spójność z istniejącym działaniem aplikacji (ważne)

- Nie zmieniamy kontraktów istniejących endpointów (plants/calendar/watering).
- `requireUserId` i mechanizm 401 pozostają spójne — auth jedynie dostarcza sesję w cookies.
- UI roślin/kalendarza nadal działa tak jak teraz, ale po dodaniu guardów:
  - użytkownik niezalogowany nie będzie „widzieć błędów 401”, tylko zostanie przekierowany do logowania.

---

## 6. Otwarte decyzje (do potwierdzenia przed implementacją)

- Czy w Supabase włączamy **email confirmation** dla rejestracji? (UX i bezpieczeństwo vs prostota MVP)
- Domyślna strona po zalogowaniu: `/plants` czy `/calendar`?
- Czy `POST /api/auth/sign-in` ma zwracać `MeResponseDto` (rekomendowane) czy istniejący `SignInResultDto` z tokenami?
- Czy wdrażamy minimalny `Origin` check od razu jako ochrona CSRF w endpointach auth?
- Czy `timezone` ma być zawsze wykrywane po stronie klienta i zapisywane już przy rejestracji (ukryte pole), czy dopiero wymagane/edytowalne w ustawieniach profilu (US-020)?
- Jak realizujemy US-009 technicznie w środowisku Astro SSR: endpoint serverowy z `SUPABASE_SERVICE_ROLE_KEY` vs zewnętrzna funkcja (np. Supabase Edge Function)?

