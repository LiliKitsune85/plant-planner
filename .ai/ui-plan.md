## Architektura UI dla Plant Planner

### 1. Przegląd struktury UI

Plant Planner (MVP) to responsywna aplikacja webowa skoncentrowana na szybkim „odhaczaniu” podlewań w **Kalendarzu**, z prostą ścieżką dodawania rośliny i ustawiania planu (AI lub ręcznie). Architektura UI opiera się o:

- **Stałą nawigację**: Kalendarz (domyślnie) → Rośliny → Ustawienia + globalne CTA „Dodaj roślinę” (desktop i mobile; mobile: dolna nawigacja).
- **Read-modele kalendarza**: widok miesiąca (liczby zadań/dzień) i widok dnia (lista zadań) jako podstawowe ekrany pracy.
- **Dwufazowy flow dodawania**: tworzenie rośliny (`POST /api/plants`) → sugerowanie planu AI (w ramach odpowiedzi lub retry `POST /api/plants/{id}/watering-plan/suggest`) → zapis planu (`PUT /api/plants/{id}/watering-plan`) → przekierowanie do dnia w kalendarzu.
- **Standard obsługi stanów**: skeleton/loading, puste stany z CTA, toasty, inline errors (walidacja 422), pełnoekranowe stany dla AI (timeout/rate-limit/provider error), globalny komunikat „Brak połączenia”.
- **Bezpieczeństwo i sesje**: ochrona widoków zalogowanych (middleware), spójna obsługa `401` (komunikat + przekierowanie do logowania), wymagane potwierdzenia akcji destrukcyjnych (delete plant/task/account).

### 2. Lista widoków

Poniżej: komplet widoków wymaganych przez PRD + plan API + notatki. W nawiasach podane są kluczowe endpointy API.

#### 2.1 Widoki publiczne (Auth)

- **Logowanie**
  - **Ścieżka widoku**: `/auth/login`
  - **Główny cel**: wejście do aplikacji (Supabase Auth), obsługa błędów logowania i niepotwierdzonego e-maila.
  - **Kluczowe informacje**: formularz e-mail/hasło; link do rejestracji; komunikaty błędów.
  - **Kluczowe komponenty widoku**:
    - Formularz logowania (email, hasło)
    - Inline error dla `401 AUTH_INVALID_CREDENTIALS`
    - Banner/CTA dla `403 AUTH_EMAIL_NOT_CONFIRMED` → przejście do „Sprawdź skrzynkę”
  - **UX, dostępność i bezpieczeństwo**:
    - Etykiety pól, obsługa klawiatury, widoczny focus, poprawne atrybuty `autocomplete`
    - Ochrona przed double-submit (blokada przycisku podczas submit)
    - Po sukcesie: redirect do `/calendar`

- **Rejestracja**
  - **Ścieżka widoku**: `/auth/register`
  - **Główny cel**: założenie konta (email/hasło) + opcjonalnie nickname/timezone.
  - **Kluczowe informacje**: wymagania hasła; informacje o potwierdzeniu e-mail.
  - **Kluczowe komponenty widoku**:
    - Formularz rejestracji: email, hasło, (opcjonalnie) nickname, timezone
    - Inline walidacja podstawowa (zanim trafi do backendu), plus mapowanie błędów z backendu
  - **UX, dostępność i bezpieczeństwo**:
    - Jasne komunikaty dot. wymagań hasła i procesu potwierdzenia e-mail
    - Po sukcesie: redirect do `/auth/check-email`

- **Sprawdź skrzynkę (potwierdzenie e-mail)**
  - **Ścieżka widoku**: `/auth/check-email`
  - **Główny cel**: poinformowanie o konieczności potwierdzenia e-mail + droga powrotu do logowania.
  - **Kluczowe informacje**: instrukcja, co zrobić jeśli mail nie doszedł; przycisk „Mam już potwierdzone → Zaloguj”.
  - **Kluczowe komponenty widoku**: komunikat + CTA do `/auth/login`
  - **UX, dostępność i bezpieczeństwo**: prosty ekran, czytelne nagłówki i instrukcje; brak wrażliwych danych.

#### 2.2 Shell aplikacji (dla zalogowanych)

- **App Shell / Layout**
  - **Ścieżka widoku**: dotyczy wszystkich tras prywatnych (np. `/calendar`, `/plants`, `/settings`)
  - **Główny cel**: spójne ramy UI + nawigacja + globalne CTA „Dodaj roślinę”.
  - **Kluczowe informacje**: aktywna sekcja, licznik/stan sesji (opcjonalnie), feedback stanu sieci.
  - **Kluczowe komponenty widoku**:
    - Nawigacja: desktop (sidebar/topbar) i mobile (bottom nav)
    - Globalne CTA: „Dodaj roślinę” → `/plants/new`
    - Globalny system toastów/alertów + „Brak połączenia”
  - **UX, dostępność i bezpieczeństwo**:
    - Widoczny focus i prawidłowa kolejność tabulacji między elementami stałymi a treścią
    - Przechwytywanie `401` w adapterze API: komunikat + redirect do `/auth/login` (z zachowaniem `returnTo`)

#### 2.3 Kalendarz (core workflow)

- **Kalendarz — miesiąc**
  - **Ścieżka widoku**: `/calendar` oraz `/calendar/:yyyy-mm`
  - **Główny cel**: przegląd dni z podlewaniami + szybka nawigacja do dnia.
  - **Kluczowe informacje do wyświetlenia**:
    - Siatka miesiąca
    - Dni z liczbą zaplanowanych podlewań (domyślnie: pending)
    - Skrót „Dziś”
  - **Kluczowe komponenty widoku**:
    - MonthPicker (zmiana miesiąca)
    - Kafel dnia z badge `count`
    - Puste stany: „Brak zadań w tym miesiącu” + CTA „Dodaj roślinę”
  - **UX, dostępność i bezpieczeństwo**:
    - Kafelki dni jako prawdziwe elementy interaktywne (button/link), aria-label z datą i liczbą zadań
    - Strefa czasowa: interpretacja `YYYY-MM` i `date` wg timezone profilu (z fallbackiem do timezone przeglądarki)
  - **Zależne API**: `GET /api/calendar/month?month=YYYY-MM&status=pending|completed|all`

- **Kalendarz — dzień**
  - **Ścieżka widoku**: `/calendar/day/:yyyy-mm-dd`
  - **Główny cel**: wykonanie pracy „tu i teraz” — lista zadań, potwierdzenie/undo, edycja wpisu, usuwanie, dodanie adhoc.
  - **Kluczowe informacje do wyświetlenia**:
    - Data (nagłówek) + skrót „Dziś”
    - Segment statusu: „Do zrobienia / Wykonane / Wszystkie”
    - Lista pozycji: roślina (display_name + nickname), status, źródło (scheduled vs adhoc), notatka
  - **Kluczowe komponenty widoku**:
    - SegmentedControl `status`
    - `WateringTaskRow` z dużymi akcjami: „Potwierdź” / „Cofnij”
    - `EditWateringEntryDialog` (status, `completed_on`, notatka)
    - `ConfirmDeleteDialog` (różna treść dla adhoc vs zaplanowane)
    - CTA „Dodaj wpis adhoc” (PlantPicker + data = bieżący dzień)
  - **UX, dostępność i bezpieczeństwo**:
    - Optymistyczne aktualizacje dla „Potwierdź/Cofnij” + rollback na błąd
    - Standard mutacji: blokada przycisków podczas requestu (anti double-submit)
    - Obsługa konfliktów `409`: komunikat „Na ten dzień istnieje już wpis podlewania” + link do wyróżnienia rośliny na liście dnia
  - **Zależne API**:
    - `GET /api/calendar/day?date=YYYY-MM-DD&status=pending|completed|all`
    - `PATCH /api/watering-tasks/{taskId}` (complete/undo/edit)
    - `POST /api/plants/{plantId}/watering/adhoc`
    - `DELETE /api/watering-tasks/{taskId}?confirm=true` (jeśli przewidziane w MVP)

#### 2.4 Rośliny (zarządzanie kolekcją)

- **Lista roślin**
  - **Ścieżka widoku**: `/plants`
  - **Główny cel**: znaleźć roślinę (q + sort) i wejść w szczegóły; wejście do dodawania.
  - **Kluczowe informacje do wyświetlenia**:
    - Lista `display_name` (główna nazwa) + (opcjonalnie) nickname
    - Mini-meta: data dodania/ostatniej aktualizacji (opcjonalnie)
  - **Kluczowe komponenty widoku**:
    - SearchInput (debounce 300–500 ms) → `q`
    - SortSelect (np. created_at/species_name/updated_at)
    - `PlantListItem` (z miniaturą jeśli `photo_path`)
    - Paginacja „Załaduj więcej” (cursor)
  - **UX, dostępność i bezpieczeństwo**:
    - Wyraźne stany: loading, empty („Brak roślin” + CTA „Dodaj roślinę”), error z retry
    - Dostępność listy: semantyczna lista, czytelne hit-areas na mobile
  - **Zależne API**: `GET /api/plants?q=&sort=&order=&limit=&cursor=`

- **Dodaj roślinę (formularz)**
  - **Ścieżka widoku**: `/plants/new`
  - **Główny cel**: utworzyć roślinę minimalnie (wymagana nazwa gatunku) + opcjonalne pola + przełącznik „Generuj plan AI”.
  - **Kluczowe informacje do wyświetlenia**:
    - Pole wymagane: `species_name`
    - Pola opcjonalne: nickname, opis, data zakupu, (opcjonalnie photo później)
    - Przełącznik „Generuj plan AI” (domyślnie ON) + kontekstowa informacja o limicie przed pierwszym użyciem
  - **Kluczowe komponenty widoku**:
    - Formularz rośliny (walidacja długości i wymaganych pól)
    - Toggle „Generuj plan AI”
    - Submit → tworzy roślinę i przechodzi do widoku sugerowania
  - **UX, dostępność i bezpieczeństwo**:
    - Inline błędy 422 z mapowaniem `details.field`
    - Jeżeli AI jest rate-limited: przełącznik automatycznie OFF + komunikat o `unlock_at` + możliwość kontynuacji bez AI
  - **Zależne API**: `POST /api/plants` (z `generate_watering_suggestion`)

- **Sugerowanie planu / Proponowany plan (AI + fallback)**
  - **Ścieżka widoku**: `/plants/:plantId/watering-plan`
  - **Główny cel**: pokazać sugestię AI (albo powód braku) i doprowadzić do zapisu planu (akceptuj/edytuj/odrzuć).
  - **Kluczowe informacje do wyświetlenia**:
    - Sugestia: `interval_days` + krótka `explanation` (prezentowana, ale nie zapisywana)
    - Status: `available | rate_limited | timeout | provider_error | skipped`
    - Jeśli `rate_limited`: `unlock_at`
  - **Kluczowe komponenty widoku**:
    - FullScreenState „Sugerowanie planu…” (budżet 5s)
    - Karta propozycji planu
    - Akcje:
      - „Akceptuj” → `PUT /watering-plan` z `source.type="ai"` i `accepted_without_changes=true`
      - „Edytuj i zapisz” → przejście do edytora planu (z prefill)
      - „Odrzuć i ustaw ręcznie” → edytor planu (bez źródła AI)
    - CTA „Spróbuj ponownie” (retry): `POST /api/plants/{plantId}/watering-plan/suggest`
  - **UX, dostępność i bezpieczeństwo**:
    - Scenariusze błędów AI:
      - `408 AI_TIMEOUT`: komunikat + CTA „Spróbuj ponownie” i „Ustaw ręcznie”
      - `502 AI_PROVIDER_ERROR`: komunikat + analogiczne CTA
      - `429 AI_RATE_LIMITED`: komunikat z `unlock_at` + CTA „Ustaw ręcznie” (oraz opcjonalnie „Wróć do rośliny”)
    - Przyciski blokowane podczas zapisu; czytelne alerty i możliwość kontynuacji
  - **Zależne API**:
    - `POST /api/plants` (jeśli sugestia w odpowiedzi)
    - `POST /api/plants/{plantId}/watering-plan/suggest` (retry)
    - `PUT /api/plants/{plantId}/watering-plan` (zapis)

- **Edytor planu podlewania (minimalny w MVP)**
  - **Ścieżka widoku**: jako pod-widok w `/plants/:plantId/watering-plan` albo osobno `/plants/:plantId/watering-plan/edit`
  - **Główny cel**: ustawić plan w minimum: `interval_days` + data startu („od dziś” vs „wybierz datę”), reszta ukryta jako zaawansowane z domyślnymi wartościami.
  - **Kluczowe informacje do wyświetlenia**:
    - Interwał w dniach (1..365)
    - Start: `today` vs `custom_date` (+ `custom_start_on`)
    - (Ukryte/zaawansowane): horizon_days (domyślnie 90), schedule_basis, overdue_policy (domyślne)
  - **Kluczowe komponenty widoku**:
    - PlanForm (interval input + radio start + datepicker)
    - Sekcja „Zaawansowane” (zwijana)
    - Zapis → `PUT /watering-plan` z `source.type="ai"| "manual"` + `accepted_without_changes` wg akcji
  - **UX, dostępność i bezpieczeństwo**:
    - Walidacja inline + komunikaty 422
    - Strefa czasowa i formaty dat: spójnie `YYYY-MM-DD`
  - **Zależne API**: `PUT /api/plants/{plantId}/watering-plan`

- **Szczegóły rośliny**
  - **Ścieżka widoku**: `/plants/:plantId`
  - **Główny cel**: zobaczyć roślinę i jej aktywny plan; wykonać akcje: „Zobacz w kalendarzu”, „Zmień plan”, „Podlej dzisiaj” (adhoc), edycja danych, zdjęcie, usunięcie.
  - **Kluczowe informacje do wyświetlenia**:
    - `display_name` (główna), `nickname` (przydomek)
    - Aktywny plan (jeśli istnieje) lub stan „Brak planu”
    - Zdjęcie (jeśli jest)
  - **Kluczowe komponenty widoku**:
    - Sekcja planu:
      - Jeśli jest plan: podsumowanie + CTA „Zmień plan”
      - Jeśli brak planu: CTA „Wygeneruj AI” / „Ustaw ręcznie”
    - CTA „Zobacz w kalendarzu” (deep link do dnia: dziś lub najbliższe zadanie)
    - CTA „Podlej dzisiaj” → `POST /watering/adhoc`
    - Akcje: Edytuj dane, Dodaj/Zmień zdjęcie, Usuń roślinę
  - **UX, dostępność i bezpieczeństwo**:
    - Duplikaty: wyjaśnienie, że `display_name` może zawierać numer (#1, #2…), a `species_name` jest niezmienne
    - Usuwanie zawsze z osobnym potwierdzeniem
  - **Zależne API**: `GET /api/plants/{plantId}`, `POST /api/plants/{plantId}/watering/adhoc`

- **Edycja danych rośliny**
  - **Ścieżka widoku**: `/plants/:plantId/edit`
  - **Główny cel**: edytować tylko pola opcjonalne (nickname, opis, data zakupu, photo_path), bez zmiany `species_name`.
  - **Kluczowe informacje do wyświetlenia**:
    - Zablokowane pole `species_name` (read-only) + wyjaśnienie „nie można zmienić w MVP”
    - Formularz pól opcjonalnych
  - **Kluczowe komponenty widoku**:
    - PlantEditForm
    - CTA „Zapisz zmiany”
  - **UX, dostępność i bezpieczeństwo**:
    - Obsługa `409 IMMUTABLE_FIELD` (gdyby klient mimo wszystko wysłał zmianę) jako czytelny błąd
    - Toast „Zapisano” po sukcesie
  - **Zależne API**: `PATCH /api/plants/{plantId}`

- **Zdjęcie rośliny (upload)**
  - **Ścieżka widoku**: jako część `/plants/:plantId` albo `/plants/:plantId/photo`
  - **Główny cel**: wgrać zdjęcie do Storage i zapisać `photo_path` na roślinie.
  - **Kluczowe informacje do wyświetlenia**: podgląd, postęp, błędy uploadu.
  - **Kluczowe komponenty widoku**:
    - Wybór pliku + walidacja typu/rozmiaru (UI-side)
    - Pasek postępu
    - Sekwencja: `POST /photo/upload-url` → upload → `PATCH /plants/{id}` z `photo_path`
  - **UX, dostępność i bezpieczeństwo**:
    - Jasna informacja o prywatności/Storage (opcjonalnie)
    - Retry uploadu; komunikaty błędów 401/422/404
  - **Zależne API**: `POST /api/plants/{plantId}/photo/upload-url`, `PATCH /api/plants/{plantId}`

- **Usunięcie rośliny (potwierdzenie)**
  - **Ścieżka widoku**: dialog z `/plants/:plantId` (lub `/plants/:plantId/delete`)
  - **Główny cel**: bezpiecznie usunąć roślinę i jej plan/zadania.
  - **Kluczowe informacje do wyświetlenia**: ostrzeżenie o nieodwracalności, nazwa rośliny.
  - **Kluczowe komponenty widoku**: ConfirmDialog z wymaganym potwierdzeniem.
  - **UX, dostępność i bezpieczeństwo**:
    - Podwójne potwierdzenie (np. checkbox „Rozumiem”) lub „confirm=true” w request
    - Po sukcesie: toast + redirect do `/plants`
  - **Zależne API**: `DELETE /api/plants/{plantId}?confirm=true`

#### 2.5 Ustawienia (konto i prywatność)

- **Ustawienia — profil**
  - **Ścieżka widoku**: `/settings` (lub `/settings/profile`)
  - **Główny cel**: edycja profilu (nickname, timezone).
  - **Kluczowe informacje do wyświetlenia**:
    - Aktualny nickname i timezone
    - Informacja o wpływie timezone na interpretację dat
  - **Kluczowe komponenty widoku**:
    - ProfileForm (nickname, timezone)
    - CTA „Zapisz”
  - **UX, dostępność i bezpieczeństwo**:
    - Walidacja 422, toast po sukcesie
  - **Zależne API**: `GET /api/me`, `PATCH /api/me/profile`

- **Ustawienia — usunięcie konta (krok 1/2: intent)**
  - **Ścieżka widoku**: `/settings/delete-account`
  - **Główny cel**: zebrać podwójne potwierdzenie i zweryfikować hasło (re-auth), uzyskać `intent_id`.
  - **Kluczowe informacje do wyświetlenia**:
    - Ostrzeżenie o natychmiastowym, nieodwracalnym usunięciu danych
    - Pole hasła + checkbox/tekst zgody
    - Informacja o ważności intentu (`expires_at`)
  - **Kluczowe komponenty widoku**:
    - DeleteIntentForm (password, confirmation)
    - Obsługa błędów: 401 invalid credentials, 422 validation
  - **UX, dostępność i bezpieczeństwo**:
    - Focus management i czytelny opis konsekwencji
    - Blokada submit i retry
  - **Zależne API**: `POST /api/account/delete-intent`

- **Ustawienia — usunięcie konta (krok 2/2: delete)**
  - **Ścieżka widoku**: ten sam ekran (sekcja po uzyskaniu intentu) lub `/settings/delete-account/confirm`
  - **Główny cel**: wykonać delete konta i wylogować użytkownika.
  - **Kluczowe informacje do wyświetlenia**: finalne potwierdzenie + stan operacji.
  - **Kluczowe komponenty widoku**:
    - FinalConfirmDialog/Section
    - Po sukcesie: ekran potwierdzenia + redirect do `/auth/login`
  - **UX, dostępność i bezpieczeństwo**:
    - Obsługa `400 INVALID_OR_EXPIRED_INTENT` jako wymóg ponownego kroku 1
  - **Zależne API**: `DELETE /api/account?intent_id=...`

#### 2.6 Widoki systemowe (globalne)

- **404 / Nie znaleziono**
  - **Ścieżka widoku**: fallback routera
  - **Główny cel**: bezpieczne wyjście + linki do głównych sekcji.

- **Błąd aplikacji / 500**
  - **Ścieżka widoku**: globalny error boundary
  - **Główny cel**: komunikat + „Spróbuj ponownie” + opcjonalnie „Wróć do Kalendarza”.

- **Brak połączenia**
  - **Ścieżka widoku**: globalny banner/overlay (nie osobna strona)
  - **Główny cel**: informacja + retry dla kluczowych akcji.

### 3. Mapa podróży użytkownika

#### 3.1 Główny przypadek użycia (MVP): dodaj roślinę → ustaw plan → zobacz w kalendarzu → potwierdzaj podlewania

- **Krok 0: Wejście do aplikacji**
  - Użytkownik niezalogowany → `/auth/login`
  - Po zalogowaniu → redirect do `/calendar`

- **Krok 1: Dodanie rośliny**
  - Z dowolnego miejsca: CTA „Dodaj roślinę” → `/plants/new`
  - Użytkownik wpisuje `species_name` (opcjonalnie: nickname/description/purchase_date)
  - (Opcjonalnie) zostawia ON „Generuj plan AI”
  - Submit → `POST /api/plants`
    - Jeśli sugestia w odpowiedzi ma status `available` → przejście do `/plants/:id/watering-plan` z gotową propozycją
    - Jeśli `rate_limited` → przejście do `/plants/:id/watering-plan` ze stanem limitu i opcją ręczną

- **Krok 2: Sugerowanie planu / retry**
  - Widok `/plants/:id/watering-plan`:
    - Stan loading (≤5s budżetu)
    - Jeżeli brak sugestii lub błąd:
      - `408` → „Spróbuj ponownie” (retry) lub „Ustaw ręcznie”
      - `502` → analogicznie
      - `429` → pokaż `unlock_at`, ustaw AI toggle OFF, zaproponuj „Ustaw ręcznie”
  - Retry → `POST /api/plants/{id}/watering-plan/suggest`

- **Krok 3: Akceptacja / edycja / odrzucenie planu**
  - „Akceptuj” → `PUT /api/plants/{id}/watering-plan` z `source.type="ai"` i `accepted_without_changes=true`
  - „Edytuj i zapisz” → edytor planu → `PUT ...` z `source.type="ai"` i `accepted_without_changes=false`
  - „Odrzuć i ustaw ręcznie” → edytor planu → `PUT ...` z `source.type="manual"`

- **Krok 4: Przekierowanie po zapisie planu do konkretnego dnia**
  - Po sukcesie `PUT`:
    - Najpierw sprawdź „dziś”: `GET /api/calendar/day?date=today&status=all|pending`
      - Jeśli są zadania → redirect `/calendar/day/today`
      - Jeśli nie ma → `GET /api/calendar/month?month=YYYY-MM&status=pending`, wybierz najwcześniejszy `days[].date` → redirect `/calendar/day/:date`
  - Toast „Plan zapisany” + link „Zobacz roślinę” (do `/plants/:id`)

- **Krok 5: Codzienna praca w kalendarzu**
  - Start: `/calendar` → kliknięcie dnia → `/calendar/day/:date`
  - Potwierdzanie: przycisk „Potwierdź” przy zadaniu → `PATCH /api/watering-tasks/{taskId}`
  - Cofnij: „Cofnij” → `PATCH ...` z `status=pending`
  - Edycja: „Edytuj” → dialog (completed_on, notatka, status) → `PATCH ...`
  - Adhoc: „Dodaj wpis adhoc” → PlantPicker → `POST /api/plants/{plantId}/watering/adhoc`

#### 3.2 Podróże dodatkowe (MVP)

- **Zarządzanie roślinami**
  - `/plants` → `/plants/:id` → (edytuj) `/plants/:id/edit` → zapis `PATCH /api/plants/:id`
  - Zmiana planu: `/plants/:id` → `/plants/:id/watering-plan` → `PUT /watering-plan`

- **Usuwanie rośliny**
  - `/plants/:id` → „Usuń” (dialog) → `DELETE /api/plants/:id?confirm=true` → redirect `/plants`

- **Ustawienia profilu**
  - `/settings` → `PATCH /api/me/profile`

- **Usuwanie konta (RODO)**
  - `/settings/delete-account` → krok 1: `POST /api/account/delete-intent` → krok 2: `DELETE /api/account?intent_id=...` → wylogowanie i redirect `/auth/login`

### 4. Układ i struktura nawigacji

- **Główne sekcje (zalogowany)**:
  - **Kalendarz**: `/calendar` (domyślna sekcja)
  - **Rośliny**: `/plants`
  - **Ustawienia**: `/settings`

- **Nawigacja desktop**:
  - Stały sidebar lub topbar z 3 sekcjami + globalne CTA „Dodaj roślinę” (wyróżnione).
  - W nagłówkach widoków: breadcrumb/link powrotu (np. Rośliny → Szczegóły).

- **Nawigacja mobile**:
  - Dolna nawigacja (3 zakładki) + stałe CTA „Dodaj roślinę” (np. jako przycisk centralny lub w nagłówku).
  - Priorytet dużych akcji w widoku dnia (Potwierdź/Cofnij) i czytelnych hit-areas.

- **Deep-linking**:
  - Stabilne trasy kalendarza: `/calendar`, `/calendar/:yyyy-mm`, `/calendar/day/:yyyy-mm-dd`
  - Link „Zobacz w kalendarzu” z rośliny prowadzi do dnia (dziś lub najbliższy dostępny wg read-modeli).

- **Routing i ochrona**:
  - Trasy prywatne wymagają sesji; brak sesji/`401` → redirect do `/auth/login?returnTo=...`

### 5. Kluczowe komponenty

Komponenty wielokrotnego użytku, wspólne dla wielu widoków (architektura, nie design):

- **`ApiClient` + mapowanie błędów**: jeden adapter obsługujący envelope, `error.code` → komunikaty PL i typ prezentacji (inline/toast/fullscreen); globalna obsługa `401`.
- **`AppShell`**: layout, nawigacja desktop/mobile, globalne CTA, miejsce na toasty/bannery.
- **`PageHeader`**: tytuł, akcje kontekstowe, skrót „Dziś” w kalendarzu, link powrotu.
- **`EmptyState` / `ErrorState` / `FullScreenState`**: spójne stany dla pustych danych, błędów, AI flow (408/429/502).
- **`ToastSystem`**: krótkie informacje o sukcesie/porazce (np. „Plan zapisany”, „Zapisano zmiany”).
- **`ConfirmDialog`**: potwierdzanie akcji destrukcyjnych (usuń roślinę, usuń wpis).
- **`PlantPicker`**: wybór rośliny z wyszukiwaniem `q` i paginacją cursor (dla adhoc).
- **`PlanForm`**: minimalny formularz planu (interval + start), sekcja „Zaawansowane” (opcjonalnie).
- **`WateringTaskRow`**: render zadania dnia z rozróżnieniem `scheduled`/`adhoc` i akcjami Potwierdź/Cofnij/Edytuj/Usuń.
- **`DateInput`/`DatePicker` + formatter dat**: spójna praca z `YYYY-MM-DD` i timezone profilu.

---

### Mapowanie API → UI (skrót)

- **Profile**:
  - `GET /api/me` → inicjalizacja Ustawień / strefa czasowa
  - `PATCH /api/me/profile` → zapis profilu
- **Plants**:
  - `GET /api/plants` → Lista roślin + PlantPicker
  - `POST /api/plants` → Dodaj roślinę + (opcjonalnie) sugestia planu w odpowiedzi
  - `GET /api/plants/{id}` → Szczegóły rośliny
  - `PATCH /api/plants/{id}` → Edycja rośliny / zapis `photo_path`
  - `DELETE /api/plants/{id}?confirm=true` → Usuwanie rośliny
  - `POST /api/plants/{id}/photo/upload-url` → Upload zdjęcia
- **AI**:
  - `GET /api/ai/quota` → (kontekstowo) komunikat o limicie i stanie blokady
  - `POST /api/plants/{id}/watering-plan/suggest` → Retry sugestii (obsługa 408/429/502)
- **Watering plan**:
  - `PUT /api/plants/{id}/watering-plan` → Akceptuj/Edytuj/Odrzuć i ustaw plan; po sukcesie redirect do dnia
- **Calendar**:
  - `GET /api/calendar/month` → Kalendarz miesiąca
  - `GET /api/calendar/day` → Kalendarz dnia
- **Tasks**:
  - `PATCH /api/watering-tasks/{taskId}` → Potwierdź/Cofnij/Edycja wpisu
  - `POST /api/plants/{id}/watering/adhoc` → Adhoc
  - `DELETE /api/watering-tasks/{taskId}?confirm=true` → Usuwanie wpisu (jeśli przewidziane)
- **Account deletion**:
  - `POST /api/account/delete-intent` → krok 1/2
  - `DELETE /api/account?intent_id=...` → krok 2/2

---

### Mapowanie historyjek użytkownika (PRD) → UI

- **US-001 Dodanie rośliny ręcznie**
  - **Widoki**: `/plants/new`, `/plants`, `/plants/:id`
  - **Elementy UI**: formularz z wymaganym `species_name`, opcjonalne pola, informacja o duplikatach przez `display_name`
  - **API**: `POST /api/plants`, `GET /api/plants`, `GET /api/plants/{id}`

- **US-002 Generowanie planu podlewania**
  - **Widoki**: `/plants/:id/watering-plan`
  - **Elementy UI**: pełnoekranowy stan „Sugerowanie…”, karta propozycji, `explanation`, retry
  - **API**: `POST /api/plants` (opcjonalnie suggestion w odpowiedzi), `POST /api/plants/{id}/watering-plan/suggest` (retry)

- **US-003 Akceptacja lub korekta planu**
  - **Widoki**: `/plants/:id/watering-plan` (+ edytor planu)
  - **Elementy UI**: Akceptuj / Edytuj i zapisz / Odrzuć i ustaw ręcznie; minimalny edytor (interval + start)
  - **API**: `PUT /api/plants/{id}/watering-plan`

- **US-004 Widok kalendarza miesięcznego**
  - **Widoki**: `/calendar`, `/calendar/:yyyy-mm`
  - **Elementy UI**: siatka miesiąca, badge count, „Dziś”, klik w dzień → day view
  - **API**: `GET /api/calendar/month`

- **US-005 Widok dzienny i potwierdzanie podlewania**
  - **Widoki**: `/calendar/day/:yyyy-mm-dd`
  - **Elementy UI**: segment statusu, lista zadań, akcje Potwierdź/Cofnij
  - **API**: `GET /api/calendar/day`, `PATCH /api/watering-tasks/{taskId}`

- **US-006 Edycja wpisu podlewania**
  - **Widoki**: `/calendar/day/:date` (dialog edycji)
  - **Elementy UI**: edycja statusu, `completed_on`, notatki; usuwanie z potwierdzeniem
  - **API**: `PATCH /api/watering-tasks/{taskId}` (+ ewentualnie `DELETE /api/watering-tasks/{taskId}`)

- **US-007 Komunikacja limitów**
  - **Widoki**: `/plants/new`, `/plants/:id/watering-plan`
  - **Elementy UI**: komunikat przed pierwszym użyciem, toggle „Generuj plan AI”, auto-off przy rate-limit, prezentacja `unlock_at`, możliwość kontynuacji bez AI
  - **API**: `GET /api/ai/quota` (kontekstowo), obsługa `429` z `POST /watering-plan/suggest` i/lub `POST /plants`

- **US-008 Uwierzytelnianie i dostęp**
  - **Widoki**: `/auth/login`, `/auth/register`, `/auth/check-email` + ochrona tras prywatnych
  - **Elementy UI**: obsługa 403 email not confirmed, globalne przechwytywanie 401
  - **API**: Supabase Auth (lub opcjonalne wrappery `/api/auth/*`), wszystkie endpointy prywatne wymagają auth

- **US-009 Usunięcie konta i danych**
  - **Widoki**: `/settings/delete-account`
  - **Elementy UI**: proces 2-krokowy, hasło + zgoda, intent i finalne potwierdzenie, wylogowanie
  - **API**: `POST /api/account/delete-intent`, `DELETE /api/account`

- **US-010 Edycja danych rośliny**
  - **Widoki**: `/plants/:id/edit`, `/plants/:id` (opcjonalnie upload zdjęcia)
  - **Elementy UI**: `species_name` read-only, edycja pól opcjonalnych, upload zdjęcia jako osobna akcja
  - **API**: `PATCH /api/plants/{id}`, `POST /api/plants/{id}/photo/upload-url`

- **US-011 Usunięcie rośliny**
  - **Widoki**: `/plants/:id` (dialog)
  - **Elementy UI**: osobne potwierdzenie, komunikat o nieodwracalności, redirect
  - **API**: `DELETE /api/plants/{id}?confirm=true`

---

### Kluczowe punkty bólu użytkownika i jak UI je rozwiązuje

- **Duża kolekcja i szybkie odhaczanie**:
  - Priorytet widoku dnia (duże akcje, segment statusu, optymistyczne aktualizacje) i prosty month→day flow.
- **Niepewność AI / limit / czas odpowiedzi**:
  - Pełnoekranowe stany dla 408/429/502, zawsze dostępna ścieżka „Ustaw ręcznie”, toggle AI z auto-off i `unlock_at`.
- **Błędy walidacji i konflikty**:
  - Inline błędy 422 w formularzach, standardowe komunikaty 409 z propozycją przejścia do odpowiedniego dnia.
- **Sesje i bezpieczeństwo**:
  - Spójna obsługa 401 (redirect), potwierdzenia akcji destrukcyjnych, jasne komunikaty w procesie usuwania konta.

