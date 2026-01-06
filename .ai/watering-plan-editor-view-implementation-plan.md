## Plan implementacji widoku „Edytor planu podlewania”

## 1. Przegląd
Widok „Edytor planu podlewania” pozwala użytkownikowi **ustawić aktywny plan podlewania rośliny** (wersjonowany) w minimalnym zakresie MVP: **`interval_days`** + wybór startu (**`today`** vs **`custom_date`** + **`custom_start_on`**). Pozostałe parametry (`horizon_days`, `schedule_basis`, `overdue_policy`) są dostępne jako **„Zaawansowane”** z domyślnymi wartościami.

Po zapisie planu backend regeneruje zadania podlewania, a UI powinien:
- zablokować możliwość double-submit,
- pokazać ewentualne błędy walidacji przy polach,
- po sukcesie doprowadzić użytkownika do kalendarza (żeby zobaczył efekt w praktyce).

## 2. Routing widoku
Rekomendowana, jawna trasa edytora (osobny ekran):
- **Ścieżka**: `/plants/:plantId/watering-plan/edit`
- **Astro file**: `src/pages/plants/[plantId]/watering-plan/edit.astro`
- **SSR**: `export const prerender = false`

Opcjonalnie (dla późniejszego rozszerzenia flow AI): ten sam komponent React można osadzić jako pod-widok (np. modal/sekcja) w `/plants/:plantId/watering-plan`.

## 3. Struktura komponentów
Główne komponenty i hierarchia:
- `WateringPlanEditorPage.astro`
  - `Layout.astro`
    - `WateringPlanEditorView` (React, `client:load`)
      - `WateringPlanEditorHeader`
      - `WateringPlanEditorErrorBanner` (opcjonalnie)
      - `WateringPlanForm`
        - `IntervalDaysField`
        - `StartFromFieldset`
          - `StartFromRadioGroup`
          - `CustomStartDateField` (warunkowo)
        - `AdvancedSection` (zwijana)
          - `HorizonDaysField`
          - `ScheduleBasisField`
          - `OverduePolicyField`
        - `FormActions`
      - `TasksRegeneratedSummary` (opcjonalnie po sukcesie)

Wysokopoziomowy diagram drzewa komponentów:
- `WateringPlanEditorView`
  - `Header`
  - `ErrorBanner`
  - `Form`
    - `Field: interval_days`
    - `Field: start_from + custom_start_on (conditional)`
    - `Advanced (collapsible)`
    - `Actions`
  - `Success / redirect handling`

## 4. Szczegóły komponentów

### `WateringPlanEditorPage.astro`
- **Opis komponentu**: Strona Astro hostująca widok React, odpowiedzialna za odczyt `plantId` z URL i zainicjalizowanie propsów.
- **Główne elementy**:
  - `Layout` jako wrapper
  - `<WateringPlanEditorView client:load />`
- **Obsługiwane zdarzenia**: brak (strona statycznie przekazuje propsy).
- **Walidacja**:
  - sprawdzenie, czy `plantId` istnieje w `Astro.params` (fallback do pustego stringa + obsługa błędu w React).
  - (opcjonalnie) walidacja UUID po stronie klienta w React (wczesny error state).
- **Typy**:
  - `WateringPlanEditorRouteParams` (nowy typ VM, opis w sekcji 5).
- **Propsy**: przekazuje do `WateringPlanEditorView`:
  - `plantId: string`
  - `mode?: 'manual' | 'ai'` (opcjonalnie z query string)
  - `aiRequestId?: string` (opcjonalnie z query string, dla trybu AI)

### `WateringPlanEditorView` (React)
- **Opis komponentu**: Kontener stanu widoku: trzyma stan formularza, obsługuje submit, mapuje błędy API na `fieldErrors`, odpowiada za UX (pending, blokady, redirect).
- **Główne elementy**:
  - `<main>` z układem jak w kalendarzu: `mx-auto max-w-3xl space-y-6 p-4 sm:p-6`
  - `<header>` z tytułem i akcją powrotu (link)
  - sekcja błędu globalnego (np. karta/alert)
  - `WateringPlanForm`
- **Obsługiwane zdarzenia**:
  - `onChange` pól formularza (aktualizacja stanu + czyszczenie błędów pola)
  - `onSubmit` formularza (wywołanie API `PUT /watering-plan`)
  - `onCancel` (powrót do poprzedniej strony lub `/calendar`)
- **Walidacja (UI-side)**:
  - `interval_days`:
    - wymagane
    - liczba całkowita
    - zakres `1..365`
  - `start_from`:
    - dozwolone wartości: `today` lub `custom_date` (minimalny MVP)
  - `custom_start_on`:
    - wymagane, jeśli `start_from === 'custom_date'`
    - format `YYYY-MM-DD` (np. z `<input type="date">`)
    - musi być `null`, jeśli `start_from !== 'custom_date'`
  - `horizon_days` (zaawansowane):
    - liczba całkowita `1..365`
    - jeśli puste → użyć domyślnego `90` (albo pominąć i polegać na default na backendzie)
  - `schedule_basis` (zaawansowane):
    - enum: `due_on | completed_on`
  - `overdue_policy` (zaawansowane):
    - enum: `carry_forward | reschedule`
- **Typy**:
  - `WateringPlanEditorVm`
  - `WateringPlanFormState`
  - `WateringPlanFormErrors`
  - `WateringPlanEditorModeContext`
- **Propsy**:
  - `plantId: string`
  - `mode?: 'manual' | 'ai'`
  - `aiRequestId?: string`

### `WateringPlanEditorHeader`
- **Opis komponentu**: Renderuje tytuł („Ustaw plan podlewania”) + akcje nawigacyjne (powrót).
- **Główne elementy**:
  - `<h1>` (np. `text-3xl font-bold tracking-tight`)
  - `<a>` jako powrót (np. do `/calendar`)
  - (opcjonalnie) krótki opis „Ustaw częstotliwość i datę startu”.
- **Obsługiwane zdarzenia**: kliknięcie linku powrotu.
- **Walidacja**: brak.
- **Typy**: `WateringPlanEditorHeaderProps`.
- **Propsy**:
  - `backHref: string`
  - `title?: string`
  - `subtitle?: string`

### `WateringPlanEditorErrorBanner`
- **Opis komponentu**: Pokazuje błąd globalny (nie walidacyjny) w czytelnej formie, z CTA.
- **Główne elementy**:
  - kontener `div`/`Card` z `role="status"`
  - przyciski: Retry / Zaloguj / Wróć
- **Obsługiwane zdarzenia**:
  - Retry (ponowny submit lub ponowne ładowanie strony)
  - Przejście do logowania (dla 401) z `returnTo`
- **Walidacja**: brak.
- **Typy**:
  - `WateringPlanMutationError` (z hooka mutacji)
- **Propsy**:
  - `error: WateringPlanMutationError`
  - `onRetry?: () => void`
  - `loginHref?: string`

### `WateringPlanForm`
- **Opis komponentu**: Formularz (semantycznie `<form>`) trzymający pola i sekcję „Zaawansowane”.
- **Główne elementy**:
  - `<form onSubmit>`
  - `<fieldset disabled={pending}>` (blokada całego formularza podczas zapisu)
  - pola (inputy/radia/selecty)
  - akcje (submit/cancel)
- **Obsługiwane zdarzenia**:
  - `onSubmit`
  - `onChange` dla każdego pola
- **Walidacja**: jak w `WateringPlanEditorView` (formularz nie powinien pozwolić na submit, jeśli UI-side walidacja nie przechodzi).
- **Typy**:
  - `WateringPlanFormState`, `WateringPlanFormErrors`
- **Propsy**:
  - `value: WateringPlanFormState`
  - `errors: WateringPlanFormErrors | null`
  - `pending: boolean`
  - `onChange: (patch: Partial<WateringPlanFormState>) => void`
  - `onSubmit: () => void`
  - `onCancel: () => void`

### `IntervalDaysField`
- **Opis komponentu**: Pole dla `interval_days`.
- **Główne elementy**:
  - `<label>`
  - `<input type="number" min={1} max={365} step={1} inputMode="numeric">`
  - tekst pomocniczy („1–365 dni”)
  - inline error pod polem
- **Obsługiwane zdarzenia**: `onChange`, `onBlur` (opcjonalnie: walidacja/normalizacja).
- **Walidacja**:
  - wymagane
  - int
  - 1..365
- **Typy**: `FieldErrorVm` / `WateringPlanFormErrors`.
- **Propsy**:
  - `value: number | ''` (rekomendowane dla UX z input type number)
  - `error?: string[]`
  - `onChange: (next: number | '') => void`

### `StartFromFieldset`
- **Opis komponentu**: Wybór startu planu: `today` vs `custom_date`.
- **Główne elementy**:
  - `<fieldset>`
  - radio group (np. 2 opcje)
  - warunkowy `<input type="date">` dla `custom_start_on`
- **Obsługiwane zdarzenia**:
  - `onChange` radia (ustawia `start_from` i czyści/ustawia `custom_start_on`)
  - `onChange` daty
- **Walidacja**:
  - jeśli `custom_date`: `custom_start_on` wymagane
  - jeśli `today`: `custom_start_on` musi być `null`
- **Typy**: `WateringPlanStartFromUi` (nowy typ VM, opis w sekcji 5).
- **Propsy**:
  - `startFrom: WateringPlanStartFromUi`
  - `customStartOn: string | null`
  - `errors?: { start_from?: string[]; custom_start_on?: string[] }`
  - `onChangeStartFrom: (value: WateringPlanStartFromUi) => void`
  - `onChangeCustomStartOn: (value: string) => void`

### `AdvancedSection`
- **Opis komponentu**: Zwijana sekcja „Zaawansowane” (domyślnie zamknięta).
- **Główne elementy**:
  - `<details>` + `<summary>` (najprostsze, dostępne) lub shadcn Accordion (jeśli dodamy).
  - pola: `horizon_days`, `schedule_basis`, `overdue_policy`
- **Obsługiwane zdarzenia**: toggle open/close, zmiany pól.
- **Walidacja**:
  - `horizon_days` int 1..365
  - `schedule_basis` enum
  - `overdue_policy` enum
- **Typy**: `WateringPlanAdvancedState`.
- **Propsy**:
  - `value: WateringPlanAdvancedState`
  - `errors?: WateringPlanFormErrors`
  - `onChange: (patch: Partial<WateringPlanAdvancedState>) => void`

### `FormActions`
- **Opis komponentu**: Sekcja przycisków (Zapisz/Anuluj), z blokadą podczas zapisu.
- **Główne elementy**:
  - `Button` (primary submit)
  - `Button` (outline/ghost cancel)
  - (opcjonalnie) tekst statusu „Zapisywanie…”
- **Obsługiwane zdarzenia**: klik, submit.
- **Walidacja**:
  - `disabled` jeśli `pending` albo formularz niepoprawny.
- **Typy**: `FormActionsProps`.
- **Propsy**:
  - `pending: boolean`
  - `canSubmit: boolean`
  - `onCancel: () => void`

### `TasksRegeneratedSummary` (opcjonalnie)
- **Opis komponentu**: Pokazuje podsumowanie z backendu (`tasks_regenerated`) jako feedback sukcesu lub debug.
- **Główne elementy**:
  - prosty `Card` z tekstem: zakres dat i liczba zadań
- **Obsługiwane zdarzenia**: brak.
- **Walidacja**: brak.
- **Typy**: `TasksRegeneratedSummary` (z `src/types.ts`).
- **Propsy**:
  - `summary: TasksRegeneratedSummary`

## 5. Typy

### DTO (istniejące – używamy bez zmian)
- `SetWateringPlanCommand` (`src/types.ts`):
  - `interval_days: number`
  - `horizon_days: number`
  - `schedule_basis: 'due_on' | 'completed_on'`
  - `start_from: 'today' | 'purchase_date' | 'custom_date'`
  - `custom_start_on: string | null` (ISO date `YYYY-MM-DD`)
  - `overdue_policy: 'carry_forward' | 'reschedule'`
  - `source`:
    - AI: `{ type: 'ai'; ai_request_id: string; accepted_without_changes: boolean }`
    - Manual: `{ type: 'manual'; ai_request_id?: null }`
- `SetWateringPlanResultDto` (`src/types.ts`):
  - `plan: WateringPlanSummaryDto`
  - `tasks_regenerated: { from: 'YYYY-MM-DD'; to: 'YYYY-MM-DD'; count: number }`

### Nowe typy ViewModel (do dodania w FE, np. w `src/lib/services/watering-plans/watering-plan-editor-vm.ts` lub lokalnie w komponencie)

#### `WateringPlanEditorModeContext`
Cel: jednoznacznie zdefiniować, jaki `source` wysyłamy i skąd bierzemy `ai_request_id`.
- `mode: 'manual' | 'ai'`
- `aiRequestId: string | null`
- `acceptedWithoutChanges: boolean | null`
  - dla edytora (w trybie AI): domyślnie `false`

#### `WateringPlanStartFromUi`
Cel: ograniczyć UI do wariantów MVP.
- `'today' | 'custom_date'`

#### `WateringPlanFormState`
Cel: stan formularza przyjazny dla inputów (w tym puste wartości).
- `intervalDays: number | ''`
- `startFrom: WateringPlanStartFromUi`
- `customStartOn: string | null`
- `advanced: WateringPlanAdvancedState`

#### `WateringPlanAdvancedState`
- `horizonDays: number | ''` (domyślnie `90`)
- `scheduleBasis: 'due_on' | 'completed_on'` (domyślnie `completed_on`)
- `overduePolicy: 'carry_forward' | 'reschedule'` (domyślnie `carry_forward`)

#### `WateringPlanFormErrors`
Cel: zunifikować błędy inline.
- `form?: string[]` (błąd ogólny)
- `interval_days?: string[]`
- `start_from?: string[]`
- `custom_start_on?: string[]`
- `horizon_days?: string[]`
- `schedule_basis?: string[]`
- `overdue_policy?: string[]`

#### `WateringPlanEditorVm`
Cel: VM dla kontenera, ułatwia render i decyzje UX.
- `plantId: string`
- `mode: WateringPlanEditorModeContext`
- `form: WateringPlanFormState`
- `pending: boolean`
- `canSubmit: boolean`
- `errors: WateringPlanFormErrors | null`
- `lastResult: SetWateringPlanResultDto | null`

#### `WateringPlanMutationError` (dla hooka mutacji)
Analogicznie do `useWateringTaskMutations`:
- `kind: 'validation' | 'conflict' | 'notFound' | 'unauthenticated' | 'http' | 'network' | 'parse' | 'unknown'`
- `code?: string`
- `message: string`
- `details?: unknown`
- `fieldErrors?: WateringPlanFormErrors` (zmapowane z `details.issues`)
- `requestId?: string`

## 6. Zarządzanie stanem
Rekomendacja: wydzielić **custom hook** w `src/components/hooks/` analogicznie do istniejących mutacji zadań:
- `use-watering-plan-mutations.ts` (nowy)

Zakres hooka:
- `pending` (blokada submit + fieldset)
- `error`:
  - mapowanie `422 VALIDATION_ERROR` → `fieldErrors`
  - mapowanie `409 PLAN_CONFLICT` → `kind='conflict'`
  - mapowanie `401`/`UNAUTHENTICATED` → `kind='unauthenticated'`
- `submitSetPlan(plantId, command)`:
  - wywołuje klienta API
  - po sukcesie unieważnia cache kalendarza (patrz niżej)
  - zwraca `SetWateringPlanResultDto`

Unieważnianie cache po sukcesie (ważne dla „natychmiast zasila kalendarz”):
- wywołać `invalidateCalendarMonthCache()` (globalnie) albo przynajmniej:
  - `invalidateCalendarMonthCacheByMonth(month)` dla miesięcy w zakresie `tasks_regenerated.from..to`
- opcjonalnie `invalidateCalendarDayCache()` jeśli w aplikacji używamy day cache w kontekście bieżącego dnia.

## 7. Integracja API

### Wymagane wywołanie
- `PUT /api/plants/{plantId}/watering-plan`

### Kontrakt żądania (payload)
Wysyłamy `SetWateringPlanCommand`:
- `interval_days`: int `1..365`
- `horizon_days`: int `1..365` (domyślnie 90)
- `schedule_basis`: `'due_on' | 'completed_on'`
- `start_from`: `'today' | 'custom_date'` (w MVP edytor nie udostępnia `purchase_date`)
- `custom_start_on`: `null` albo `YYYY-MM-DD`
- `overdue_policy`: `'carry_forward' | 'reschedule'`
- `source`:
  - manual: `{ type: 'manual' }`
  - ai edit: `{ type: 'ai', ai_request_id: string, accepted_without_changes: false }`

### Kontrakt odpowiedzi (200)
`SetWateringPlanResultDto`:
- `plan` (podsumowanie aktywnego planu)
- `tasks_regenerated` (zakres i liczba wygenerowanych zadań)

### Klient API (nowy plik)
Zalecane dodać analogiczny do `watering-task-client.ts`:
- `src/lib/services/watering-plans/watering-plans-client.ts`
  - `setWateringPlan(plantId: string, command: SetWateringPlanCommand): Promise<{ data: SetWateringPlanResultDto; requestId?: string }>`
  - `WateringPlanApiError` + mapowanie `kind`

### UWAGA: brakujący endpoint server-side (prerekwizyt)
W repozytorium jest serwis i walidacja requestu, ale aby frontend mógł z niego korzystać, musi istnieć route:
- `src/pages/api/plants/[plantId]/watering-plan/index.ts` obsługujący `PUT`
  - użyć: `parseSetWateringPlanParams`, `parseSetWateringPlanRequest`, `setPlantWateringPlan`
  - zwracać envelope `{ data, error, meta }` spójny z innymi endpointami.

## 8. Interakcje użytkownika
- **Zmiana interwału**:
  - użytkownik wpisuje liczbę dni → aktualizacja stanu
  - jeśli poza zakresem/nie liczba → inline error + disabled submit
- **Wybór startu „od dziś”**:
  - ustaw `start_from='today'`
  - ustaw `custom_start_on=null`
  - ukryj pole daty
- **Wybór startu „wybierz datę”**:
  - ustaw `start_from='custom_date'`
  - pokaż `<input type="date">`
  - wymagaj `custom_start_on`
- **Rozwinięcie „Zaawansowane”**:
  - użytkownik może zmienić `horizon_days`, `schedule_basis`, `overdue_policy`
  - walidacja inline analogicznie
- **Zapis**:
  - blokada formularza i przycisków (pending)
  - wywołanie API
  - sukces: toast/komunikat + nawigacja do kalendarza (patrz sekcja 11)
- **Anuluj**:
  - powrót do poprzedniego widoku (history.back) albo `/calendar`

## 9. Warunki i walidacja
Warunki wymagane przez API i jak weryfikować w UI:
- **`interval_days`**:
  - UI: `required`, `int`, `min=1`, `max=365`
  - API: `z.number().int().min(1).max(365)`
- **`horizon_days`**:
  - UI: `int`, `min=1`, `max=365`, domyślnie 90
  - API: `z.number().int().min(1).max(365).optional().default(90)`
- **`start_from` + `custom_start_on`**:
  - UI:
    - jeśli `start_from === 'custom_date'` → `custom_start_on` wymagane
    - jeśli `start_from !== 'custom_date'` → `custom_start_on` musi być `null`
    - format zawsze `YYYY-MM-DD`
  - API:
    - `custom_start_on` nullable; dodatkowe reguły w `.superRefine`
- **`schedule_basis`**:
  - UI: enum (`due_on`/`completed_on`)
  - API: `z.enum(['due_on', 'completed_on'])`
- **`overdue_policy`**:
  - UI: enum (`carry_forward`/`reschedule`)
  - API: `z.enum(['carry_forward', 'reschedule'])`
- **`source`**:
  - manual: zawsze `{ type: 'manual' }`
  - ai edit: `{ type: 'ai', ai_request_id, accepted_without_changes: false }`
  - UI musi pilnować, aby w trybie manual nie wysyłać `ai_request_id`.

Wpływ walidacji na stan UI:
- `canSubmit=false` jeśli jest jakikolwiek client-side błąd lub brak wymaganych wartości.
- Po `422 VALIDATION_ERROR`:
  - `fieldErrors` mapowane do konkretnych pól
  - focus pierwszego błędnego pola (opcjonalnie, poprawia UX)
  - globalny błąd formularza tylko gdy błąd dotyczy `(body)` / `form`.

## 10. Obsługa błędów
Potencjalne scenariusze i zachowanie UI:
- **422 VALIDATION_ERROR**:
  - pokazać inline błędy przy polach (na podstawie `details.issues`)
  - utrzymać wartości w formularzu
- **401 UNAUTHENTICATED**:
  - banner „Sesja wygasła” + CTA do logowania
  - `loginHref = /auth/login?returnTo=<currentPathAndSearch>`
- **404 PLANT_NOT_FOUND**:
  - komunikat „Nie znaleziono rośliny” + CTA do `/plants` (jeśli istnieje) lub `/calendar`
- **409 PLAN_CONFLICT**:
  - komunikat „Plan został zmieniony równolegle” + CTA „Spróbuj ponownie”
  - nie resetować formularza
- **Błędy sieci / parse**:
  - komunikat „Brak połączenia” / „Nie udało się przetworzyć odpowiedzi”
  - CTA retry
- **500+**:
  - komunikat ogólny, ewentualnie pokazać `request_id` jeśli w meta (zgodnie ze wzorcem innych widoków)

## 11. Kroki implementacji
1. **Dodać routing strony edytora**:
   - utworzyć `src/pages/plants/[plantId]/watering-plan/edit.astro` (SSR, `prerender=false`)
   - osadzić `WateringPlanEditorView client:load`
2. **Dodać klienta API dla watering plan**:
   - `src/lib/services/watering-plans/watering-plans-client.ts`
   - `setWateringPlan()` + `WateringPlanApiError` + mapowanie `kind` (validation/conflict/unauthenticated/…)
3. **Dodać hook mutacji**:
   - `src/components/hooks/use-watering-plan-mutations.ts`
   - mapowanie błędów 422 → `fieldErrors` (wykorzystać podejście z `useWateringTaskMutations`)
   - po sukcesie: unieważnić cache kalendarza w zakresie miesięcy `tasks_regenerated.from..to`
4. **Zaimplementować komponenty widoku**:
   - `src/components/watering-plan/editor/WateringPlanEditorView.tsx`
   - podkomponenty formularza (`WateringPlanForm` + pola + advanced)
   - używać `Button`, `Card` z `src/components/ui`
   - jeśli brakuje prymitywów (Input/Label/Select/Accordion) – dodać shadcn odpowiedniki do `src/components/ui/`
5. **Zaimplementować mapowanie form state → DTO**:
   - z `WateringPlanFormState` zbudować `SetWateringPlanCommand`
   - gwarantować: `custom_start_on=null` gdy `start_from !== custom_date`
6. **Zaimplementować redirect po sukcesie (minimalny, pewny wariant)**:
   - po `200`: redirect do `/calendar/day/${tasks_regenerated.from}?highlightPlantId=${plantId}`
   - alternatywnie (bardziej zgodnie z PRD US-021): sprawdzić dzień „dziś”, a jeśli brak zadań – znaleźć najbliższy dzień z zadaniami w miesiącu i tam przekierować.
7. **Dopiąć obsługę 401**:
   - generować `loginHref` jak w `CalendarDayView` (z `returnTo`)
8. **Dopiąć UX i dostępność**:
   - `fieldset disabled` podczas pending
   - `aria-invalid`, `aria-describedby` dla pól z błędami
   - fokus na pierwszym błędzie po 422 (opcjonalnie)
9. **Weryfikacja manualna**:
   - poprawny payload dla `today` i `custom_date`
   - scenariusze 422 (np. `interval_days=0`, brak `custom_start_on`)
   - scenariusz 401 (wygaszona sesja)
   - scenariusz 409 (symulacja/wywołanie równoległe)

