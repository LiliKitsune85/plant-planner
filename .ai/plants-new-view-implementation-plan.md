# Plan implementacji widoku Dodaj roślinę (`/plants/new`)

## 1. Przegląd
Widok **„Dodaj roślinę”** służy do utworzenia nowej rośliny minimalnie (wymagane `species_name`) oraz opcjonalnie: `nickname`, `description`, `purchase_date`. Widok zawiera przełącznik **„Generuj plan AI”** (domyślnie **ON**) i po poprawnym zapisie przekierowuje użytkownika do kolejnego kroku flow: **`/plants/:plantId/watering-plan`**.

Wymagania nadrzędne (PRD / UI plan):
- **Minimalny formularz**: wystarczy nazwa gatunku.
- **Duplikaty**: numeracja duplikatów (`duplicate_index`) jest po stronie backendu, UI pokazuje wynik po zapisie (w kolejnym widoku / w komunikacie sukcesu).
- **AI limit**: przed pierwszym użyciem pokaż informację o limicie 20 zapytań/h; jeśli AI jest rate-limited, UI powinno umożliwić kontynuację bez AI.

## 2. Routing widoku
- **Ścieżka**: `/plants/new`
- **Plik**: `src/pages/plants/new.astro`
- **Renderowanie**:
  - `export const prerender = false` (spójnie z innymi widokami dynamicznymi).
  - Strona Astro renderuje layout i ładuje komponent React `client:load`.

## 3. Struktura komponentów
Proponowana struktura (Astro + React):
- `src/pages/plants/new.astro`
  - `Layout`
    - `CreatePlantView` (React, `client:load`)
      - `CreatePlantHeader`
      - `CreatePlantFormCard`
        - `CreatePlantForm`
          - `SpeciesNameField`
          - `NicknameField` (opcjonalne)
          - `DescriptionField` (opcjonalne)
          - `PurchaseDateField` (opcjonalne)
          - `AiSuggestionToggle`
          - `FormActions` (Submit/Cancel)
      - `CreatePlantInlineError` (alert/sekcja błędu)

## 4. Szczegóły komponentów

### `src/pages/plants/new.astro` (strona)
- **Opis**: Punkt wejścia routingu. Ustawia tytuł i osadza Reactowy widok.
- **Główne elementy**:
  - `<Layout title="Dodaj roślinę">`
  - `<CreatePlantView client:load />`
- **Zdarzenia**: brak (statyczne osadzenie).
- **Walidacja**: brak (walidacja w React).
- **Typy**: brak.
- **Propsy**: brak.

### `CreatePlantView` (React, np. `src/components/plants/new/CreatePlantView.tsx`)
- **Opis**: Kontener widoku. Trzyma stan formularza, walidację UI, wywołanie API, routing po sukcesie, oraz logikę związaną z AI rate-limit (UX).
- **Główne elementy**:
  - `<main>` + nagłówek strony (`<h1>Dodaj roślinę</h1>`)
  - `Card` (`@/components/ui/card`) jako kontener formularza
  - Sekcja komunikatów (np. `<div role="alert">`)
- **Obsługiwane zdarzenia**:
  - `onSubmit(formValues)` → uruchamia `createPlant` API.
  - `onCancel()` → nawigacja np. do listy roślin (`/plants`) lub do kalendarza (`/calendar`) – decyzja projektowa; w MVP sugerowane: `/calendar`.
  - `onToggleAi(enabled)` → aktualizuje stan i ewentualnie zapisuje preferencję lokalnie.
- **Walidacja (UI, przed API)**:
  - Wywoływana przy submit oraz (opcjonalnie) przy blur/podczas pisania dla `species_name`.
  - Ma odzwierciedlać walidację backendu (szczegóły w sekcji 9).
- **Typy (DTO + ViewModel)**:
  - DTO: `CreatePlantCommand`, `CreatePlantResultDto`, `WateringSuggestionForCreationDto` (`src/types.ts`).
  - ViewModel: `CreatePlantFormValues`, `CreatePlantFormErrors`, `CreatePlantSubmitState`, `CreatePlantErrorVm` (szczegóły w sekcji 5).
- **Propsy**:
  - Brak (widok jest stroną).

Przykładowy interfejs (props) nie jest wymagany, ale jeśli chcesz parametryzować redirect:
- `redirectToOnCancel?: string`
- `redirectToAfterCreate?: (plantId: string) => string` (domyślnie `/plants/${plantId}/watering-plan`)

### `CreatePlantForm` (React, np. `src/components/plants/new/CreatePlantForm.tsx`)
- **Opis**: Komponent formularza (prezentacyjny). Otrzymuje aktualne wartości, błędy pól, stan `isSubmitting`, oraz callbacki.
- **Główne elementy HTML**:
  - `<form>` z `onSubmit`
  - `species_name`: `<input type="text" name="species_name" autoComplete="off" required />`
  - `nickname`: `<input type="text" name="nickname" />`
  - `description`: `<textarea name="description" />`
  - `purchase_date`: `<input type="date" name="purchase_date" />`
  - Sekcja AI: `AiSuggestionToggle`
  - Akcje: przycisk submit (`Button`) + przycisk anuluj (`Button variant="outline"` z linkiem lub handlerem)
- **Obsługiwane zdarzenia**:
  - `onChange` dla pól → aktualizacja `CreatePlantFormValues`
  - `onBlur` (opcjonalnie) → walidacja pojedynczego pola
  - `onSubmit` → deleguje do `CreatePlantView`
- **Walidacja**:
  - Wyświetlanie błędów inline pod polami.
  - Blokada submit, gdy:
    - `isSubmitting === true`, albo
    - `species_name` puste po trim, albo
    - są błędy walidacji (jeśli stosujesz walidację „na żywo”).
- **Typy**:
  - `CreatePlantFormValues`
  - `CreatePlantFormErrors`
  - `CreatePlantFormProps` (poniżej)
- **Propsy**:

```ts
export type CreatePlantFormProps = {
  value: CreatePlantFormValues
  errors: CreatePlantFormErrors
  isSubmitting: boolean
  onChange: (patch: Partial<CreatePlantFormValues>) => void
  onSubmit: () => void
  onCancel: () => void
  ai: {
    enabled: boolean
    isRateLimited: boolean
    unlockAt?: string | null
    showLimitInfo: boolean
    onToggle: (enabled: boolean) => void
  }
}
```

### `AiSuggestionToggle` (React, np. `src/components/plants/new/AiSuggestionToggle.tsx`)
- **Opis**: UI przełącznika „Generuj plan AI” + kontekstowe informacje o limicie i rate-limit.
- **Główne elementy**:
  - Label + kontrolka przełącznika (preferowane shadcn + Radix Switch; alternatywnie checkbox stylowany Tailwindem).
  - Tekst pomocniczy:
    - „Limit: 20 zapytań/h na użytkownika” (pokazać przynajmniej raz przed pierwszym użyciem).
    - Gdy `isRateLimited`: komunikat z `unlockAt` i informacją, że można kontynuować bez AI.
- **Obsługiwane zdarzenia**:
  - `onToggle(checked)` → przekazuje do rodzica.
- **Walidacja**:
  - Jeśli `isRateLimited === true`: przełącznik **disabled** i stan wymuszony na OFF (lub automatycznie przełączony na OFF + disabled).
- **Typy**:
  - `AiToggleVm` (sekcja 5).
- **Propsy**:

```ts
export type AiSuggestionToggleProps = {
  checked: boolean
  disabled?: boolean
  showLimitInfo: boolean
  limitText: string // np. "Limit: 20 zapytań/h"
  rateLimit?: { unlockAt: string } | null
  onCheckedChange: (checked: boolean) => void
}
```

### `CreatePlantInlineError` (opcjonalny, React)
- **Opis**: Jedno miejsce na błąd globalny (network/500/401), spójne z `CalendarErrorState`.
- **Główne elementy**:
  - `Card` z wariantem „destructive” (jak w `CalendarErrorState`) albo prosty `div role="alert"`.
  - CTA:
    - Retry (dla network/http)
    - Login (dla 401)
- **Obsługiwane zdarzenia**:
  - `onRetry()`
  - `onLogin()`
- **Walidacja**: brak.
- **Typy**:
  - `CreatePlantErrorVm`
- **Propsy**:
  - `error: CreatePlantErrorVm`
  - `onRetry?: () => void`

## 5. Typy
Wykorzystaj istniejące DTO z `src/types.ts` i dodaj lokalne typy ViewModel.

### DTO (już istnieją)
- **`CreatePlantCommand`**:
  - `species_name: string`
  - `nickname?: string | null`
  - `description?: string | null`
  - `purchase_date?: string | null` (ISO `YYYY-MM-DD`)
  - `photo_path?: string | null` (w tym widoku: nie używać / zostawić na przyszłość)
  - `generate_watering_suggestion?: boolean`
- **`CreatePlantResultDto`**:
  - `plant: PlantSummaryDto`
  - `watering_suggestion: WateringSuggestionForCreationDto`
- **`WateringSuggestionForCreationDto`** (union):
  - `{ status: 'available', ai_request_id, interval_days, horizon_days, schedule_basis, start_from, custom_start_on, overdue_policy, explanation }`
  - `{ status: 'rate_limited', ai_request_id, unlock_at }`
  - `{ status: 'error' | 'skipped', ai_request_id: string | null, explanation?: string | null }`

### Nowe typy ViewModel (frontend)
Dodaj w obrębie widoku (np. `src/components/plants/new/types.ts`) albo bezpośrednio w plikach komponentów.

- **`CreatePlantFormValues`** (stan pól formularza):
  - `species_name: string`
  - `nickname: string` (trzymamy jako string w input, normalizujemy do `null` przy submit)
  - `description: string`
  - `purchase_date: string` (pusty string = brak; w submit normalizuj do `null`)
  - `generate_watering_suggestion: boolean`

- **`CreatePlantFormField`**:
  - `'species_name' | 'nickname' | 'description' | 'purchase_date' | 'generate_watering_suggestion' | 'form'`

- **`CreatePlantFormErrors`**:
  - `fieldErrors: Partial<Record<CreatePlantFormField, string[]>>`
  - `formError?: string` (opcjonalnie; np. „Nie udało się zapisać rośliny”)

- **`CreatePlantSubmitState`**:
  - `{ status: 'idle' }`
  - `{ status: 'submitting' }`
  - `{ status: 'success'; result: CreatePlantResultDto }`
  - `{ status: 'error'; error: CreatePlantErrorVm }`

- **`CreatePlantErrorVm`** (mapa błędów do UI):
  - `kind: 'validation' | 'unauthenticated' | 'conflict' | 'network' | 'http' | 'parse' | 'unknown'`
  - `message: string`
  - `code?: string`
  - `requestId?: string`
  - `details?: unknown`
  - `fieldErrors?: Record<string, string[]>` (np. z `details.issues`)

- **`AiRateLimitVm`**:
  - `isRateLimited: boolean`
  - `unlockAt?: string | null`

## 6. Zarządzanie stanem
Zalecane podejście: logikę formularza i komunikacji z API wydziel do custom hooka, aby `CreatePlantView` był czytelny.

### Custom hook (propozycja)
- **`useCreatePlant`** (np. `src/components/hooks/use-create-plant.ts`):
  - **Cel**: zarządza `CreatePlantFormValues`, walidacją, stanem submitu, błędami, i wywołaniem API.
  - **Zwraca**:
    - `value`, `setValue` / `patchValue`
    - `errors`, `validateField`, `validateAll`
    - `submitState`, `submit()`, `resetError()`
    - `aiRateLimitState` (opcjonalnie) + helpery do lokalnego cache

### Stan w widoku (minimum)
- **Form state**: `CreatePlantFormValues`
- **Client-side errors**: `CreatePlantFormErrors`
- **Submit state**: `CreatePlantSubmitState`
- **AI UX**:
  - `hasSeenAiLimitInfo: boolean` (np. localStorage `pp_ai_limit_info_seen`)
  - `cachedAiUnlockAt?: string` (np. localStorage `pp_ai_unlock_at`)

## 7. Integracja API

### Wymagane wywołanie
- **`POST /api/plants`**

### Typy żądania i odpowiedzi
- **Request body**: `CreatePlantCommand`
- **Response envelope** (w praktyce w kodzie FE):
  - `data: CreatePlantResultDto | null`
  - `error: { code: string; message: string; details?: unknown } | null`
  - `meta?: Record<string, unknown> | null`

Uwaga o spójności backendu:
- `PATCH/DELETE /api/plants/[plantId]` zwraca `error.details`, ale `POST /api/plants` w aktualnej implementacji zwraca tylko `{code, message}`. Frontend powinien:
  - działać poprawnie **bez** `details`,
  - ale jeśli `details` pojawi się w przyszłości, mapować błędy pól (np. `details.issues[]`) inline.

### Gdzie dodać klienta API
W projekcie istnieje `src/lib/services/plants/plants-client.ts` (obecnie `listPlants`). Dodaj analogicznie:
- `createPlant(command: CreatePlantCommand): Promise<{ data: CreatePlantResultDto; requestId?: string }>`
- `PlantsApiError` jest już w tym pliku – rozszerz `determineErrorKind` o:
  - `unauthenticated` (code `UNAUTHENTICATED` / status 401)
  - `conflict` (status 409 / code `DUPLICATE_INDEX_CONFLICT`)

### Akcje frontendowe po odpowiedzi
- **201 success**:
  - odczytaj `plant.id` i wykonaj redirect do `/plants/${plant.id}/watering-plan`
  - opcjonalnie przekaż w query param stan sugestii (np. `?suggestion=skipped`) albo zapisz w `sessionStorage` (jeśli kolejny widok nie ma jeszcze API).
- **watering_suggestion.status === 'rate_limited'**:
  - zapisz `unlock_at` do localStorage (np. `pp_ai_unlock_at`) do użycia w kolejnych próbach tworzenia,
  - w tym widoku nie blokuj kontynuacji (plant jest już utworzony) – redirect jak wyżej.

## 8. Interakcje użytkownika
- **Wpisywanie danych**:
  - UI pokazuje wymagane pole `species_name` oraz pola opcjonalne.
  - Inline walidacja może pojawić się po blur lub przy próbie submit.
- **Przełącznik AI**:
  - Domyślnie ON.
  - Przy pierwszym użyciu pokaż informację o limicie 20/h (persist w localStorage).
  - Jeśli wykryto rate-limit (z cache) – przełącznik auto OFF + disabled + komunikat z `unlock_at`.
- **Submit**:
  - Blokada przycisków i pól podczas zapisu.
  - Po sukcesie: nawigacja do `/plants/:plantId/watering-plan`.
- **Cancel**:
  - Nawigacja do bezpiecznego miejsca (np. `/calendar`) bez zapisu.

## 9. Warunki i walidacja
Walidacja UI powinna odzwierciedlać walidację backendu (`src/lib/api/plants/create-plant-request.ts`).

### `species_name`
- **Wymagane**
- Trim
- Min: 1
- Max: 120

### `nickname` (opcjonalne)
- Trim
- Jeśli pusty string → traktuj jako `null`
- Jeśli podane: min 1, max 80

### `description` (opcjonalne)
- Trim
- Jeśli pusty string → `null`
- Max: 10 000

### `purchase_date` (opcjonalne)
- Jeśli podane: string w formacie **`YYYY-MM-DD`**
- Musi być prawidłową datą (zgodność z ISO po parsowaniu; jak w backend `isValidIsoDate`)
- Jeśli niepodane → `null`

### `photo_path` (na później)
Jeśli kiedyś dodasz pole zdjęcia w tym widoku, waliduj zgodnie z backendem:
- string, trim, min 1, max 500
- nie może być URL (`http(s)://`)
- nie może zaczynać się od `/`
- nie może zawierać `..`, `\`, `?`, `#`

### `generate_watering_suggestion`
- boolean
- **UI default: true**
- **Backend default: false**, więc jeśli użytkownik chce AI, frontend musi wysłać `true`.

## 10. Obsługa błędów

### Scenariusze błędów i reakcje UI
- **401 UNAUTHENTICATED**
  - Pokaż komunikat: „Sesja wygasła / nie jesteś zalogowany”.
  - CTA: „Przejdź do logowania” → `/auth/login?returnTo=/plants/new` (spójnie z `CalendarDayView`).
- **422/400 VALIDATION_ERROR**
  - Jeśli backend zwróci `details.issues`: mapuj na błędy pól (`issue.path` → pole, `issue.message` → lista).
  - Jeśli brak `details`: pokaż ogólny błąd formularza i pozostaw walidację UI jako główne źródło błędów pól.
- **409 DUPLICATE_INDEX_CONFLICT**
  - Pokaż błąd globalny: „Konflikt numeracji duplikatów. Spróbuj ponownie.” + CTA Retry.
- **Network error**
  - Pokaż „Brak połączenia” + Retry.
- **500 / INTERNAL_SERVER_ERROR**
  - Pokaż ogólny komunikat + opcjonalnie requestId (jeśli meta wspiera).
- **Parse error (niepoprawny JSON z API)**
  - Pokaż błąd „Nie udało się przetworzyć odpowiedzi” + Retry.

### Mapowanie `details.field` (wymóg z UI plan)
UI plan zakłada błędy w formacie `details.field`. Backend dla roślin częściej zwraca `details.issues[]` (jak w `update-plant-request.ts`).
Zalecenie: wspieraj oba formaty:
- `details.field` → przypisz message do konkretnego pola
- `details.issues[]` → mapuj `issue.path` → pole, `issue.message` → lista

## 11. Kroki implementacji
1. **Routing**: utwórz `src/pages/plants/new.astro`, ustaw `prerender = false`, osadź `Layout` i `CreatePlantView client:load`.
2. **Komponenty React**: utwórz folder `src/components/plants/new/` i dodaj `CreatePlantView` + `CreatePlantForm` + `AiSuggestionToggle` (minimum).
3. **UI building blocks**:
   - Wariant A (preferowany): doinstaluj i dodaj brakujące komponenty shadcn (`Input`, `Textarea`, `Label`, `Switch`) wraz z zależnościami Radix.
   - Wariant B (szybszy MVP): użyj natywnych elementów + klasy Tailwind w obrębie widoku i dodaj shadcn później.
4. **Klient API**: rozbuduj `src/lib/services/plants/plants-client.ts` o `createPlant` (POST), analogicznie do `listPlants` oraz do klientów kalendarza/watering-tasks.
5. **Walidacja po stronie UI**: zaimplementuj funkcje:
   - `sanitizeCreatePlantValues(values) -> CreatePlantCommand`
   - `validateCreatePlant(values) -> CreatePlantFormErrors`
6. **Custom hook** (opcjonalnie, zalecane): dodaj `useCreatePlant` w `src/components/hooks/`, aby odseparować logikę od UI.
7. **AI UX**:
   - Dodaj „informację o limicie 20/h” (persist w localStorage po pierwszym wyświetleniu).
   - Dodaj cache `unlock_at` po `rate_limited` (localStorage) i wymuszaj OFF + disabled w kolejnych wejściach do widoku.
8. **Obsługa błędów**:
   - Dodaj mapowanie błędów API do `CreatePlantErrorVm`.
   - Dodaj inline field errors + error globalny (alert/card).
9. **Nawigacja po sukcesie**: po `201` wykonaj redirect do `/plants/:plantId/watering-plan`.
10. **A11y i UX**:
   - Label + aria-describedby dla błędów pól
   - `aria-invalid` dla pól z błędem
   - focus management: po nieudanym submit ustaw focus na pierwszym polu z błędem.

