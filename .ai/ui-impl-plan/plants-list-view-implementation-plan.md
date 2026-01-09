## Plan implementacji widoku Lista roślin (`/plants`)

## 1. Przegląd
Widok **Lista roślin** pozwala użytkownikowi:
- przeglądać kolekcję roślin,
- wyszukiwać po nazwie gatunku i pseudonimie (`q`),
- zmieniać sortowanie (`sort` + `order`),
- doładowywać kolejne strony wyników (paginacja cursor),
- wejść w szczegóły rośliny po kliknięciu w element listy.

Widok musi spełniać US-012:
- na liście widać nazwę (bazowo `display_name`) oraz opcjonalnie `nickname`,
- kliknięcie rekordu prowadzi do szczegółów rośliny,
- **domyślnie lista jest posortowana alfabetycznie po nazwie rośliny** (`sort=species_name`, `order=asc`).

## 2. Routing widoku
- **Ścieżka**: `/plants`
- **Implementacja routingu**: `src/pages/plants/index.astro` (SSR / `export const prerender = false`)
- **Parametry query w URL (kontrakt UI → API)**:
  - `q?: string` — wyszukiwanie (po `species_name` i `nickname`)
  - `sort?: 'created_at' | 'species_name' | 'updated_at'`
  - `order?: 'asc' | 'desc'`
  - `limit?: number` (1..100, domyślnie 20)
  - `cursor?: string` — opcjonalnie wspierane dla deep-linków, ale rekomendowane użycie **wyłącznie wewnętrzne** (patrz sekcja 6)

### Normalizacja parametrów (w warstwie UI)
Aby unikać `400 INVALID_QUERY_PARAMS` z API, strona Astro powinna:
- odczytać `q/sort/order/limit` z `Astro.url.searchParams`,
- znormalizować wartości (enumy, zakres limitu),
- przekazać do komponentu React już bezpieczne wartości domyślne:
  - `sort='species_name'`
  - `order='asc'`
  - `limit=20`
  - `q` tylko jeśli po `trim()` ma długość ≥ 1 i ≤ 120

## 3. Struktura komponentów
Proponowana struktura (Astro + React):

- `src/pages/plants/index.astro`
  - `Layout` (`src/layouts/Layout.astro`)
    - `<PlantsListView client:load ... />`

Wewnątrz React:

- `PlantsListView`
  - `PlantsListHeader`
    - tytuł + opis
    - CTA „Dodaj roślinę” (link do `/plants/new`)
  - `PlantsListControls`
    - `PlantsSearchInput` (debounce 300–500 ms)
    - `PlantsSortControls`
      - `PlantsSortSelect`
      - `PlantsOrderToggle` (lub `PlantsOrderSelect`)
  - `PlantsListStateBoundary`
    - `PlantsListSkeleton` (loading)
    - `PlantsErrorState` (error + retry)
    - `PlantsEmptyState` (empty + CTA)
    - `PlantsList` (ul)
      - `PlantListItem` (li → link do `/plants/:plantId`)
        - `PlantThumbnail` (gdy `photo_path`)
        - treść: `display_name`, `nickname`, mini-meta
    - `PlantsLoadMore`

## 4. Szczegóły komponentu

### `src/pages/plants/index.astro` (strona Astro)
- **Opis**: Punkt wejścia routingu `/plants`. Normalizuje parametry z URL i montuje Reactowy widok.
- **Główne elementy**: `<Layout>`, `<PlantsListView client:load />`
- **Obsługiwane zdarzenia**: n/a (logika interaktywna w React)
- **Warunki walidacji**:
  - normalizacja `q/sort/order/limit` do wartości wspieranych przez API
  - (opcjonalnie) ignorowanie `cursor` z URL — rekomendowane, by nie utrzymywać paginacji w linkowalnym stanie
- **Typy**:
  - `PlantSortField`, `SortOrder` z `src/lib/services/plants/types.ts` (typy sortowania)
  - `PlantsListInitialProps` (nowy typ frontowy; patrz sekcja 5)
- **Props do React**:
  - `initialQuery: PlantsListQueryState` (bezpieczne wartości startowe)

### `PlantsListView` (React)
- **Opis**: Główny komponent widoku, scala kontrolki + listę + stany i integrację z API.
- **Główne elementy**:
  - `<main>` z ograniczeniem szerokości (np. `max-w-5xl`), `aria-live="polite"`
  - nagłówek, kontrolki, sekcja listy
- **Dzieci**: `PlantsListHeader`, `PlantsListControls`, `PlantsList`, `PlantsLoadMore`, `PlantsEmptyState`, `PlantsErrorState`, `PlantsListSkeleton`
- **Obsługiwane zdarzenia**:
  - zmiana `q` (debounce) → reset listy + fetch od 1. strony
  - zmiana `sort`/`order` → reset listy + fetch od 1. strony
  - klik „Załaduj więcej” → fetch następnej strony i dopięcie wyników
  - klik „Spróbuj ponownie” → ponowny fetch bieżących filtrów
- **Warunki walidacji (UI-side, zgodne z API)**:
  - `q`: po `trim()` długość 1..120; jeśli puste → nie wysyłać parametru
  - `sort`: tylko `created_at|species_name|updated_at`
  - `order`: tylko `asc|desc`
  - `limit`: int 1..100
  - `cursor`: tylko wartość zwrócona z API (opaque) — UI nie konstruuje cursora
- **Typy (DTO i ViewModel)**:
  - DTO: `PlantListDto`, `PlantListItemDto` (`src/types.ts`)
  - VM: `PlantsListVm`, `PlantListItemVm`, `PlantsListErrorVm` (nowe; sekcja 5)
- **Props (interfejs)**:

```ts
export type PlantsListViewProps = {
  initialQuery: PlantsListQueryState
}
```

### `PlantsSearchInput`
- **Opis**: Pole wyszukiwania z debounce 300–500 ms, mapowane na query `q`.
- **Główne elementy**:
  - `<label>` + `<input type="search">`
  - opcjonalny przycisk „Wyczyść”
- **Obsługiwane zdarzenia**:
  - `onChange` → aktualizacja lokalnego input state
  - po debounce → `onQueryCommit(nextQ)`
  - „Wyczyść” → `onQueryCommit('')`
- **Warunki walidacji**:
  - `q` wysyłamy tylko jeśli `trim().length >= 1`
  - `q.length <= 120` (blokada/ucięcie + komunikat)
- **Typy**:
  - `string`
- **Props**:

```ts
export type PlantsSearchInputProps = {
  value: string
  pending?: boolean
  debounceMs?: number
  maxLength?: number
  onCommit: (nextValue: string) => void
}
```

### `PlantsSortSelect`
- **Opis**: Wybór pola sortowania.
- **Główne elementy**:
  - shadcn/ui `Select` (lub przyciski jak w kalendarzu) z opcjami:
    - `species_name` (Gatunek) — domyślnie aktywne
    - `created_at` (Data dodania)
    - `updated_at` (Ostatnia aktualizacja)
- **Obsługiwane zdarzenia**:
  - `onValueChange(nextSort)` → `onChange(nextSort)`
- **Warunki walidacji**:
  - tylko wartości enum `PlantSortField`
- **Typy**:
  - `PlantSortField` (`src/lib/services/plants/types.ts`)
- **Props**:

```ts
export type PlantsSortSelectProps = {
  value: PlantSortField
  disabled?: boolean
  onChange: (next: PlantSortField) => void
}
```

### `PlantsOrderToggle` (lub `PlantsOrderSelect`)
- **Opis**: Zmiana kolejności sortowania (rosnąco/malejąco).
- **Główne elementy**:
  - 2 przyciski (jak w kalendarzu) lub select z `asc/desc`
- **Obsługiwane zdarzenia**:
  - `onChange(nextOrder)`
- **Warunki walidacji**:
  - tylko `asc|desc`
- **Typy**:
  - `SortOrder` (`src/lib/services/plants/types.ts`)
- **Props**:

```ts
export type PlantsOrderToggleProps = {
  value: SortOrder
  disabled?: boolean
  onChange: (next: SortOrder) => void
}
```

### `PlantsList`
- **Opis**: Semantyczna lista roślin.
- **Główne elementy**:
  - `<ul role="list">` + `<li>`
- **Obsługiwane zdarzenia**: n/a (pojedyncze elementy obsługują klik)
- **Warunki walidacji**: n/a
- **Typy**:
  - `PlantListItemVm[]`
- **Props**:

```ts
export type PlantsListProps = {
  items: PlantListItemVm[]
}
```

### `PlantListItem`
- **Opis**: Pojedynczy element listy; cały element jest linkiem do szczegółów.
- **Główne elementy**:
  - `<a href="/plants/:id">` jako duży hit-area (mobile friendly)
  - opcjonalna miniatura
  - teksty: `display_name`, `nickname`, mini-meta (np. „Dodano …”, „Aktualizacja …”)
- **Obsługiwane zdarzenia**:
  - klik → nawigacja do `/plants/:plantId`
- **Warunki walidacji**:
  - `href` budowany wyłącznie z `id` (UUID), bez pochodnych danych
- **Typy**:
  - `PlantListItemVm`
- **Props**:

```ts
export type PlantListItemProps = {
  item: PlantListItemVm
}
```

### `PlantThumbnail`
- **Opis**: Miniatura zdjęcia, jeśli `photo_path` istnieje.
- **Główne elementy**:
  - `<img>` (lub Astro Image w warstwie Astro, jeśli dostępne URL-e)
  - fallback (np. inicjał lub placeholder) gdy brak zdjęcia
- **Obsługiwane zdarzenia**: n/a
- **Warunki walidacji**:
  - nie zakładać, że `photo_path` jest publicznym URL-em; traktować jako identyfikator ścieżki (obsługa zależna od Storage)
- **Typy**:
  - `photo_path: string | null`
- **Props**:

```ts
export type PlantThumbnailProps = {
  photoPath: string | null
  alt: string
}
```

### `PlantsLoadMore`
- **Opis**: Kontrolka do cursor pagination.
- **Główne elementy**:
  - `Button` „Załaduj więcej”
  - status pomocniczy „Ładowanie…”
- **Obsługiwane zdarzenia**:
  - klik → `onLoadMore()`
- **Warunki walidacji**:
  - przycisk aktywny tylko gdy `nextCursor !== null`
  - blokada przycisku podczas `isLoadingMore=true`
- **Typy**:
  - `nextCursor: string | null`
- **Props**:

```ts
export type PlantsLoadMoreProps = {
  canLoadMore: boolean
  pending: boolean
  onLoadMore: () => void
}
```

### `PlantsEmptyState`
- **Opis**: Stan pusty dla braku danych (zależny od tego, czy jest filtr `q`).
- **Główne elementy**:
  - komunikat:
    - bez `q`: „Brak roślin” + CTA „Dodaj roślinę”
    - z `q`: „Brak wyników dla …” + CTA „Wyczyść wyszukiwanie”
- **Obsługiwane zdarzenia**:
  - CTA „Dodaj roślinę” → link do `/plants/new`
  - CTA „Wyczyść” → `onClearFilters()`
- **Warunki walidacji**: n/a
- **Typy**:
  - `q?: string`
- **Props**:

```ts
export type PlantsEmptyStateProps = {
  query?: string
  onClearFilters?: () => void
  ctaHref?: string
}
```

### `PlantsErrorState`
- **Opis**: Stan błędu z możliwością retry i akcją logowania przy 401.
- **Główne elementy**:
  - shadcn/ui `Card` (analogicznie do `CalendarErrorState`)
  - przycisk „Spróbuj ponownie” (dla błędów nie-walidacyjnych i nie-401)
  - CTA do logowania dla `unauthenticated`
  - CTA reset filtrów dla `validation` (np. `href="/plants"`)
- **Obsługiwane zdarzenia**:
  - `onRetry()`
  - przejście do `/auth/login?returnTo=...`
- **Warunki walidacji**:
  - dopasować komunikaty do `PlantsListErrorVm.kind`
- **Typy**:
  - `PlantsListErrorVm`
- **Props**:

```ts
export type PlantsErrorStateProps = {
  error: PlantsListErrorVm
  onRetry?: () => void
  loginHref?: string
  resetHref?: string
}
```

## 5. Typy

### DTO (istniejące)
- `PlantListItemDto` (`src/types.ts`): element listy (w tym `display_name`, `nickname`, `photo_path`, `created_at`, `updated_at`)
- `PlantListDto` (`src/types.ts`): `{ items: PlantListItemDto[] }`
- `PlantSortField` (`src/lib/services/plants/types.ts`): `'created_at' | 'species_name' | 'updated_at'`
- `SortOrder` (`src/lib/services/plants/types.ts`): `'asc' | 'desc'`

### Nowe typy (ViewModel / frontend)
Rekomendowane w `src/lib/services/plants/list-view-model.ts`:

```ts
export type PlantsListQueryState = {
  q?: string
  sort: PlantSortField
  order: SortOrder
  limit: number
}

export type PlantListItemVm = {
  id: string
  href: string
  displayName: string
  nickname?: string | null
  photoPath?: string | null
  createdAt?: string
  updatedAt?: string
  metaLabel?: string | null
}

export type PlantsListVm = {
  query: PlantsListQueryState
  items: PlantListItemVm[]
  nextCursor: string | null
  hasAnyItems: boolean
  isFiltered: boolean
}

export type PlantsListErrorVm = {
  kind: 'validation' | 'unauthenticated' | 'http' | 'network' | 'parse' | 'unknown'
  message: string
  code?: string
  status?: number
  requestId?: string
}
```

Rekomendowane w `src/components/plants/list/types.ts` (lub współdzielone z view-model):

```ts
export type PlantsListInitialProps = {
  initialQuery: PlantsListQueryState
}
```

## 6. Zarządzanie stanem
Widok powinien wykorzystywać dedykowany hook (analogicznie do `useCalendarDay`) do:
- pobrania pierwszej strony,
- utrzymania listy z dopinaniem kolejnych stron,
- anulowania poprzednich żądań (AbortController),
- obsługi „stale while revalidate” (opcjonalnie),
- resetu paginacji przy zmianie filtrów/sortowania.

### Proponowany hook: `usePlantsList`
Lokalizacja: `src/components/hooks/use-plants-list.ts`

**Stan minimalny**:
- `query: PlantsListQueryState`
- `items: PlantListItemDto[]` (lub od razu `PlantListItemVm[]`)
- `nextCursor: string | null`
- `status: 'idle' | 'loading' | 'success' | 'error'`
- `isLoadingMore: boolean`
- `error?: PlantsListErrorVm`

**Akcje**:
- `setQuery(next: Partial<PlantsListQueryState>)`:
  - waliduje/normalizuje
  - resetuje `items` i `nextCursor`
  - fetchuje od nowa
- `loadMore()`:
  - jeśli `nextCursor` istnieje, pobiera kolejną stronę i dopina wyniki
- `reload()`:
  - ponawia pobranie bieżącej 1. strony

**Cache (opcjonalnie, ale spójnie z kalendarzem)**:
- cache kluczowany: `${q ?? ''}:${sort}:${order}:${limit}`
- cache dotyczy tylko 1. strony (dla prostoty). Dalsze strony są trudne do bezpiecznego cache’owania bez pamiętania historii cursorów.

### Synchronizacja z URL
Rekomendacja:
- **`q/sort/order/limit` trzymamy w URL** (dla odświeżenia strony i linkowalności filtrów),
- **cursor trzymamy tylko w pamięci** (nie dopisywać do URL przy „Załaduj więcej”).

Implementacyjnie:
- zmiany `sort/order` mogą być realizowane jako linki `<a href="...">` (jak w kalendarzu), albo bez przeładowania strony przez `history.pushState` + `usePlantsList.setQuery`.
- `q` (debounce) najlepiej realizować bez pełnego przeładowania: `history.replaceState` + `setQuery`.

## 7. Integracja API

### Endpoint
- `GET /api/plants?q=&species=&sort=&order=&limit=&cursor=`

### Typy żądania (frontend)
Proponowane parametry klienta:
- `q?: string`
- `species?: string` (nie wymagane dla tego widoku, ale warto zachować kompatybilność)
- `sort?: PlantSortField`
- `order?: SortOrder`
- `limit?: number`
- `cursor?: string`

### Typy odpowiedzi (kontrakt)
Zgodnie z implementacją endpointu `src/pages/api/plants/index.ts`:
- `envelope.data` → `PlantListDto` (`{ items: PlantListItemDto[] }`)
- `envelope.meta.next_cursor` → `string | null`

### Zmiany wymagane w kliencie `plants-client` (żeby widok dało się wdrożyć)
Aktualny `src/lib/services/plants/plants-client.ts` obsługuje tylko `{ q, limit }` i **nie zwraca `next_cursor`**, co blokuje „Załaduj więcej”.

Planowane usprawnienia klienta:
- rozszerzyć `ListPlantsParams` o `sort/order/cursor/species`,
- odczytać `meta.next_cursor` i zwracać go jawnie,
- rozszerzyć klasyfikację błędów o:
  - `unauthenticated` gdy `status === 401` lub `code === 'UNAUTHENTICATED'`,
  - `validation` gdy `code === 'INVALID_QUERY_PARAMS'` (bo to jest realny błąd walidacji query),
- utrzymać `AbortSignal` jako opcję (wymagana dla debounce i anulowania requestów).

Proponowana sygnatura:

```ts
export const listPlants = async (
  params: {
    q?: string
    species?: string
    sort?: PlantSortField
    order?: SortOrder
    limit?: number
    cursor?: string
  },
  options?: { signal?: AbortSignal },
): Promise<{ data: PlantListDto; nextCursor: string | null; requestId?: string }>
```

## 8. Interakcje użytkownika
- **Wejście na `/plants`**:
  - widok ładuje 1. stronę listy, domyślnie `sort=species_name&order=asc`.
- **Wpisywanie w SearchInput**:
  - po debounce aktualizuje `q` i odświeża listę od początku,
  - gdy `q` puste → wraca do pełnej listy (bez parametru `q`).
- **Zmiana sortowania**:
  - przełączenie na `created_at` lub `updated_at` resetuje paginację i odświeża listę.
- **Zmiana kolejności (asc/desc)**:
  - reset paginacji i odświeżenie listy.
- **Klik w element listy**:
  - nawigacja do `/plants/:plantId` (wymóg US-012).
- **Klik „Załaduj więcej”**:
  - pobranie kolejnej strony przez `cursor=nextCursor`,
  - dopięcie wyników do listy,
  - aktualizacja `nextCursor` na nową wartość (lub `null` gdy brak następnej strony).
- **Retry po błędzie**:
  - ponowienie żądania dla bieżących filtrów.

## 9. Warunki i walidacja
Walidacje wymagane przez API i weryfikowane w UI:
- **`q`**:
  - `trim()`, długość 1..120,
  - UI nie wysyła `q` jeśli puste,
  - UI powinno ograniczyć `maxLength=120` w inpucie.
- **`sort`**: tylko `created_at | species_name | updated_at` (niedozwolone wartości normalizować do `species_name`).
- **`order`**: tylko `asc | desc` (niedozwolone wartości normalizować do `asc`).
- **`limit`**: int 1..100 (niedozwolone wartości normalizować do 20).
- **`cursor`**:
  - UI traktuje jako opaque,
  - UI przekazuje tylko wartość z `meta.next_cursor`,
  - UI resetuje cursor zawsze gdy zmienia się `q/sort/order/limit`.

Wpływ walidacji na stan UI:
- jeśli wykryto niepoprawne parametry w URL (np. ręcznie wpisane) → UI pokazuje `PlantsErrorState` z kind=`validation` i CTA „Reset filtrów” (`/plants`).

## 10. Obsługa błędów
Scenariusze błędów i rekomendowana obsługa:
- **401 UNAUTHENTICATED / sesja wygasła**:
  - pokaż komunikat „Sesja wygasła…”
  - CTA do `/auth/login?returnTo=...`
- **Błędy sieci (`network`)**:
  - komunikat „Brak połączenia…”
  - przycisk „Spróbuj ponownie”
- **Błędy walidacji query (`INVALID_QUERY_PARAMS`)**:
  - komunikat „Niepoprawne filtry…”
  - CTA „Resetuj filtry” (`/plants`)
- **Błędy HTTP 5xx**:
  - komunikat ogólny „Nie udało się wczytać listy roślin”
  - retry
- **Abort/race**:
  - ignorować rezultat anulowanego requestu,
  - zawsze anulować poprzedni request przy nowym `q` (debounce) lub zmianie filtrów.

## 11. Kroki implementacji
1. **Dodać routing strony**:
   - utworzyć `src/pages/plants/index.astro`,
   - wczytać `Layout`,
   - znormalizować `q/sort/order/limit` z URL i przekazać do `PlantsListView` jako `initialQuery`,
   - `export const prerender = false`.
2. **Dodać view-model dla widoku listy**:
   - utworzyć `src/lib/services/plants/list-view-model.ts`,
   - dodać funkcje:
     - `normalizePlantsListSort(sort?: PlantSortField): PlantSortField` (default `species_name`),
     - `normalizePlantsListOrder(order?: SortOrder): SortOrder` (default `asc`),
     - `normalizePlantsListLimit(limit?: unknown): number` (default `20`, clamp 1..100),
     - `buildPlantsListHref(query: PlantsListQueryState): string` (składanie URL dla linków),
     - `mapPlantListItemDtoToVm(dto: PlantListItemDto, query: PlantsListQueryState): PlantListItemVm`.
3. **Rozszerzyć klienta API roślin**:
   - zaktualizować `src/lib/services/plants/plants-client.ts`:
     - obsługa `sort/order/cursor/species`,
     - zwracanie `nextCursor` z `meta.next_cursor`,
     - poprawna klasyfikacja `unauthenticated` oraz `validation` dla `INVALID_QUERY_PARAMS`.
4. **Dodać hook `usePlantsList`**:
   - utworzyć `src/components/hooks/use-plants-list.ts`,
   - obsłużyć:
     - fetch 1. strony,
     - `loadMore()` z dopięciem wyników,
     - abort poprzednich requestów,
     - reset paginacji przy zmianie query,
     - mapowanie `PlantsApiError` → `PlantsListErrorVm`.
5. **Zaimplementować komponenty widoku**:
   - dodać katalog np. `src/components/plants/list/`:
     - `PlantsListView.tsx`
     - `PlantsSearchInput.tsx`
     - `PlantsSortControls.tsx` (`PlantsSortSelect`, `PlantsOrderToggle`)
     - `PlantsList.tsx`, `PlantListItem.tsx`, `PlantThumbnail.tsx`
     - `PlantsEmptyState.tsx`, `PlantsErrorState.tsx`, `PlantsListSkeleton.tsx`
6. **Linkowanie do szczegółów rośliny**:
   - w `PlantListItem` użyć `href="/plants/${id}"`,
   - jeśli widok szczegółów nie istnieje jeszcze w MVP, dodać jako zależność (blokuje AC2 US-012).
7. **Spójność UX i dostępność**:
   - semantyczna lista (`ul/li`), czytelne hit-areas,
   - `aria-live="polite"` na głównym kontenerze,
   - focus styles dla linków/przycisków,
   - przyciski blokowane podczas requestów (anti double-submit).
8. **Checklist akceptacyjny (US-012)**:
   - widać `display_name` i opcjonalnie `nickname`,
   - klik elementu prowadzi do `/plants/:id`,
   - domyślne sortowanie: `species_name` rosnąco,
   - działają: loading, empty + CTA, error + retry, load-more z cursor.

