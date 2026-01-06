## Plan implementacji widoku „Usunięcie rośliny (potwierdzenie)” (`/plants/:plantId/delete`)

## 1. Przegląd
Widok **Usunięcie rośliny (potwierdzenie)** umożliwia bezpieczne, nieodwracalne usunięcie rośliny wraz z całym powiązanym harmonogramem/zadaniami (kaskadowo po stronie backendu). Widok:
- wymaga **osobnego potwierdzenia w UI** (ochrona przed przypadkowym kliknięciem),
- wyświetla **nazwę rośliny** i komunikat o nieodwracalności,
- wykonuje `DELETE /api/plants/{plantId}?confirm=true`,
- po sukcesie pokazuje komunikat powodzenia i **przekierowuje do `/plants`** (fallback: `/calendar` jeśli lista nie jest jeszcze dostępna),
- zapewnia odświeżenie danych kalendarza przez invalidację cache po stronie frontu.

Powiązania z wymaganiami:
- PRD / US-011:
  - **AC1**: wymaga osobnego potwierdzenia → checkbox + przycisk „Usuń” aktywny dopiero po potwierdzeniu.
  - **AC2**: po potwierdzeniu roślina + harmonogram usuwane natychmiast → pojedynczy request `DELETE` (backend robi cascade).
  - **AC3**: komunikat sukcesu + odświeżenie kalendarza → komunikat + invalidacja cache kalendarza + redirect.

## 2. Routing widoku
- **Ścieżka**: `/plants/:plantId/delete`
- **Plik routingu (Astro)**: `src/pages/plants/[plantId]/delete.astro`
- **Renderowanie**: SSR / hybrydowo, `export const prerender = false`
- **Parametry ścieżki**:
  - `plantId` (wymagany): UUID

Uwagi projektowe (zgodne z `ui-plan.md`):
- Ten widok powinien być używalny zarówno jako:
  - **osobna strona** (deep-link, poprawne działanie back/forward),
  - jak i „dialog z `/plants/:plantId`” – przez nawigację do `/plants/:plantId/delete` z przycisku „Usuń” w szczegółach rośliny.

## 3. Struktura komponentów
### Proponowana struktura plików
- Routing:
  - `src/pages/plants/[plantId]/delete.astro`
- Komponenty widoku:
  - `src/components/plants/delete/PlantDeleteView.tsx` (kontener: fetch + mutacja + nawigacja)
  - `src/components/plants/delete/DeletePlantDialog.tsx` (prezentacyjny modal)
  - `src/components/plants/delete/PlantDeleteSkeleton.tsx` (loading)
  - `src/components/plants/delete/PlantDeleteErrorState.tsx` (error + retry)
  - `src/components/plants/delete/types.ts` (ViewModel + typy lokalne)
- Hooki:
  - `src/components/hooks/use-plant-delete.ts` (fetch danych do dialogu + stan)
  - `src/components/hooks/use-delete-plant-mutation.ts` (mutacja DELETE + invalidacje cache + mapowanie błędów)
- Klient API (frontend):
  - rozszerzenie `src/lib/services/plants/plants-client.ts` o:
    - `getPlantDetail(...)` (żeby pobrać `display_name` do dialogu)
    - `deletePlant(...)` (DELETE + `confirm=true`)

### Wysokopoziomowy diagram drzewa komponentów
```
src/pages/plants/[plantId]/delete.astro
└─ <Layout>
   └─ <PlantDeleteView client:load plantId />
      ├─ <PlantDeleteSkeleton /> (loading)
      ├─ <PlantDeleteErrorState /> (error)
      └─ <DeletePlantDialog /> (success: open=true)
```

## 4. Szczegóły komponentu
### `src/pages/plants/[plantId]/delete.astro`
- **Opis**: Wrapper routingu. Przekazuje `plantId` do React, ustawia tytuł strony i montuje interaktywny widok.
- **Główne elementy HTML**:
  - `<Layout title="Usuń roślinę">`
  - `<PlantDeleteView client:load plantId={...} />`
- **Obsługiwane zdarzenia**: n/a
- **Warunki walidacji**:
  - minimalnie: przekazanie `plantId` jako string; walidacja UUID i komunikaty w React (jedno źródło prawdy).
- **Typy (DTO/VM)**: n/a
- **Propsy**:

```ts
export type PlantDeletePageProps = {
  plantId: string
}
```

### `PlantDeleteView` (`src/components/plants/delete/PlantDeleteView.tsx`)
- **Opis komponentu**: Kontener widoku. Odpowiada za:
  - pobranie danych rośliny (min. `display_name`) do treści dialogu,
  - utrzymanie stanu otwarcia modala (zwykle zawsze otwarty na tej trasie),
  - obsługę checkboxa potwierdzenia i wysłania DELETE,
  - nawigację: zamknięcie (anuluj) → powrót do `/plants/:plantId` (jeśli istnieje) lub fallback `/calendar`,
  - obsługę sukcesu: komunikat + redirect do `/plants` (fallback `/calendar`),
  - invalidację cache kalendarza po usunięciu.
- **Główne elementy HTML**:
  - `<main className="mx-auto max-w-2xl p-4 sm:p-6" aria-live="polite">`
  - warunkowo: skeleton/error/dialog
- **Obsługiwane zdarzenia**:
  - `onCancel()` → zamknięcie widoku (nawigacja back lub do fallback),
  - `onConfirm()` → wykonanie mutacji `DELETE`,
  - `onRetry()` → ponowny fetch danych rośliny,
  - `onCheckboxChange(checked)` → aktualizacja lokalnego stanu potwierdzenia.
- **Warunki walidacji (UI-side, zgodne z API)**:
  - `plantId`:
    - musi być UUID przed wywołaniem `GET/DELETE`,
    - jeśli niepoprawny → stan błędu walidacji bez requestów.
  - potwierdzenie w UI:
    - checkbox „Rozumiem, że operacja jest nieodwracalna” **musi być zaznaczony**,
    - przycisk „Usuń roślinę” disabled, dopóki checkbox nie jest zaznaczony.
  - anti double-submit:
    - podczas mutacji `pending=true` → disabled dla przycisków + brak możliwości zamknięcia tłem (opcjonalnie).
- **Typy (DTO i ViewModel)**:
  - DTO: `PlantDetailDto`, `DeletePlantResultDto` (`src/types.ts`)
  - VM: `PlantDeleteVm`, `PlantDeleteErrorVm`, `DeletePlantMutationErrorVm` (`src/components/plants/delete/types.ts`)
- **Propsy**:

```ts
export type PlantDeleteViewProps = {
  plantId: string
}
```

### `DeletePlantDialog` (`src/components/plants/delete/DeletePlantDialog.tsx`)
- **Opis komponentu**: Prezentacyjny modal potwierdzenia usunięcia rośliny. Powinien korzystać z istniejącego `Modal` (`src/components/ui/modal.tsx`) i `Button`.
- **Główne elementy HTML i dzieci**:
  - `Modal` (role dialog jest już wbudowane)
  - `ModalHeader`:
    - nagłówek „Potwierdzenie operacji”
    - tytuł: „Usuń roślinę”
    - opis: „Operacja jest nieodwracalna. Usuniesz roślinę oraz jej plan i zadania.”
  - `ModalBody`:
    - „karta”/box z nazwą rośliny (`displayName`) i ewentualnym doprecyzowaniem
    - checkbox potwierdzenia (native `<input type="checkbox">` stylowany Tailwind)
  - `ModalFooter`:
    - `Button variant="ghost"`: „Anuluj”
    - `Button variant="destructive"`: „Usuń roślinę”
- **Obsługiwane zdarzenia**:
  - `onOpenChange(false)` (Escape / klik w tło / „Anuluj”),
  - `onConfirm()`,
  - `onConfirmCheckedChange(checked)`.
- **Warunki walidacji**:
  - `confirmChecked === true` wymagane do aktywacji przycisku „Usuń roślinę”
  - `pending === true` blokuje interakcje
- **Typy**:
  - `PlantDeleteVm['plant']`, `DeletePlantMutationErrorVm` (do wyświetlenia błędu)
- **Propsy**:

```ts
export type DeletePlantDialogProps = {
  open: boolean
  plantDisplayName: string
  pending: boolean
  confirmChecked: boolean
  error?: DeletePlantMutationErrorVm | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  onConfirmCheckedChange: (checked: boolean) => void
}
```

### `PlantDeleteSkeleton` (`src/components/plants/delete/PlantDeleteSkeleton.tsx`)
- **Opis**: Skeleton na czas ładowania danych rośliny (żeby szybko pokazać UI).
- **Główne elementy HTML**: proste bloki `div` z `animate-pulse`.
- **Zdarzenia**: n/a
- **Walidacja**: n/a
- **Typy/Propsy**: brak

### `PlantDeleteErrorState` (`src/components/plants/delete/PlantDeleteErrorState.tsx`)
- **Opis**: Spójna prezentacja błędów (walidacja/401/404/network/http/parse) z CTA.
- **Główne elementy HTML**:
  - `Card` z `role="status"`
  - CTA:
    - „Spróbuj ponownie” (dla błędów sieci/5xx/parse),
    - „Zaloguj się” (dla 401),
    - „Wróć” (dla 404/walidacji).
- **Obsługiwane zdarzenia**: `onRetry`, `onBack`
- **Warunki walidacji**: n/a
- **Typy**: `PlantDeleteErrorVm`
- **Propsy**:

```ts
export type PlantDeleteErrorStateProps = {
  error: PlantDeleteErrorVm
  onRetry?: () => void
  onBack: () => void
  loginHref?: string
}
```

## 5. Typy
### DTO (istniejące)
Z `src/types.ts`:
- **`PlantDetailDto`**:
  - `plant.display_name: string` (kluczowe do dialogu)
  - (pozostałe pola mogą być ignorowane w tym widoku)
- **`DeletePlantResultDto`**:
  - `deleted: boolean`
  - `plant_id: string`

### Nowe typy ViewModel (proponowane)
Plik: `src/components/plants/delete/types.ts`

```ts
export type PlantDeleteVm = {
  plant: {
    id: string
    displayName: string
  }
}

export type PlantDeleteErrorVm = {
  kind: 'validation' | 'unauthenticated' | 'notFound' | 'network' | 'parse' | 'http' | 'unknown'
  message: string
  code?: string
  status?: number
  requestId?: string
  details?: unknown
}

export type DeletePlantMutationErrorVm = {
  kind: 'validation' | 'unauthenticated' | 'notFound' | 'network' | 'parse' | 'http' | 'unknown'
  message: string
  code?: string
  requestId?: string
  details?: unknown
}
```

### Helpery mapujące (rekomendowane)
- `isValidPlantId(plantId: string): boolean` (UUID)
- `mapPlantDetailDtoToPlantDeleteVm(dto: PlantDetailDto): PlantDeleteVm`
- `mapPlantsApiErrorToPlantDeleteErrorVm(error: unknown): PlantDeleteErrorVm`

## 6. Zarządzanie stanem
### Stan widoku (w `PlantDeleteView`)
- **Fetch state** (hook `usePlantDelete`):
  - `status: 'idle' | 'loading' | 'success' | 'error'`
  - `data?: PlantDeleteVm`
  - `error?: PlantDeleteErrorVm`
  - `requestId?: string`
- **UI state**:
  - `confirmChecked: boolean` (checkbox)
  - `dialogOpen: boolean` (domyślnie `true` na tej trasie)
- **Mutation state** (hook `useDeletePlantMutation`):
  - `pending: boolean`
  - `error: DeletePlantMutationErrorVm | null`

### Custom hooki
- `usePlantDelete({ plantId })`:
  - waliduje `plantId` (UUID) przed `GET`,
  - pobiera minimalne dane rośliny (w praktyce: `PlantDetailDto`),
  - wspiera `AbortController` i retry.
- `useDeletePlantMutation()`:
  - udostępnia `deletePlant(plantId)` i stan `pending/error`,
  - po sukcesie wykonuje:
    - `invalidateCalendarDayCache()` (czyści cache day view),
    - `invalidateCalendarMonthCache()` (czyści cache month view),
    - (opcjonalnie) invalidacja cache listy roślin, jeśli istnieje w projekcie.

## 7. Integracja API
### Wymagane wywołania
1) **Pobranie nazwy rośliny do dialogu**
- Preferowane: `GET /api/plants/{plantId}` → `ApiEnvelope<PlantDetailDto>`
- Uwaga: w aktualnym repo `src/pages/api/plants/[plantId]/index.ts` ma `PATCH` i `DELETE`, ale brak `GET`. Aby ten widok działał jako deep-link, potrzebny jest handler `GET` zwracający `PlantDetailDto` (analogicznie do mapowania w `src/lib/services/plants/update-plant.ts`).

2) **Usunięcie rośliny**
- `DELETE /api/plants/{plantId}?confirm=true`
- **Request**: bez body
- **Response 200**: `ApiEnvelope<DeletePlantResultDto>`
- **Błędy (kontrakt)**:
  - `401 UNAUTHENTICATED`
  - `404 PLANT_NOT_FOUND` / `NOT_FOUND`
  - `400 CONFIRMATION_REQUIRED` (gdy brak `confirm=true`)

### Klient API (frontend)
W `src/lib/services/plants/plants-client.ts`:
- dodać helper `requestPlantsApi<T>(input, init)` (analogicznie do `requestWateringTaskApi`)
- dodać:
  - `getPlantDetail(plantId, { signal? })`
  - `deletePlant(plantId, { signal? })` → wywołuje `/api/plants/${plantId}?confirm=true` metodą `DELETE`
- mapowanie błędów do `PlantsApiErrorKind` powinno uwzględniać co najmniej:
  - `unauthenticated` (status 401 lub code `UNAUTHENTICATED`/`UNAUTHORIZED`)
  - `notFound` (status 404 lub code `PLANT_NOT_FOUND`)
  - `validation` (code `VALIDATION_ERROR` / `INVALID_PLANT_ID`)

## 8. Interakcje użytkownika
- **Wejście na `/plants/:plantId/delete`**:
  - UI pokazuje skeleton, pobiera dane rośliny, otwiera modal z treścią.
- **Anuluj / zamknij modal**:
  - zamknięcie przez „Anuluj”, Escape, klik w tło
  - rezultat: nawigacja do bezpiecznej trasy (preferowane: `/plants/:plantId`, fallback: `/calendar`)
- **Potwierdzenie checkboxem**:
  - dopiero po zaznaczeniu checkboxa aktywuje się przycisk „Usuń roślinę”.
- **Usuń roślinę**:
  - wysyła `DELETE /api/plants/{plantId}?confirm=true`
  - podczas requestu: disabled przyciski + spinner/tekst „Usuwanie…”
  - po sukcesie:
    - komunikat powodzenia (toast/banner),
    - invalidacja cache kalendarza,
    - redirect do `/plants` (fallback `/calendar`).
- **Retry po błędzie**:
  - „Spróbuj ponownie” ponawia fetch (GET) albo mutację (w zależności od miejsca błędu).

## 9. Warunki i walidacja
### Warunki wymagane przez API i weryfikacja w UI
- **`plantId`**:
  - UI: walidacja UUID przed `GET` i `DELETE`,
  - jeśli niepoprawny → nie wysyłać requestów, pokazać stan błędu walidacji.
- **`confirm=true`**:
  - UI: zawsze dokleja query `confirm=true` do requestu `DELETE`.
- **Osobne potwierdzenie w UI** (wymaganie UX + PRD):
  - checkbox wymagany do aktywacji CTA „Usuń roślinę”.
- **Blokada wielokrotnego wysłania** (US-022 – zasada ogólna):
  - `pending=true` blokuje ponowne kliknięcie „Usuń roślinę”.

### Wpływ walidacji na stan interfejsu
- brak potwierdzenia checkboxem → CTA „Usuń roślinę” disabled
- błąd 401 → CTA „Zaloguj się”
- błąd 404 → CTA „Wróć” do listy roślin/kalendarza
- błąd sieci/5xx → CTA „Spróbuj ponownie”

## 10. Obsługa błędów
### Scenariusze błędów i rekomendowana reakcja UI
- **401 UNAUTHENTICATED / UNAUTHORIZED**:
  - komunikat „Sesja wygasła / brak uprawnień”
  - CTA do logowania (z `returnTo=/plants/:plantId/delete` jeśli mechanizm istnieje).
- **404 PLANT_NOT_FOUND**:
  - komunikat „Nie znaleziono rośliny (lub nie masz dostępu)”
  - CTA do `/plants` (fallback `/calendar`).
- **400 CONFIRMATION_REQUIRED**:
  - teoretycznie nie powinno wystąpić (UI zawsze wysyła `confirm=true`)
  - jeśli wystąpi: pokazać błąd i przycisk retry, dodatkowo zalogować do `console.error`.
- **Network error**:
  - komunikat „Brak połączenia” + retry
- **Parse error**:
  - komunikat „Nie udało się przetworzyć odpowiedzi serwera” + retry
- **5xx / `PLANT_DELETE_FAILED`**:
  - komunikat ogólny + retry; opcjonalnie wyświetlić `requestId` (jeśli jest w `meta`).

## 11. Kroki implementacji
1. **Dodać routing widoku**:
  - utworzyć `src/pages/plants/[plantId]/delete.astro`,
  - `export const prerender = false`,
  - wpiąć `Layout` i `PlantDeleteView client:load`.
2. **Dodać/uzupełnić klienta API dla roślin**:
  - w `src/lib/services/plants/plants-client.ts` dodać `requestPlantsApi<T>()`,
  - dodać `deletePlant(plantId)` wykonujące `DELETE /api/plants/${plantId}?confirm=true`,
  - dodać `getPlantDetail(plantId)` (dla `display_name` w dialogu).
3. **Upewnić się, że istnieje endpoint `GET /api/plants/{plantId}`** (wymagane dla deep-link):
  - dodać handler `GET` w `src/pages/api/plants/[plantId]/index.ts`, który zwraca `PlantDetailDto` (spójnie z mapowaniem w `update-plant.ts`).
4. **Zaimplementować hook `usePlantDelete`**:
  - walidacja UUID, fetch `getPlantDetail`, obsługa abort/retry, mapowanie błędów do `PlantDeleteErrorVm`.
5. **Zaimplementować hook `useDeletePlantMutation`**:
  - wywołanie `deletePlant(plantId)`,
  - mapowanie błędów do `DeletePlantMutationErrorVm`,
  - po sukcesie: `invalidateCalendarDayCache()` + `invalidateCalendarMonthCache()`.
6. **Zaimplementować UI**:
  - `PlantDeleteView` (kontener, logika),
  - `DeletePlantDialog` z treścią ostrzegawczą + checkbox,
  - `PlantDeleteSkeleton` i `PlantDeleteErrorState`.
7. **Dodać komunikat sukcesu**:
  - wariant minimalny: lokalny banner w `PlantDeleteView` + redirect po krótkim timeout,
  - wariant docelowy: „flash message” przeniesiony do `/plants` (np. query `?deleted=1` lub `sessionStorage`).
8. **Dopiąć nawigację**:
  - „Anuluj” → back lub `/plants/:plantId` (fallback `/calendar`),
  - po sukcesie → `/plants` (fallback `/calendar`).
9. **Sprawdzenie kryteriów akceptacji US-011**:
  - osobne potwierdzenie wymagane,
  - usunięcie wywołuje tylko jeden endpoint `DELETE` i nie wymaga dodatkowych akcji,
  - komunikat sukcesu i odświeżenie kalendarza (przez invalidację cache).

