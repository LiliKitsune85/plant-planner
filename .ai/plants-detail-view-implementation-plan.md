## Plan implementacji widoku „Szczegóły rośliny” (`/plants/:plantId`)

## 1. Przegląd
Widok **Szczegóły rośliny** pozwala użytkownikowi zobaczyć dane rośliny i jej **aktywny plan podlewania** (lub stan „Brak planu”) oraz wykonać kluczowe akcje:
- **Zobacz w kalendarzu** (deep link do dnia: dziś lub najbliższe zadanie – zgodnie z `ui-plan.md`)
- **Zmień plan** (przejście do flow ustawiania/edycji planu)
- **Podlej dzisiaj** (adhoc – utworzenie wpisu na dziś)
- **Edytuj** (przejście do edycji pól opcjonalnych)
- **Usuń** (akcja destrukcyjna z osobnym potwierdzeniem)

Widok spełnia wymagania US-013, z uwzględnieniem zasad bezpieczeństwa i UX z `ui-plan.md`:
- pokazuje `display_name` + opcjonalnie `nickname`, zdjęcie (jeśli jest) i stan/parametry aktywnego planu,
- udostępnia akcje: „Zobacz w kalendarzu”, „Zmień plan”, „Podlej dzisiaj”, „Edytuj”, „Usuń”,
- uwzględnia fakt, że `species_name` jest **niemodyfikowalne** (immutable) i `display_name` może zawierać numer duplikatu.

## 2. Routing widoku
- **Ścieżka**: `/plants/:plantId`
- **Plik routingu (Astro)**: `src/pages/plants/[plantId]/index.astro`
- **Renderowanie**: SSR (hybrydowo), `export const prerender = false`
- **Parametry path**:
  - `plantId` (wymagany): UUID (walidacja UI-side)

### Normalizacja i walidacja parametru `plantId` (w warstwie routingu Astro)
- Strona powinna:
  - odczytać `plantId` z `Astro.params`,
  - wykonać minimalną walidację UUID (regex) – jeśli niepoprawny:
    - ustawić tytuł strony „Roślina — niepoprawny identyfikator”
    - przekazać `plantId` do React i pozwolić UI pokazać spójny stan walidacji (jedno źródło prawdy dla komunikatów).

## 3. Struktura komponentów
### Proponowana struktura plików
- Routing:
  - `src/pages/plants/[plantId]/index.astro`
- Komponenty widoku:
  - `src/components/plants/detail/PlantDetailView.tsx`
  - `src/components/plants/detail/PlantDetailHeader.tsx`
  - `src/components/plants/detail/PlantIdentityCard.tsx`
  - `src/components/plants/detail/PlantPhoto.tsx`
  - `src/components/plants/detail/PlantPlanSection.tsx`
  - `src/components/plants/detail/ActivePlanCard.tsx`
  - `src/components/plants/detail/NoPlanCard.tsx`
  - `src/components/plants/detail/PlantActionsBar.tsx`
  - `src/components/plants/detail/WaterTodayDialog.tsx` (opcjonalnie; jeśli „Podlej dzisiaj” ma notatkę)
  - `src/components/plants/detail/DeletePlantDialog.tsx`
  - `src/components/plants/detail/PlantDetailSkeleton.tsx`
  - `src/components/plants/detail/PlantDetailErrorState.tsx`
  - `src/components/plants/detail/types.ts` (ViewModel + typy lokalne)
- Hooki:
  - `src/components/hooks/use-plant-detail.ts`
  - `src/components/hooks/use-plant-detail-mutations.ts` (mutacje: adhoc + delete)
- Klient API (frontend):
  - `src/lib/services/plants/plants-client.ts` (rozszerzenie) lub nowy plik `src/lib/services/plants/plant-detail-client.ts`
  - (reuse) `src/lib/services/watering-tasks/adhoc-client.ts` dla „Podlej dzisiaj”

### Wysokopoziomowy diagram drzewa komponentów
```
src/pages/plants/[plantId]/index.astro
└─ <Layout>
   └─ <PlantDetailView client:load plantId />
      ├─ <PlantDetailHeader />
      ├─ <PlantDetailStateBoundary>
      │  ├─ <PlantDetailSkeleton /> (loading)
      │  ├─ <PlantDetailErrorState /> (error + retry/CTA)
      │  └─ <PlantDetailContent>
      │     ├─ <PlantIdentityCard>
      │     │  └─ <PlantPhoto />
      │     ├─ <PlantPlanSection>
      │     │  ├─ <ActivePlanCard /> (gdy active_watering_plan != null)
      │     │  └─ <NoPlanCard /> (gdy active_watering_plan == null)
      │     └─ <PlantActionsBar>
      │        ├─ CTA: Zobacz w kalendarzu
      │        ├─ CTA: Podlej dzisiaj (→ dialog lub 1-click)
      │        ├─ CTA: Edytuj (link)
      │        └─ CTA: Usuń (→ <DeletePlantDialog />)
      └─ <InlineAlertArea /> (np. request_id, błędy mutacji)
```

## 4. Szczegóły komponentów
### `src/pages/plants/[plantId]/index.astro`
- **Opis komponentu**: Punkt wejścia routingu `/plants/:plantId`. Ustala tytuł strony, normalizuje `plantId` i montuje React island.
- **Główne elementy HTML**: `<Layout>`, `<PlantDetailView client:load />`.
- **Obsługiwane zdarzenia**: n/a.
- **Warunki walidacji**:
  - `plantId` powinien mieć format UUID (wstępnie); w przeciwnym razie UI pokaże stan walidacji.
- **Typy**: n/a (proste propsy).
- **Propsy**:

```ts
export type PlantDetailPageProps = {
  plantId: string
}
```

### `PlantDetailView` (`src/components/plants/detail/PlantDetailView.tsx`)
- **Opis komponentu**: Kontener widoku. Odpowiada za:
  - fetch szczegółów rośliny (`GET /api/plants/{plantId}`),
  - render stanów (loading/empty/error/success),
  - obsługę mutacji „Podlej dzisiaj” i „Usuń”,
  - nawigację do: kalendarza, zmiany planu, edycji rośliny.
- **Główne elementy HTML**:
  - `<main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6" aria-live="polite">`
  - nagłówek + sekcje kart.
- **Obsługiwane zdarzenia**:
  - `onRetryLoad()` → ponowny fetch szczegółów,
  - `onWaterToday()` → stworzenie wpisu adhoc na dziś,
  - `onDeleteConfirmed()` → `DELETE /api/plants/{plantId}?confirm=true`,
  - klik CTA do nawigacji (linki).
- **Warunki walidacji (UI-side, zgodne z API)**:
  - `plantId` musi być UUID przed wykonaniem requestów (w przeciwnym razie: stan walidacji),
  - podczas mutacji (adhoc/delete) blokada przycisków (anti double-submit),
  - „Podlej dzisiaj”:
    - `completed_on` w formacie ISO `YYYY-MM-DD` (dzisiejsza data),
    - `note` opcjonalne, max 500 znaków.
- **Typy (DTO i ViewModel)**:
  - DTO: `PlantDetailDto`, `AdhocWateringCommand`, `AdhocWateringResultDto`, `DeletePlantResultDto` (`src/types.ts`)
  - VM: `PlantDetailVm`, `PlantDetailErrorVm`, `PlantDetailMutationErrorVm` (sekcja 5).
- **Propsy**:

```ts
export type PlantDetailViewProps = {
  plantId: string
}
```

### `PlantDetailHeader` (`src/components/plants/detail/PlantDetailHeader.tsx`)
- **Opis komponentu**: Nagłówek widoku + nawigacja wstecz (np. do listy roślin lub kalendarza).
- **Główne elementy HTML**:
  - `<header className="flex items-start justify-between gap-4">`
  - `<h1>`: tytuł (np. „Szczegóły rośliny”)
  - `<a>`: link „Wróć” (wariant: do `/plants`, jeśli lista istnieje; inaczej do `/calendar`)
- **Obsługiwane zdarzenia**: klik linku „Wróć”.
- **Warunki walidacji**: n/a.
- **Typy**: `string`.
- **Propsy**:

```ts
export type PlantDetailHeaderProps = {
  backHref: string
}
```

### `PlantIdentityCard` (`src/components/plants/detail/PlantIdentityCard.tsx`)
- **Opis komponentu**: Karta z informacjami o roślinie: zdjęcie (jeśli jest), `display_name`, `nickname`, oraz krótkie meta (np. `purchase_date`, `description`).
- **Główne elementy HTML**:
  - shadcn/ui `Card` + `CardHeader`/`CardContent`
  - `<dl>` dla metadanych (czytelne etykiety).
- **Obsługiwane zdarzenia**:
  - (opcjonalnie) klik „Dodaj/Zmień zdjęcie” → otwarcie upload flow.
- **Warunki walidacji**:
  - `display_name` zawsze renderowane (wymagane w UX),
  - `nickname/description/purchase_date/photo_path` renderowane warunkowo,
  - sekcja „Duplikaty”: informacja, że `display_name` może zawierać `#n`, a `species_name` jest niezmienne.
- **Typy**:
  - `PlantDetailVm['plant']`
- **Propsy**:

```ts
export type PlantIdentityCardProps = {
  plant: PlantDetailVm['plant']
}
```

### `PlantPhoto` (`src/components/plants/detail/PlantPhoto.tsx`)
- **Opis komponentu**: Render zdjęcia rośliny lub placeholdera.
- **Główne elementy HTML**:
  - `<img>` (lub placeholder div/Avatar) z sensownym `alt`.
- **Obsługiwane zdarzenia**: n/a (w MVP).
- **Warunki walidacji**:
  - `photo_path` traktować jako identyfikator ścieżki, nie zakładać że to publiczny URL (MVP: placeholder jeśli brak mechanizmu budowy URL).
- **Typy**: `photoPath: string | null`, `alt: string`.
- **Propsy**:

```ts
export type PlantPhotoProps = {
  photoPath: string | null
  alt: string
}
```

### `PlantPlanSection` (`src/components/plants/detail/PlantPlanSection.tsx`)
- **Opis komponentu**: Sekcja podsumowania aktywnego planu albo pusty stan „Brak planu”.
- **Główne elementy HTML**:
  - `<section aria-labelledby="plan-title">`
  - `Card` z tytułem i treścią zależną od stanu.
- **Obsługiwane zdarzenia**:
  - klik CTA „Zmień plan”,
  - klik CTA „Wygeneruj AI” / „Ustaw ręcznie” (gdy brak planu).
- **Warunki walidacji**:
  - jeżeli `active_watering_plan` jest `null` → render `NoPlanCard`,
  - jeżeli plan istnieje → render `ActivePlanCard`.
- **Typy**:
  - `PlantDetailVm['activePlan']`
- **Propsy**:

```ts
export type PlantPlanSectionProps = {
  activePlan: PlantDetailVm['activePlan']
  changePlanHref: string
  generateAiHref: string
  setManualHref: string
}
```

### `ActivePlanCard` (`src/components/plants/detail/ActivePlanCard.tsx`)
- **Opis komponentu**: Podsumowanie aktywnego planu podlewania + CTA „Zmień plan”.
- **Główne elementy HTML**:
  - `CardContent` z:
    - głównym komunikatem: np. „Podlewaj co {interval_days} dni”
    - listą parametrów (np. `start_from` + `custom_start_on`, `overdue_policy`, `schedule_basis`, `horizon_days`)
    - badge/label „AI” jeśli `was_ai_suggested=true` + informacja czy zaakceptowano bez zmian.
  - `CardFooter` z przyciskiem.
- **Obsługiwane zdarzenia**:
  - `onChangePlan` (nawigacja).
- **Warunki walidacji**:
  - `interval_days` jest liczbą (API gwarantuje), ale UI powinno bezpiecznie renderować fallback gdy brak (defensive).
- **Typy**:
  - `WateringPlanSummaryDto` (przez VM)
- **Propsy**:

```ts
export type ActivePlanCardProps = {
  plan: NonNullable<PlantDetailVm['activePlan']>
  changePlanHref: string
}
```

### `NoPlanCard` (`src/components/plants/detail/NoPlanCard.tsx`)
- **Opis komponentu**: Pusty stan, gdy roślina nie ma aktywnego planu.
- **Główne elementy HTML**:
  - komunikat „Brak aktywnego planu podlewania”
  - CTA:
    - „Wygeneruj AI”
    - „Ustaw ręcznie”
- **Obsługiwane zdarzenia**: klik CTA (nawigacja).
- **Warunki walidacji**: n/a.
- **Typy**: `href` string.
- **Propsy**:

```ts
export type NoPlanCardProps = {
  generateAiHref: string
  setManualHref: string
}
```

### `PlantActionsBar` (`src/components/plants/detail/PlantActionsBar.tsx`)
- **Opis komponentu**: Zestaw głównych akcji użytkownika (CTA) – zgodnie z US-013.
- **Główne elementy HTML**:
  - `<section aria-label="Akcje rośliny">`
  - shadcn/ui `Button` + linki.
- **Obsługiwane zdarzenia**:
  - „Zobacz w kalendarzu” (nawigacja),
  - „Podlej dzisiaj” (mutacja),
  - „Edytuj” (nawigacja),
  - „Usuń” (otwarcie dialogu).
- **Warunki walidacji**:
  - blokada przycisków podczas `pending` mutacji,
  - „Podlej dzisiaj” disabled jeśli trwa request lub jeśli UI rozpoznaje, że już wykonano wpis dzisiaj (opcjonalne; MVP: polega na 409 z API).
- **Typy**:
  - `PlantActionsVm` (sekcja 5)
- **Propsy**:

```ts
export type PlantActionsBarProps = {
  calendarHref: string
  editHref: string
  pendingWaterToday: boolean
  pendingDelete: boolean
  onWaterToday: () => void
  onDeleteClick: () => void
}
```

### `DeletePlantDialog` (`src/components/plants/detail/DeletePlantDialog.tsx`)
- **Opis komponentu**: Potwierdzenie usunięcia rośliny (akcja destrukcyjna).
- **Główne elementy HTML**:
  - shadcn/ui `Modal` (lub dedykowany ConfirmDialog), tekst ostrzegawczy + checkbox/treść potwierdzająca.
- **Obsługiwane zdarzenia**:
  - `onConfirm()` → wysyła `DELETE /api/plants/{plantId}?confirm=true`,
  - `onCancel()` → zamyka dialog.
- **Warunki walidacji**:
  - wymagane osobne potwierdzenie w UI (np. checkbox „Rozumiem, że operacja jest nieodwracalna”) – niezależnie od wymogu `confirm=true` po stronie API,
  - blokada przycisków podczas requestu.
- **Typy**:
  - `DeletePlantResultDto`, `PlantDetailMutationErrorVm`
- **Propsy**:

```ts
export type DeletePlantDialogProps = {
  open: boolean
  plantDisplayName: string
  pending: boolean
  error?: PlantDetailMutationErrorVm | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
}
```

### `PlantDetailErrorState` (`src/components/plants/detail/PlantDetailErrorState.tsx`)
- **Opis komponentu**: Spójna prezentacja błędów (walidacja/unauthenticated/not found/http/network/parse).
- **Główne elementy HTML**:
  - `Card`/`div` z `role="status"`,
  - CTA zależne od `error.kind` (retry/login/back).
- **Obsługiwane zdarzenia**:
  - retry,
  - przejście do logowania,
  - powrót do listy roślin/kalendarza.
- **Warunki walidacji**: n/a.
- **Typy**:
  - `PlantDetailErrorVm`
- **Propsy**:

```ts
export type PlantDetailErrorStateProps = {
  error: PlantDetailErrorVm
  onRetry?: () => void
  loginHref?: string
  backHref?: string
}
```

## 5. Typy
### DTO (istniejące – używamy bez zmian)
Z `src/types.ts`:
- `PlantDetailDto`:
  - `plant`: `id`, `species_name`, `duplicate_index`, `display_name`, `nickname`, `description`, `purchase_date`, `photo_path`
  - `active_watering_plan`: `WateringPlanSummaryDto | null`
- `WateringPlanSummaryDto` (parametry planu + metadane AI)
- `AdhocWateringCommand` (`completed_on`, `note`)
- `AdhocWateringResultDto`
- `DeletePlantResultDto`

### Nowe typy (ViewModel / frontend)
Rekomendowane w `src/components/plants/detail/types.ts`:

```ts
export type PlantDetailVm = {
  plant: {
    id: string
    displayName: string
    speciesName: string
    duplicateIndex: number
    nickname: string | null
    description: string | null
    purchaseDate: string | null
    photoPath: string | null
  }
  activePlan: {
    id: string
    intervalDays: number
    horizonDays: number
    scheduleBasis: 'due_on' | 'completed_on'
    startFrom: 'today' | 'purchase_date' | 'custom_date'
    customStartOn: string | null
    overduePolicy: 'carry_forward' | 'reschedule'
    wasAiSuggested: boolean
    wasAiAcceptedWithoutChanges: boolean | null
    aiRequestId: string | null
  } | null
}

export type PlantDetailErrorVm = {
  kind:
    | 'validation'
    | 'unauthenticated'
    | 'notFound'
    | 'network'
    | 'parse'
    | 'http'
    | 'unknown'
  message: string
  code?: string
  status?: number
  requestId?: string
  details?: unknown
}

export type PlantDetailMutationErrorVm = {
  kind: 'validation' | 'conflict' | 'unauthenticated' | 'notFound' | 'network' | 'parse' | 'http' | 'unknown'
  message: string
  code?: string
  requestId?: string
  fieldErrors?: Record<string, string[]>
  details?: unknown
}

export type PlantActionsVm = {
  calendarHref: string
  editHref: string
  changePlanHref: string
  generateAiHref: string
  setManualHref: string
}
```

### Funkcje mapujące (VM builder)
Rekomendowane helpery w `src/lib/services/plants/detail-view-model.ts`:
- `isValidPlantId(plantId: string): boolean` (UUID)
- `mapPlantDetailDtoToVm(dto: PlantDetailDto): PlantDetailVm`
- `buildPlantDetailErrorVm(error: unknown): PlantDetailErrorVm` (na podstawie errorów klienta API)
- `buildPlantActionsVm(plantId: string): PlantActionsVm` (hrefy do powiązanych widoków)

## 6. Zarządzanie stanem
### Podejście
Spójnie z istniejącymi wzorcami (kalendarz):
- fetch i klasyfikacja błędów w kliencie API (warstwa `src/lib/services/.../*-client.ts`),
- stan widoku i anulowanie requestów w custom hooku (`src/components/hooks`),
- komponenty React utrzymują minimalny state UI: otwarcie dialogów, pending mutacji, ewentualne local error.

### Hook: `usePlantDetail`
Lokalizacja: `src/components/hooks/use-plant-detail.ts`
- **Cel**: pobrać `PlantDetailDto` i zbudować `PlantDetailVm`.
- **Stan** (analogicznie do `useCalendarDay`):
  - `status: 'idle' | 'loading' | 'success' | 'error'`
  - `data?: PlantDetailVm`
  - `error?: PlantDetailErrorVm`
  - `requestId?: string`
- **Zasady**:
  - walidacja UUID przed fetch,
  - AbortController + ignore results po unmount,
  - prosty cache w module (Map key = plantId) + `invalidatePlantDetailCacheById(plantId)` po mutacjach.

### Hook: `usePlantDetailMutations`
Lokalizacja: `src/components/hooks/use-plant-detail-mutations.ts`
- **Cel**: dostarczyć mutacje dla akcji z widoku:
  - `waterToday(plantId)` → `POST /api/plants/{plantId}/watering/adhoc`
  - `deletePlant(plantId)` → `DELETE /api/plants/{plantId}?confirm=true`
- **Stan**:
  - `pendingWaterToday: boolean`
  - `pendingDelete: boolean`
  - `error: PlantDetailMutationErrorVm | null`
- **Zasady UX**:
  - blokady przycisków podczas requestów,
  - mapowanie błędów 409 `TASK_ALREADY_EXISTS` na komunikat „Dla dzisiaj już istnieje wpis” + CTA do kalendarza dnia,
  - po sukcesie:
    - `waterToday`: invalidacja cache kalendarza dla dnia (dzisiaj) i miesiąca (dzisiejszy miesiąc),
    - `deletePlant`: redirect do `/plants` (jeśli lista istnieje) albo fallback do `/calendar`.

## 7. Integracja API
### Wymagane endpointy
- `GET /api/plants/{plantId}` — pobranie szczegółów rośliny i aktywnego planu.
- `POST /api/plants/{plantId}/watering/adhoc` — utworzenie wpisu adhoc na dziś.

### Powiązane endpointy (dla akcji w UI)
- `DELETE /api/plants/{plantId}?confirm=true` — usuwanie rośliny (z potwierdzeniem).
- (nawigacja) `/plants/{plantId}/watering-plan` — zmiana planu (widok sugerowania/edycji planu).
- (nawigacja) `/plants/{plantId}/edit` — edycja rośliny (pola opcjonalne).

### Typy żądania i odpowiedzi
- **GET**:
  - response `200`: envelope `{ data: PlantDetailDto, error: null }`
  - errors:
    - `401 UNAUTHENTICATED`
    - `404 NOT_FOUND` (w praktyce spodziewane `PLANT_NOT_FOUND`)
- **POST adhoc**:
  - request body: `AdhocWateringCommand`:
    - `completed_on: 'YYYY-MM-DD'` (w tym widoku: dzisiejsza data)
    - `note: string | null` (opcjonalnie; default null)
  - response `201`: `AdhocWateringResultDto`
  - errors:
    - `400 VALIDATION_ERROR` / `INVALID_PLANT_ID`
    - `401 UNAUTHENTICATED`
    - `409 TASK_ALREADY_EXISTS`

### Klient API (frontend) – zalecany zakres
1) Dodać w `src/lib/services/plants/plants-client.ts` funkcję:
- `getPlantDetail(plantId, { signal }) => { data: PlantDetailDto; requestId?: string }`
2) Dodać w tym samym kliencie (lub osobnym pliku) funkcję:
- `deletePlant(plantId, { signal }) => { data: DeletePlantResultDto; requestId?: string }`
3) Wykorzystać istniejący `createAdhocWateringEntry` z `src/lib/services/watering-tasks/adhoc-client.ts`.

### Uwaga o stanie repo (zależność backendowa)
Serwis backendowy `getPlantDetail(...)` istnieje (`src/lib/services/plants/get-plant-detail.ts`), ale w `src/pages/api/plants/[plantId]/index.ts` obecnie są tylko handlery `PATCH` i `DELETE`. Aby frontend mógł wywołać `GET /api/plants/{plantId}`, potrzebny jest handler `GET` w tym pliku (z mapowaniem do `PlantDetailDto` analogicznym jak w `update-plant.ts`).

## 8. Interakcje użytkownika
- **Wejście na `/plants/:plantId`**:
  - UI pokazuje skeleton, pobiera dane, potem renderuje szczegóły lub error state.
- **„Zobacz w kalendarzu”**:
  - MVP: link do `/calendar/day/<dzisiaj>`
  - Docelowo (zgodnie z `ui-plan.md`): deep link do „dziś lub najbliższe zadanie” (patrz sekcja 11 – krok rozszerzony).
- **„Zmień plan”**:
  - nawigacja do `/plants/:plantId/watering-plan`
- **„Podlej dzisiaj”**:
  - 1-click lub dialog z opcjonalną notatką → `POST /api/plants/{plantId}/watering/adhoc` z `completed_on=today`.
  - po sukcesie: toast „Zapisano podlewanie” + (opcjonalnie) CTA „Zobacz w kalendarzu”.
  - w razie `409 TASK_ALREADY_EXISTS`: komunikat „Na dziś istnieje już wpis podlewania”.
- **„Edytuj”**:
  - nawigacja do `/plants/:plantId/edit` (zablokowana zmiana `species_name` – informacja UX).
- **„Usuń”**:
  - otwarcie dialogu z ostrzeżeniem i potwierdzeniem,
  - po potwierdzeniu: `DELETE /api/plants/{plantId}?confirm=true`,
  - po sukcesie: toast + redirect do listy roślin.

## 9. Warunki i walidacja
### Warunki wymagane przez API i weryfikowane w UI
- **`plantId`**:
  - UI: walidacja UUID przed wykonaniem `GET/POST/DELETE` (inaczej: error kind=`validation`).
- **GET `/api/plants/{plantId}`**:
  - UI: obsługa `401` (CTA do logowania) i `404` (CTA do `/plants`).
- **POST adhoc**:
  - `completed_on`:
    - UI: zawsze wysyła dzisiejszą datę w formacie `YYYY-MM-DD` (można korzystać z helperów dat w `src/lib/utils/date.ts`)
  - `note`:
    - UI: `null` lub string po `trim()`, max 500 znaków.
- **DELETE plant**:
  - UI: zawsze wysyła `confirm=true`,
  - UI: dodatkowe potwierdzenie w dialogu (ochrona przed przypadkowym kliknięciem).

### Wpływ walidacji na stan interfejsu
- `validation` (np. zły `plantId`) → `PlantDetailErrorState` z komunikatem i CTA „Wróć”.
- `unauthenticated` → CTA do `/auth/login?returnTo=<current>` (jeśli mechanizm returnTo jest stosowany w aplikacji).
- `notFound` → CTA do `/plants` (lub `/calendar` jako fallback).
- `TASK_ALREADY_EXISTS` → toast/błąd inline + CTA do kalendarza dnia (dzisiaj).

## 10. Obsługa błędów
### Potencjalne scenariusze błędów i obsługa
- **401 UNAUTHENTICATED**:
  - komunikat „Sesja wygasła” + CTA do logowania.
- **404 PLANT_NOT_FOUND / NOT_FOUND**:
  - komunikat „Nie znaleziono rośliny lub nie masz dostępu” + CTA do `/plants`.
- **409 TASK_ALREADY_EXISTS** (podczas „Podlej dzisiaj”):
  - komunikat „Dla dzisiaj istnieje już wpis podlewania” + CTA do `/calendar/day/<today>`.
- **400/422 VALIDATION_ERROR** (adhoc):
  - mapowanie `details.issues[]` na `fieldErrors` (jeśli używany dialog/notatka),
  - utrzymanie wartości formularza.
- **Błędy sieci (`network`)**:
  - komunikat „Brak połączenia” + retry.
- **Błędy parsowania (`parse`)**:
  - komunikat „Nie udało się przetworzyć odpowiedzi serwera” + retry.
- **5xx / `http`**:
  - komunikat ogólny + (opcjonalnie) pokaz `request_id` jeśli jest dostępny w meta.

## 11. Kroki implementacji
1. **Dodać routing strony**:
   - utworzyć `src/pages/plants/[plantId]/index.astro`,
   - `export const prerender = false`,
   - użyć `Layout` i osadzić `<PlantDetailView client:load plantId={...} />`,
   - ustawić tytuł strony zależnie od walidacji `plantId`.
2. **Dodać/ustalić kontrakt klienta API dla szczegółów**:
   - dodać `getPlantDetail(plantId)` w `src/lib/services/plants/plants-client.ts`,
   - dodać klasyfikację błędów (co najmniej: validation/http/network/parse/unknown; rekomendowane rozszerzyć o unauthenticated/notFound).
3. **Zaimplementować hook `usePlantDetail`**:
   - analogicznie do `useCalendarDay`: walidacja UUID, AbortController, state machine, cache + `invalidatePlantDetailCacheById`.
4. **Dodać ViewModel**:
   - `src/components/plants/detail/types.ts` + mapper z DTO do VM,
   - helpery do budowy hrefów (kalendarz/edycja/plan).
5. **Zaimplementować mutacje widoku**:
   - dodać `usePlantDetailMutations`:
     - `waterToday` bazując na `createAdhocWateringEntry(plantId, { completed_on: today, note: null })`,
     - `deletePlant` przez nowy klient `deletePlant(plantId)` (DELETE + confirm=true),
     - invalidacja cache kalendarza (dzień/miesiąc) po `waterToday`,
     - redirect po `deletePlant`.
6. **Zaimplementować komponenty UI**:
   - `PlantDetailView` + `PlantDetailSkeleton` + `PlantDetailErrorState`,
   - `PlantIdentityCard` (display_name + nickname + meta),
   - `PlantPlanSection` z `ActivePlanCard`/`NoPlanCard`,
   - `PlantActionsBar` + `DeletePlantDialog`,
   - (opcjonalnie) `WaterTodayDialog` jeśli wymagamy notatki w UX.
7. **Dopiąć dostępność i bezpieczeństwo**:
   - `aria-live="polite"` na kontenerze,
   - modale: focus management, `labelledBy`, przyciski z jasnymi labelami,
   - osobne potwierdzenie usuwania (checkbox/tekst) + `confirm=true`.
8. **(Docelowo) Deep link „Zobacz w kalendarzu” do najbliższego zadania**:
   - wariant minimalny bez nowych endpointów:
     - najpierw sprawdź dzień „dziś”: `GET /api/calendar/day?date=today&status=all` i sprawdź, czy w `items[]` jest `plant.id`,
     - jeśli nie ma, pobierz miesiąc: `GET /api/calendar/month?month=YYYY-MM&status=pending`,
     - iteruj po najbliższych dniach z `days[]` (w ograniczonym limicie, np. 7–14) i pobieraj `GET /api/calendar/day` aż znajdziesz dzień z zadaniem dla rośliny,
     - fallback do `/calendar/day/today` jeśli nie znaleziono.
   - wariant lepszy (zalecany): dodać endpoint backendowy typu `GET /api/plants/{plantId}/next-watering-date` i uprościć logikę UI (mniej requestów).
9. **Checklist akceptacyjny (US-013)**:
   - widok pokazuje `display_name`, `nickname` (jeśli jest), `photo` (jeśli jest),
   - pokazuje aktywny plan lub stan „Brak planu”,
   - dostępne akcje: „Zobacz w kalendarzu”, „Zmień plan”, „Podlej dzisiaj”, „Edytuj”, „Usuń”,
   - usuwanie zawsze z osobnym potwierdzeniem,
   - „Podlej dzisiaj” obsługuje konflikt (409) czytelnym komunikatem.

