## Plan implementacji widoku Kalendarz — miesiąc

## 1. Przegląd
Widok „Kalendarz — miesiąc” prezentuje miesięczną siatkę dni oraz informację, **w które dni zaplanowane są podlewania** i **ile roślin przypada na dany dzień** (domyślnie tylko `pending`). Użytkownik może przełączać miesiące i przejść do widoku dziennego klikając w kafel dnia. Widok powinien poprawnie obsłużyć strefy czasowe (interpretacja `YYYY-MM` i `YYYY-MM-DD`), zapewnić dostępność (ARIA) oraz czytelnie komunikować puste stany i błędy.

## 2. Routing widoku
- **Ścieżki**:
  - **`/calendar`**: przekierowanie do bieżącego miesiąca (np. `/calendar/2026-01`) albo render bieżącego miesiąca bez paramu (decyzja implementacyjna; rekomendowane przekierowanie dla kanonicznych URL-i).
  - **`/calendar/:yyyy-mm`**: docelowy widok miesiąca, np. `/calendar/2026-01`.
- **Parametry opcjonalne (query)**:
  - **`status=pending|completed|all`**: opcjonalnie (jeśli UI będzie oferował filtr), domyślnie `pending`.
- **Powiązany widok dzienny (na potrzeby linków)**:
  - Rekomendacja: docelowo obsłużyć routing w postaci **`/calendar/day/:yyyy-mm-dd`** (lub inny spójny wariant), aby kliknięcie kafla dnia prowadziło do listy roślin na dany dzień (US-004). Sam widok dzienny nie jest częścią tego planu, ale linki w miesiącu muszą wskazywać uzgodnioną ścieżkę.

## 3. Struktura komponentów
- **Warstwa routingu (Astro)**:
  - `src/pages/calendar/index.astro`
  - `src/pages/calendar/[month].astro`
- **Warstwa widoku (React / Astro + shadcn/ui)**:
  - `CalendarMonthView` (kontener widoku)
  - `MonthPicker` (nawigacja miesiącami + skrót „Dziś”)
  - `CalendarMonthGrid` (siatka miesiąca)
  - `CalendarMonthDayTile` (kafel dnia + badge z liczbą zadań)
  - `CalendarMonthEmptyState` (pusty stan: brak zadań)
  - `CalendarMonthErrorState` (błąd pobierania / walidacji / auth)
  - `CalendarMonthSkeleton` (stan ładowania, jeśli fetch klientowy)

## 4. Szczegóły komponentów
### `src/pages/calendar/index.astro`
- **Opis komponentu**: Entry point dla `/calendar`. Wyznacza bieżący miesiąc (`YYYY-MM`) i przekierowuje do `/calendar/:yyyy-mm` (zalecane), aby uprościć linkowanie i SEO.
- **Główne elementy**:
  - `<Layout title="Kalendarz" />`
  - Ewentualnie `Astro.redirect(...)`.
- **Obsługiwane zdarzenia**: brak (routing serwerowy).
- **Obsługiwana walidacja**:
  - Brak danych wejściowych od usera.
- **Typy**:
  - Brak.
- **Propsy**: brak.

### `src/pages/calendar/[month].astro`
- **Opis komponentu**: Strona dla konkretnego miesiąca. Odczytuje `Astro.params.month` (format `YYYY-MM`) i renderuje `CalendarMonthView`.
- **Główne elementy**:
  - `<Layout title="Kalendarz — {YYYY-MM}" />`
  - Render `CalendarMonthView` jako island (jeśli potrzebna interaktywność) lub jako komponent statyczny (jeśli nawigacja jest linkowa).
- **Obsługiwane zdarzenia**: brak (routing).
- **Obsługiwana walidacja**:
  - Walidacja paramu `month` po stronie widoku (guard) przed wywołaniem API:
    - `month` musi pasować do regex: `^\d{4}-(0[1-9]|1[0-2])$`.
  - Jeśli `status` będzie obsługiwany w URL: musi być jednym z `pending|completed|all` (lub fallback do `pending`).
- **Typy**:
  - `CalendarMonthPageParams` (VM) – patrz sekcja „Typy”.
- **Propsy**:
  - Przekazuje do `CalendarMonthView`:
    - `month: string`
    - `status?: CalendarTaskStatusFilter` (opcjonalnie)

### `CalendarMonthView`
- **Opis komponentu**: Główny kontener UI widoku miesiąca. Łączy MonthPicker, siatkę, stany (loading/empty/error) oraz integrację API.
- **Główne elementy**:
  - Kontener (np. `<main className="mx-auto max-w-5xl p-4 sm:p-6">`)
  - Nagłówek z `MonthPicker`
  - Sekcja z `CalendarMonthGrid`
  - Komponenty stanów: `CalendarMonthSkeleton`, `CalendarMonthEmptyState`, `CalendarMonthErrorState`
- **Obsługiwane zdarzenia**:
  - Zmiana miesiąca (kliknięcie „prev/next”, wybór miesiąca) → nawigacja linkowa (`href`) lub aktualizacja URL.
  - Kliknięcie „Dziś” → nawigacja do bieżącego miesiąca.
  - (Opcjonalnie) zmiana filtra statusu → aktualizacja query param i odświeżenie danych.
  - Retry po błędzie → ponowne wywołanie API.
- **Obsługiwana walidacja**:
  - Guard: jeśli `month` niepoprawny → render `CalendarMonthErrorState` (błąd walidacji po stronie klienta) i nie woła API.
  - Jeśli UI pozwala zmieniać `status`: blokuj inne wartości niż `pending|completed|all`.
- **Typy (DTO/VM)**:
  - DTO: `CalendarMonthResponseDto` (z `src/types.ts`)
  - VM: `CalendarMonthVm`, `CalendarMonthGridVm`, `CalendarMonthErrorVm` (sekcja „Typy”)
- **Propsy**:
  - `month: string`
  - `status?: CalendarTaskStatusFilter` (domyślnie `pending`)
  - (Opcjonalnie) `initialData?: CalendarMonthResponseDto` (jeśli zdecydujecie się na SSR i przekazanie danych do hydracji)

### `MonthPicker`
- **Opis komponentu**: Nawigacja miesiącami: poprzedni/następny + widoczny bieżący miesiąc + skrót „Dziś”.
- **Główne elementy**:
  - `Button` (variant `outline` lub `ghost`) dla prev/next
  - Centralny label miesiąca (np. „styczeń 2026”)
  - `Button`/link „Dziś”
- **Obsługiwane zdarzenia**:
  - `onPrevMonth()` → nawigacja do `/calendar/YYYY-MM` miesiąca poprzedniego
  - `onNextMonth()` → nawigacja do `/calendar/YYYY-MM` miesiąca następnego
  - `onToday()` → nawigacja do bieżącego miesiąca
- **Obsługiwana walidacja**:
  - `month` wejściowy musi być poprawny (guard w `CalendarMonthView`); `MonthPicker` może zakładać poprawność.
- **Typy**:
  - `MonthPickerVm` (np. `currentMonth`, `prevMonth`, `nextMonth`, `todayMonth`)
- **Propsy**:
  - `month: string`
  - `status?: CalendarTaskStatusFilter` (jeśli filtr ma być utrzymany w URL)

### `CalendarMonthGrid`
- **Opis komponentu**: Renderuje siatkę miesiąca (nagłówki dni tygodnia + 5/6 tygodni).
- **Główne elementy**:
  - Nagłówek dni tygodnia (pon–ndz) – semantycznie `role="row"` / `role="columnheader"` lub prosty `<div>` z czytelnymi labelami
  - Siatka dni: `display: grid; grid-template-columns: repeat(7, 1fr)`
  - Dla każdego dnia: `CalendarMonthDayTile`
- **Obsługiwane zdarzenia**:
  - Delegowane do `CalendarMonthDayTile` (kliknięcie dnia).
- **Obsługiwana walidacja**:
  - `gridDays` musi zawierać dni z zakresu obejmującego miesiąc (VM generowany upstream).
- **Typy**:
  - `CalendarMonthGridVm`
  - `CalendarMonthGridDayVm`
- **Propsy**:
  - `grid: CalendarMonthGridVm`
  - `status?: CalendarTaskStatusFilter` (do budowania linków)

### `CalendarMonthDayTile`
- **Opis komponentu**: Pojedynczy kafel dnia. Pokazuje numer dnia i badge `count` jeśli `count > 0`. Jest linkiem do widoku dziennego.
- **Główne elementy**:
  - Interaktywny element: preferowane **`<a>`** (link) lub `Button asChild` (shadcn) z `<a>`
  - Badge z liczbą (jeśli istnieje komponent `Badge`, w przeciwnym razie mały `<span>` ze stylami)
- **Obsługiwane zdarzenia**:
  - Kliknięcie → nawigacja do widoku dziennego dla danej daty.
- **Obsługiwana walidacja**:
  - `date` musi być w formacie `YYYY-MM-DD`.
  - `count` nie może być ujemny; jeśli backend zwróci `null`/brak → traktuj jako `0` (normalizacja w VM).
- **Dostępność (wymagane)**:
  - `aria-label` w formie: „2026-01-04 — 3 podlewania do wykonania” (albo „brak zadań” dla `0`)
  - Widoczny focus (`focus-visible`) zgodny ze stylem `Button`.
- **Typy**:
  - `CalendarMonthGridDayVm`
- **Propsy**:
  - `day: CalendarMonthGridDayVm`
  - `href: string`

### `CalendarMonthEmptyState`
- **Opis komponentu**: Wyświetlany, gdy w danym miesiącu brak zadań (dla aktywnego filtra, domyślnie `pending`).
- **Główne elementy**:
  - `Card` z tekstem „Brak zadań w tym miesiącu”
  - CTA `Button`/link „Dodaj roślinę”
- **Obsługiwane zdarzenia**:
  - Klik CTA → nawigacja do widoku dodawania rośliny (docelowo).
- **Obsługiwana walidacja**: brak.
- **Typy**:
  - `CalendarMonthEmptyStateVm` (opcjonalnie; zwykle wystarczy propsy)
- **Propsy**:
  - `ctaHref: string` (np. `/plants/new` lub tymczasowo `/`)

### `CalendarMonthErrorState`
- **Opis komponentu**: Obsługuje błędy: walidacji, 401 (unauthenticated), 5xx oraz błędy sieci/parsowania.
- **Główne elementy**:
  - `Card` + opis błędu
  - `Button` „Spróbuj ponownie” (retry)
  - (Opcjonalnie) CTA „Zaloguj się” dla 401
- **Obsługiwane zdarzenia**:
  - Retry → ponowne wywołanie API w `useCalendarMonth`
  - Login CTA → nawigacja do docelowego route logowania (jeśli istnieje)
- **Obsługiwana walidacja**:
  - Jeśli `VALIDATION_ERROR` i `details.fields.month` → pokaż przyjazny komunikat + link do bieżącego miesiąca.
- **Typy**:
  - `CalendarMonthErrorVm` (ułatwia rozróżnienie przypadków)
- **Propsy**:
  - `error: CalendarMonthErrorVm`
  - `onRetry?: () => void`

### `CalendarMonthSkeleton` (opcjonalny, jeśli fetch klientowy)
- **Opis komponentu**: Szkielet ładowania podczas pobierania danych.
- **Główne elementy**:
  - Placeholder dla MonthPicker + siatka 7x5/6 (np. szare bloczki).
- **Obsługiwane zdarzenia**: brak.
- **Walidacja**: brak.
- **Typy/Propsy**: opcjonalnie `rows: 5|6`.

## 5. Typy
### DTO (już istniejące)
- **`CalendarMonthResponseDto`** (`src/types.ts`):
  - `month: string` – `YYYY-MM`
  - `days: { date: string; count: number }[]` – `date` w `YYYY-MM-DD`, `count` liczba zadań w dniu

### Typy zapytań / filtry (już istniejące)
- **`CalendarTaskStatusFilter`** (`src/lib/services/calendar/types.ts`): `"pending" | "completed" | "all"`
- **`GetCalendarMonthFilters`** (`src/lib/services/calendar/types.ts`):
  - `month: string`
  - `status: CalendarTaskStatusFilter`

### Typy envelope API (frontend)
Zalecane jest utrzymanie na froncie wspólnego typu envelope (jak w `adhoc-client.ts`):
- **`ApiEnvelope<TData>`**:
  - `data: TData | null`
  - `error: { code: string; message: string; details?: unknown } | null`
  - `meta: Record<string, unknown>` (w tym `request_id`)

### ViewModel (nowe typy do widoku)
Rekomendowane VM (oddzielają DTO od logiki UI i normalizacji):
- **`CalendarMonthVm`**:
  - `month: string` – wejściowy miesiąc `YYYY-MM`
  - `status: CalendarTaskStatusFilter`
  - `daysByDate: Record<string, number>` – mapowanie `YYYY-MM-DD -> count` (brak = 0)
  - `hasAnyTasks: boolean` – `true` jeśli istnieje jakikolwiek dzień z `count > 0`
- **`CalendarMonthGridVm`**:
  - `month: string`
  - `weeks: CalendarMonthGridWeekVm[]`
  - `weekdayLabels: string[]` – `["pon", "wt", ...]` lub pełne nazwy (zgodne z `pl-PL`)
- **`CalendarMonthGridWeekVm`**:
  - `days: CalendarMonthGridDayVm[]` (zawsze 7)
- **`CalendarMonthGridDayVm`**:
  - `date: string` – `YYYY-MM-DD`
  - `dayNumber: number` – 1..31
  - `count: number`
  - `isInCurrentMonth: boolean`
  - `isToday: boolean`
  - `ariaLabel: string`
  - `href: string` – link do dnia (np. `/calendar/day/2026-01-04`)
- **`CalendarMonthErrorVm`** (dla error state):
  - `kind: "validation" | "unauthenticated" | "http" | "network" | "parse" | "unknown"`
  - `message: string`
  - `code?: string` (np. `VALIDATION_ERROR`, `UNAUTHENTICATED`)
  - `requestId?: string`
  - `fieldErrors?: Record<string, string[]>` (dla `VALIDATION_ERROR`)

## 6. Zarządzanie stanem
Rekomendacja: wydzielić custom hook w `src/components/hooks`.
- **Hook: `useCalendarMonth(params)`**
  - **Wejście**:
    - `month: string`
    - `status: CalendarTaskStatusFilter` (domyślnie `pending`)
  - **Stan**:
    - `status: "idle" | "loading" | "success" | "error"`
    - `data?: CalendarMonthVm`
    - `error?: CalendarMonthErrorVm`
  - **Zachowania**:
    - Guard walidacji `month` i `status` zanim poleci request.
    - `AbortController` do anulowania poprzedniego requestu przy zmianie `month/status`.
    - (Opcjonalnie) prosty cache w pamięci: `Map<string, CalendarMonthVm>` z kluczem `${month}:${status}`.
  - **API hooka**:
    - `reload(): void` (retry)

## 7. Integracja API
- **Endpoint**: `GET /api/calendar/month`
- **Query params**:
  - `month` (wymagane): `YYYY-MM`
  - `status` (opcjonalne): `pending|completed|all` (domyślnie `pending`)
- **Odpowiedź 200** (envelope):
  - `data: CalendarMonthResponseDto`
  - `error: null`
  - `meta.request_id: string`
- **Błędy** (envelope):
  - `401 UNAUTHENTICATED`
  - `400 VALIDATION_ERROR` (w `error.details.fields`)
  - `500 CALENDAR_MONTH_QUERY_FAILED` (+ `request_id`)

### Zalecana implementacja klienta API
Utworzyć plik analogiczny do `src/lib/services/watering-tasks/adhoc-client.ts`, np.:
- `src/lib/services/calendar/month-client.ts`

W kliencie:
- Buduj URL przez `new URL("/api/calendar/month", window.location.origin)` lub prosty string + `URLSearchParams`.
- Parsuj JSON do `ApiEnvelope<CalendarMonthResponseDto>`.
- Jeśli `!response.ok || envelope.error` → rzutuj błąd mapowany na `CalendarMonthErrorVm`.
- Zwracaj zawsze `CalendarMonthResponseDto` (bez envelope) dla warstwy hooka.

## 8. Interakcje użytkownika
- **Zmiana miesiąca (prev/next)**:
  - Użytkownik klika strzałkę w `MonthPicker`.
  - Oczekiwany wynik: przejście do `/calendar/:yyyy-mm` poprzedniego/następnego miesiąca; UI aktualizuje siatkę i pobiera nowe dane.
- **Skrót „Dziś”**:
  - Użytkownik klika „Dziś”.
  - Oczekiwany wynik: przejście do bieżącego miesiąca (`/calendar/YYYY-MM`) i wyróżnienie dnia dzisiejszego w siatce.
- **Kliknięcie dnia**:
  - Użytkownik klika kafel dnia.
  - Oczekiwany wynik: przejście do widoku dziennego dla `YYYY-MM-DD` (lista roślin do podlania/obsługi).
- **(Opcjonalnie) filtr statusu**:
  - Użytkownik przełącza `pending/completed/all`.
  - Oczekiwany wynik: odświeżenie danych i badge’y zgodnie z filtrem.
- **Retry po błędzie**:
  - Użytkownik klika „Spróbuj ponownie”.
  - Oczekiwany wynik: ponowny request do API i odświeżenie widoku.

## 9. Warunki i walidacja
Walidacja powinna być spójna z API (żeby redukować błędy i zbędne requesty):
- **`month`**:
  - Wymagane.
  - Format: `YYYY-MM` i miesiąc `01..12`.
  - Jeśli niepoprawny:
    - Nie wołać API.
    - Pokazać `CalendarMonthErrorState` z komunikatem i linkiem do bieżącego miesiąca.
- **`status`** (jeśli występuje w URL/UI):
  - Dozwolone wartości: `pending|completed|all`.
  - W przypadku innej wartości:
    - Fallback do `pending` (rekomendowane) albo błąd walidacji UI (konsekwentnie w całej aplikacji).
- **Strefa czasowa / daty**:
  - Dla wyliczeń siatki (pierwszy dzień miesiąca, przesunięcie tygodnia) używać konstrukcji opartych o UTC, aby uniknąć off-by-one w różnych strefach:
    - `new Date(Date.UTC(year, monthIndex, 1))`, a nie `new Date("YYYY-MM-01")`.
  - „Dziś” wyznaczać w strefie użytkownika:
    - jeśli brak profilu timezone → `Intl.DateTimeFormat(..., { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })`.

## 10. Obsługa błędów
- **401 `UNAUTHENTICATED`**:
  - Pokazać stan błędu z krótkim opisem i CTA „Zaloguj się” (jeśli istnieje route logowania) lub informacją, że wymagane jest zalogowanie.
- **400 `VALIDATION_ERROR`**:
  - Wyświetlić czytelny komunikat (np. „Niepoprawny miesiąc”) oraz (opcjonalnie) szczegóły pól, jeśli są dostępne w `error.details.fields`.
  - Zaproponować akcję naprawczą: link do `/calendar/<bieżący YYYY-MM>`.
- **500 `CALENDAR_MONTH_QUERY_FAILED` / inne 5xx**:
  - Pokazać ogólny komunikat „Nie udało się wczytać kalendarza” + przycisk retry.
  - (Opcjonalnie) pokazać `request_id` w trybie developerskim (lub w detalu expandable), żeby ułatwić korelację z logami.
- **Błędy sieci / parsowania JSON**:
  - Traktować jako `network`/`parse`, komunikat ogólny + retry.
- **Edge cases danych**:
  - Jeśli `days` zawiera daty spoza miesiąca → zignorować w normalizacji VM (lub logować warn w dev).
  - Jeśli `count` jest `null`/brak → traktować jako `0`.

## 11. Kroki implementacji
1. **Utwórz routing Astro**:
   - Dodaj `src/pages/calendar/index.astro` (redirect do bieżącego miesiąca).
   - Dodaj `src/pages/calendar/[month].astro` (render widoku miesiąca).
2. **Zaprojektuj API client**:
   - Dodaj `src/lib/services/calendar/month-client.ts` z funkcją np. `getCalendarMonth({ month, status, signal })`.
   - Użyj envelope `{ data, error, meta }` i mapowania błędów na `CalendarMonthErrorVm`.
3. **Dodaj hook `useCalendarMonth`**:
   - Umieść w `src/components/hooks/use-calendar-month.ts`.
   - Zaimplementuj: walidacja, fetch, abort, retry, (opcjonalnie) cache.
4. **Zaimplementuj ViewModel + utilsy do dat**:
   - Dodaj funkcje: `parseMonth(month)`, `formatMonthLabel(month, locale)`, `getPrevMonth(month)`, `getNextMonth(month)`, `buildMonthGridVm(month, daysByDate, timezone)`.
   - Upewnij się, że siatka jest stabilna (zawsze 7 kolumn, 5–6 wierszy) i poniedziałek jest pierwszym dniem tygodnia.
5. **Zaimplementuj komponenty UI**:
   - `CalendarMonthView` (kontener, stany, integracja hooka).
   - `MonthPicker` (prev/next/today, linki).
   - `CalendarMonthGrid` + `CalendarMonthDayTile` (aria-label, badge `count`, wyróżnienie „dziś”).
   - `CalendarMonthEmptyState`, `CalendarMonthErrorState`, `CalendarMonthSkeleton`.
6. **Spójność stylów i dostępność**:
   - Wykorzystaj istniejące shadcn `Button`, `Card`.
   - Zapewnij focus state, aria-label dla kafli, czytelne kontrasty badge.
7. **Integracja linków do widoku dziennego**:
   - Uzgodnij docelową ścieżkę dnia (np. `/calendar/day/:yyyy-mm-dd`) i zbuduj `href` w `CalendarMonthGridDayVm`.
8. **Obsługa pustego stanu**:
   - Jeśli `hasAnyTasks === false` (dla `pending`): pokaż komunikat „Brak zadań w tym miesiącu” + CTA „Dodaj roślinę”.
9. **Obsługa odświeżania**:
   - Zapewnij, że ponowne wejście na stronę lub retry pobiera świeże dane.
   - (Opcjonalnie) jeśli aplikacja w przyszłości użyje View Transitions (`ClientRouter`), upewnij się, że nawigacja między miesiącami nie psuje stanu i nie dubluje requestów.
