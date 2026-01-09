## Plan implementacji widoku Edycja danych rośliny (`/plants/:plantId/edit`)

## 1. Przegląd
Widok **Edycja danych rośliny** umożliwia użytkownikowi aktualizację wyłącznie pól opcjonalnych rośliny: `nickname`, `description`, `purchase_date`, `photo_path`. Pole `species_name` jest **niemodyfikowalne w MVP** i ma być prezentowane jako **read-only** wraz z krótkim wyjaśnieniem.

Cele (zgodnie z US-010):
- Użytkownik może edytować pola opcjonalne bez zmiany `species_name`.
- Po zapisie zmiany są natychmiast widoczne (zaktualizowany obiekt rośliny w odpowiedzi PATCH + odświeżenie stanu UI / cache).
- Po sukcesie użytkownik widzi komunikat powodzenia („Zapisano”).

### Mapowanie US-010 → implementacja (kryteria akceptacji)
- **AC1: edycja tylko pól opcjonalnych, bez zmiany `species_name`**
  - `PlantEditForm`: `species_name` renderowane jako read-only + helper „nie można zmienić w MVP”
  - `buildUpdatePlantPayload`: payload zawiera wyłącznie `nickname|description|purchase_date|photo_path`, nigdy `species_name`
  - Obsługa `409 IMMUTABLE_FIELD` w `PlantEditView` jako błąd formularza (defense in depth)
- **AC2: zapis natychmiast aktualizuje szczegóły rośliny**
  - `updatePlant()` zwraca `PlantDetailDto` → `PlantEditView` aktualizuje `plant` + `initialValues`
  - (Opcjonalnie) invalidacja cache w `usePlantDetail` jeśli jest używany
  - (Opcjonalnie) po zapisie nawigacja do `/plants/:plantId` (jeśli widok szczegółów istnieje)
- **AC3: komunikat sukcesu po zapisie**
  - Lokalny `PlantEditSuccessToast` po 200
  - Alternatywnie: inline success banner, jeśli toast nie jest wdrożony globalnie

## 2. Routing widoku
- **Ścieżka**: `/plants/:plantId/edit`
- **Astro page**: `src/pages/plants/[plantId]/edit.astro`
  - `export const prerender = false`
  - renderuje komponent React `PlantEditView` z `client:load`

Uwagi dot. parametru:
- `plantId` musi być UUID; jeśli jest niepoprawny → stan błędu walidacji i CTA np. do `/plants` lub `/calendar`.

## 3. Struktura komponentów
Proponowana lokalizacja komponentów:
- `src/pages/plants/[plantId]/edit.astro`
- `src/components/plants/edit/PlantEditView.tsx`
- `src/components/plants/edit/PlantEditForm.tsx`
- `src/components/plants/edit/PlantEditSkeleton.tsx`
- `src/components/plants/edit/PlantEditErrorState.tsx`
- (opcjonalnie) `src/components/plants/edit/PlantEditSuccessToast.tsx` (lokalny „toast” bez globalnego systemu)

Zależne hooki/serwisy:
- `src/components/hooks/use-plant-detail.ts` (nowy)
- `src/components/hooks/use-update-plant.ts` (nowy) lub prostsza funkcja w `PlantEditView`
- `src/lib/services/plants/plants-client.ts` (rozszerzenie: `getPlantDetail`, `updatePlant`)

### Diagram drzewa komponentów (wysokopoziomowo)
- `PlantEditPage` (`edit.astro`)
  - `Layout`
    - `PlantEditView` (React, `client:load`)
      - `header` (tytuł + nawigacja wstecz)
      - `PlantEditSkeleton` (gdy `loading`)
      - `PlantEditErrorState` (gdy `error`)
      - `PlantEditForm` (gdy `success`)
        - Read-only `species_name`
        - Pola: `nickname`, `description`, `purchase_date`, `photo_path`
        - CTA: „Zapisz zmiany”, „Anuluj”
      - `PlantEditSuccessToast` (opcjonalnie, po PATCH 200)

## 4. Szczegóły komponentów

### `PlantEditPage` (`src/pages/plants/[plantId]/edit.astro`)
- **Opis**: Punkt wejścia routingu Astro. Odpowiada za pobranie `plantId` z URL oraz ustawienie tytułu strony. Renderuje React-view.
- **Główne elementy**:
  - `<Layout title="Roślina — edycja">`
  - `<PlantEditView plantId={...} client:load />`
- **Zdarzenia**: brak (statyczny wrapper).
- **Walidacja**:
  - Minimalna: przekazanie `plantId` jako string; właściwa walidacja w hooku/VM.
- **Typy**: `plantId: string`.
- **Props**:
  - `PlantEditView`: `{ plantId: string }`

### `PlantEditView` (`src/components/plants/edit/PlantEditView.tsx`)
- **Opis**: Kontener widoku: pobiera szczegóły rośliny, buduje ViewModel formularza, obsługuje submit PATCH, mapuje błędy i zarządza stanem (loading/error/success).
- **Główne elementy**:
  - `<main>` z layoutem Tailwind (np. `mx-auto max-w-3xl p-4 sm:p-6`)
  - Nagłówek strony: tytuł + link „← Powrót” (np. do `/plants/:plantId` jeśli istnieje, albo do `/calendar`)
  - Warunkowo:
    - `PlantEditSkeleton` podczas ładowania
    - `PlantEditErrorState` przy błędzie
    - `PlantEditForm` przy sukcesie pobrania danych
    - `PlantEditSuccessToast` (opcjonalnie) po zapisie
- **Obsługiwane zdarzenia**:
  - `onSubmit(values)` z `PlantEditForm`
  - `onCancel()` (np. nawigacja wstecz lub do `/plants/:plantId`)
  - `onRetry()` w error state
- **Walidacja (guard clauses)**:
  - Jeśli `plantId` nie jest UUID → nie wywoływać API GET, pokazać błąd walidacji (lokalnie).
  - Przed wysłaniem PATCH:
    - payload nie może zawierać `species_name`
    - payload musi zawierać przynajmniej 1 pole (po diffowaniu) albo zablokować submit
- **Typy (DTO/VM)**:
  - `PlantDetailDto` (GET/PATCH response)
  - `UpdatePlantCommand` (PATCH request payload)
  - `PlantEditFormValues` (ViewModel formularza)
  - `PlantEditViewState` (loading/error/success)
- **Props**:
  - `{ plantId: string }`

### `PlantEditForm` (`src/components/plants/edit/PlantEditForm.tsx`)
- **Opis**: Prezentacyjny formularz edycji. Renderuje pola, pokazuje błędy inline, blokuje submit podczas zapisu, komunikuje „brak zmian”.
- **Główne elementy HTML / children**:
  - `<form>`
  - Sekcja read-only:
    - `species_name` jako `<input readOnly disabled>` lub `<p>` w karcie + opis „nie można zmienić w MVP”
  - Pola edytowalne:
    - `nickname`: `<input type="text">`
    - `description`: `<textarea>`
    - `purchase_date`: `<input type="date">` (wartość `YYYY-MM-DD` lub pusty)
    - `photo_path`: `<input type="text">` + helper „wklej ścieżkę w Storage, nie URL”
  - CTA:
    - `Button type="submit"`: „Zapisz zmiany”
    - `Button type="button" variant="outline"`: „Anuluj”
  - Komunikaty:
    - inline error per pole
    - error ogólny formularza (np. `409 IMMUTABLE_FIELD`, `500`, brak połączenia)
    - mały tekst „Brak zmian do zapisania” (jeśli payload pusty)
- **Obsługiwane zdarzenia**:
  - `onChange` dla pól → aktualizacja `values`
  - `onSubmit` → delegacja do `PlantEditView`
  - `onCancel` → delegacja do `PlantEditView`
- **Walidacja (UI-side, zgodna z API)**:
  - `nickname`:
    - trim
    - jeśli niepusty: długość 1..80
    - jeśli pusty → traktuj jako `null` (czyszczenie)
  - `description`:
    - trim
    - jeśli niepusty: max 10_000
    - jeśli pusty → `null`
  - `purchase_date`:
    - jeśli ustawiona: format `YYYY-MM-DD` i poprawna data kalendarzowa
    - jeśli pusta → `null`
  - `photo_path`:
    - jeśli ustawiona: długość 1..500 po trim
    - **nie może** zaczynać się od `http://` lub `https://`
    - **nie może** zaczynać się od `/`
    - **nie może** zawierać `..`
    - **nie może** zawierać `\`
    - **nie może** zawierać `?` ani `#`
    - jeśli pusta → `null`
  - Submit:
    - zablokować, jeśli są błędy walidacji UI
    - zablokować, jeśli po diffowaniu nie ma żadnych zmian (żeby nie dostać 422)
- **Typy**:
  - `PlantEditFormValues`
  - `PlantEditFormErrors`
  - `PlantEditFormFieldErrors` (mapowanie `issues[]` z API)
- **Props (interfejs komponentu)**:
  - `initial: PlantEditFormValues` (do resetu / porównania)
  - `values: PlantEditFormValues`
  - `errors: PlantEditFormErrors | null`
  - `pending: boolean`
  - `onChange: (next: PlantEditFormValues) => void`
  - `onSubmit: (values: PlantEditFormValues) => void | Promise<void>`
  - `onCancel: () => void`

### `PlantEditErrorState` (`src/components/plants/edit/PlantEditErrorState.tsx`)
- **Opis**: Spójna prezentacja błędów ładowania/zapisu (404/401/422/500/network) z CTA.
- **Główne elementy**:
  - `Card` + opis błędu
  - przyciski:
    - „Spróbuj ponownie” (dla błędów nie-walidacyjnych)
    - „Zaloguj się” (dla 401) + `returnTo`
    - „Wróć do roślin” / „Wróć do kalendarza” (dla 404/walidacji)
- **Walidacja**: brak.
- **Typy**:
  - `PlantEditErrorVm`
- **Props**:
  - `error: PlantEditErrorVm`
  - `onRetry?: () => void`
  - `loginHref?: string`

### `PlantEditSkeleton` (`src/components/plants/edit/PlantEditSkeleton.tsx`)
- **Opis**: skeleton/placeholder na czas pobierania danych.
- **Główne elementy**: proste bloki `div` z klasami `animate-pulse`.
- **Props**: brak.

### `PlantEditSuccessToast` (opcjonalny, lokalny)
- **Opis**: Lokalny toast „Zapisano” (auto-hide np. po 3–4s) bez implementacji globalnego systemu toastów.
- **Zdarzenia**: `onDismiss`.
- **Props**:
  - `open: boolean`
  - `message: string` (domyślnie „Zapisano”)
  - `onOpenChange: (open: boolean) => void`

## 5. Typy

### DTO (istniejące, z backendu)
- **`PlantDetailDto`** (`src/types.ts`)
  - `plant.id: string`
  - `plant.species_name: string`
  - `plant.duplicate_index: number`
  - `plant.nickname: string | null`
  - `plant.description: string | null`
  - `plant.purchase_date: string | null` (ISO date `YYYY-MM-DD`)
  - `plant.photo_path: string | null`
  - `plant.display_name: string`
  - `active_watering_plan: WateringPlanSummaryDto | null`
- **`UpdatePlantCommand`** (`src/types.ts`) – payload PATCH
  - `nickname?: string | null`
  - `description?: string | null`
  - `purchase_date?: string | null`
  - `photo_path?: string | null`

### Nowe typy ViewModel (proponowane)
- **`PlantEditFormValues`**
  - `speciesName: string` (read-only, z DTO)
  - `nickname: string` (w UI puste = “brak”, na payload mapowane do `null`)
  - `description: string` (jw.)
  - `purchaseDate: string` (wartość dla `<input type="date">`: `YYYY-MM-DD` lub `''`)
  - `photoPath: string` (puste = `''`)
- **`PlantEditFieldKey`**
  - `'nickname' | 'description' | 'purchase_date' | 'photo_path' | 'form'`
- **`PlantEditFormErrors`**
  - `form?: string`
  - `fields?: Partial<Record<PlantEditFieldKey, string[]>>`
- **`PlantEditErrorVm`** (na potrzeby error state)
  - `kind: 'validation' | 'unauthenticated' | 'notFound' | 'network' | 'http' | 'parse' | 'unknown'`
  - `message: string`
  - `code?: string`
  - `requestId?: string` (jeśli meta zawiera `request_id`)
  - `fieldErrors?: Record<string, string[]>` (gdy 422)
- **`PlantEditDirtyState`**
  - `isDirty: boolean`
  - `changedFields: Array<keyof UpdatePlantCommand>`

### Funkcje mapujące (proponowane)
- `mapPlantDetailToFormValues(dto: PlantDetailDto): PlantEditFormValues`
  - mapuje `null` → `''` dla pól tekstowych i daty
- `buildUpdatePlantPayload(initial: PlantEditFormValues, current: PlantEditFormValues): UpdatePlantCommand`
  - wysyła **tylko zmienione pola**
  - zamienia `''` → `null` dla `nickname`, `purchase_date`, `photo_path` (żeby nie wpaść w walidację `min(1)` / ISO)
  - dla `description` również preferować `null` zamiast `''` (spójność)

## 6. Zarządzanie stanem

### Stan w `PlantEditView`
- **Fetch state**:
  - `status: 'idle' | 'loading' | 'success' | 'error'`
  - `plant?: PlantDetailDto`
  - `error?: PlantEditErrorVm`
- **Form state**:
  - `initialValues: PlantEditFormValues` (ustawiane po udanym GET oraz po udanym PATCH)
  - `values: PlantEditFormValues`
  - `fieldErrors: PlantEditFormErrors | null`
  - `isSaving: boolean`
  - `saveSuccessOpen: boolean` (dla toasta lokalnego)

### Custom hooki (rekomendowane, spójne z repo)
- **`usePlantDetail({ plantId })`**
  - odpowiedzialny za:
    - walidację UUID (guard)
    - pobranie danych GET (AbortController, retry)
    - mapowanie błędów do `PlantEditErrorVm`
    - (opcjonalnie) prosty cache in-memory, analogicznie do `useCalendarDay`
- **`useUpdatePlant({ plantId, onSuccess })`** (opcjonalny)
  - enkapsuluje logikę PATCH, pending i mapowanie 422 → `fieldErrors`

Uwaga: jeśli zależy na minimalizmie, `useUpdatePlant` można pominąć i trzymać logikę PATCH w `PlantEditView`.

## 7. Integracja API

### Wymagane wywołania
1) **GET `/api/plants/{plantId}`** (do prefill formularza)
- **Response**: `ApiEnvelope<PlantDetailDto>`
- **Uwaga implementacyjna**: w repo istnieje logika serwisowa `getPlantDetail`, ale endpoint GET może wymagać dopisania (jeśli nie istnieje). Widok edycji zakłada dostępność GET.

2) **PATCH `/api/plants/{plantId}`** (zapis zmian)
- **Request body**: `UpdatePlantCommand`
  - wysyłać tylko zmienione pola; dopuszczać `null` (czyszczenie)
  - **nigdy** nie wysyłać `species_name`
  - nie wysyłać pustego payloadu
- **Response 200**: `ApiEnvelope<PlantDetailDto>` (zaktualizowany szczegół rośliny)

### Błędy do obsłużenia (kontrakt)
- `401 UNAUTHENTICATED`: pokaż komunikat + CTA do logowania z `returnTo`
- `404 PLANT_NOT_FOUND`: błąd „Nie znaleziono rośliny”
- `422 VALIDATION_ERROR`: mapuj `details.issues[]` na błędy pól
- `409 IMMUTABLE_FIELD`: pokaż czytelny błąd formularza („Nazwa gatunku jest niemodyfikowalna”)
- `400 INVALID_JSON` / `INVALID_PLANT_ID`: traktować jako błąd walidacji (problem URL lub payloadu)
- Błędy sieci/parse/500: ogólny error state + retry

## 8. Interakcje użytkownika
- **Wejście na stronę**:
  - UI pokazuje skeleton
  - po GET: formularz z wypełnionymi danymi (nullable → puste)
- **Edycja pól**:
  - wartości aktualizują `values`
  - UI wskazuje (opcjonalnie) „Zmieniono” / dirty state
- **Zapis zmian**:
  - klik „Zapisz zmiany”:
    - walidacja UI
    - budowa payload diff
    - request PATCH
  - podczas zapisu:
    - blokada submit i/lub całego formularza
    - ewentualny wskaźnik ładowania (np. spinner w przycisku)
  - po sukcesie:
    - toast „Zapisano”
    - aktualizacja `initialValues` na podstawie odpowiedzi (żeby dirty=false)
    - (opcjonalnie) link „Wróć do szczegółów”
- **Anuluj**:
  - jeśli `isDirty=false` → nawigacja wstecz
  - jeśli `isDirty=true` → (opcjonalnie) modal potwierdzenia „Masz niezapisane zmiany”

## 9. Warunki i walidacja

### Warunki wymagane przez API i weryfikacja w UI
- **Co najmniej jedno pole w PATCH**:
  - w UI: wylicz `changedFields` i wyłącz submit, jeśli puste
- **`nickname`**:
  - w UI: trim; jeśli niepusty, 1..80; jeśli pusty → `null`
- **`description`**:
  - w UI: trim; max 10_000; jeśli pusty → `null`
- **`purchase_date`**:
  - w UI: `''` → `null`; w innym wypadku `YYYY-MM-DD` i poprawna data
- **`photo_path`**:
  - w UI: `''` → `null`; w innym wypadku:
    - długość 1..500
    - nie URL (`http(s)://`)
    - relative (nie zaczyna się od `/`)
    - brak `..`, `\`, `?`, `#`
- **`species_name` immutable**:
  - w UI: pole read-only + nigdy nie dodawać do payloadu
  - obsłużyć `409 IMMUTABLE_FIELD` jako błąd formularza (defense in depth)

## 10. Obsługa błędów

### Scenariusze i rekomendowana reakcja UI
- **Niepoprawny `plantId` w URL (nie-UUID)**:
  - `PlantEditErrorState` z komunikatem „Niepoprawny identyfikator rośliny” + CTA do bezpiecznej trasy (np. `/calendar`)
- **401 UNAUTHENTICATED**:
  - komunikat „Sesja wygasła”
  - CTA „Zaloguj się” z `returnTo=/plants/:plantId/edit`
- **404 PLANT_NOT_FOUND**:
  - komunikat „Nie znaleziono rośliny”
  - CTA do listy roślin (jeśli istnieje) lub do `/calendar`
- **422 VALIDATION_ERROR**:
  - mapowanie `details.issues[]`:
    - `nickname`, `description`, `purchase_date`, `photo_path` → błędy pól
    - `(body)` / `form` → błąd ogólny (np. „At least one field must be provided”)
- **409 IMMUTABLE_FIELD**:
  - błąd ogólny formularza: „Nie można zmienić nazwy gatunku w MVP”
- **Network error**:
  - banner/alert „Brak połączenia” + retry (bez utraty wpisanych wartości)
- **500 / parse / unknown**:
  - komunikat ogólny + retry; log do `console.error` w dev

## 11. Kroki implementacji
1. **Dodać routing strony Astro**:
   - utworzyć `src/pages/plants/[plantId]/edit.astro`
   - wpiąć `Layout` i `PlantEditView client:load`
2. **Dodać warstwę klienta API dla roślin**:
   - rozszerzyć `src/lib/services/plants/plants-client.ts` o:
     - `getPlantDetail({ plantId })`
     - `updatePlant({ plantId, payload })`
   - ujednolicić obsługę envelope i błędów (analogicznie do `calendar/*-client.ts`)
3. **Dodać hook `usePlantDetail`**:
   - walidacja UUID, abort, retry
   - mapowanie błędów do `PlantEditErrorVm`
4. **Zbudować ViewModel formularza**:
   - `mapPlantDetailToFormValues`
   - `buildUpdatePlantPayload` (diff + konwersje `''` → `null`)
5. **Zaimplementować `PlantEditView`**:
   - renderowanie skeleton/error/form
   - submit PATCH, pending state, aktualizacja local state po sukcesie
6. **Zaimplementować `PlantEditForm`**:
   - pola + helper teksty
   - walidacja UI zgodna z API
   - blokady submit (pending/invalid/no-changes)
7. **Dodać komunikat sukcesu**:
   - minimalny lokalny toast „Zapisano” (auto-hide) albo inline success banner (jeśli toast nie jest globalnie dostępny)
8. **Obsłużyć edge-case’y**:
   - 409 IMMUTABLE_FIELD, 422 issues mapowanie na pola, 401 redirect
9. **Integracja nawigacyjna (opcjonalnie, ale zalecane)**:
   - dodać link „Edytuj” w przyszłym widoku szczegółów rośliny (`/plants/:plantId`)
   - dodać „Powrót” z edycji do szczegółów

