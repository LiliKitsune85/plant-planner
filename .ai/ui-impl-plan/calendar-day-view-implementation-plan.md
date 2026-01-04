## Plan implementacji widoku „Kalendarz — dzień”

## 1. Przegląd
Widok „Kalendarz — dzień” służy do wykonania pracy „tu i teraz”: użytkownik widzi listę zadań podlewania na wybrany dzień, może **potwierdzić wykonanie**, **cofnąć**, **edytować**, **usunąć wpis** oraz **dodać wpis ad hoc**. Kluczowe wymagania MVP (PRD + US-005/US-006 + `ui-plan.md`):

- **Szybkie akcje** na liście (confirm/undo) z **optymistycznymi aktualizacjami** i rollbackiem na błąd.
- **Edycja wpisu** (status, `completed_on`, notatka) zgodnie z walidacjami backendu.
- **Usuwanie**: inne zachowanie i copy dla `adhoc` vs `scheduled`.
- **Dodawanie ad hoc** z wyborem rośliny i datą ustawioną na bieżący dzień.
- **Obsługa konfliktów 409** dla ad hoc: komunikat „Na ten dzień istnieje już wpis podlewania” + link/scroll do danej rośliny na liście.

Ten plan zakłada wykorzystanie istniejących fundamentów w repo: routing Astro dla dnia, hook `useCalendarDay`, klient `day-client.ts` i VM `day-view-model.ts`, a następnie rozszerzenie UI o mutacje.

## 2. Routing widoku
- **Ścieżki**:
  - `src/pages/calendar/day/index.astro` → redirect do dzisiejszej daty (już istnieje): `/calendar/day/YYYY-MM-DD`
  - `src/pages/calendar/day/[date].astro` → właściwy widok (już istnieje)
- **Parametry path**:
  - `date` (wymagany): `YYYY-MM-DD`
- **Query params** (utrzymywane w URL, linkowe przełączanie jak w widoku miesiąca):
  - `status=pending|completed|all` (domyślnie `all` – zgodnie z `normalizeCalendarDayStatus`)
  - `sort=species_name|due_on` (domyślnie `due_on`)
  - `order=asc|desc` (domyślnie `asc`)
- **Dodatkowy query param dla UX konfliktu 409 (rekomendowane)**:
  - `highlightPlantId=<uuid>` lub hash `#plant-<uuid>` – do wyróżnienia/scrollowania konkretnej rośliny na liście dnia.

## 3. Struktura komponentów
### Drzewo komponentów (wysoki poziom)
```
src/pages/calendar/day/index.astro
└─ redirect -> /calendar/day/:date

src/pages/calendar/day/[date].astro
└─ <Layout>
   └─ <CalendarDayView client:load ... />
      ├─ <Header /> (data + „Dziś” + powrót do miesiąca)
      ├─ <CalendarStatusFilter /> (status)
      ├─ <CalendarDaySortControls /> (sort + order)
      ├─ <AdhocWateringCta /> (CTA + dialog)
      ├─ <InlineAlertArea /> (np. 409 / błędy mutacji)
      └─ <CalendarDayTaskList>
         └─ n × <WateringTaskRow>
            ├─ <TaskMeta />
            └─ <TaskActions> (Potwierdź/Cofnij/Edycja/Usuń)
               ├─ <EditWateringEntryDialog />
               └─ <ConfirmDeleteDialog />
```

### Pliki (obecne + planowane)
- **Routing (Astro)**:
  - `src/pages/calendar/day/index.astro` (jest)
  - `src/pages/calendar/day/[date].astro` (jest)
- **Widok (React)**:
  - `src/components/calendar/day/CalendarDayView.tsx` (jest, do rozbudowy)
  - `src/components/calendar/day/CalendarDayTaskList.tsx` (jest, do refaktoru pod akcje)
  - `src/components/calendar/day/WateringTaskRow.tsx` (nowy, rekomendowany)
  - `src/components/calendar/day/EditWateringEntryDialog.tsx` (nowy)
  - `src/components/calendar/day/ConfirmDeleteDialog.tsx` (nowy)
  - `src/components/calendar/day/AdhocWateringDialog.tsx` (nowy)
  - `src/components/calendar/day/PlantPicker.tsx` (nowy; alternatywnie w `src/components/plants/`)
- **Hooki**:
  - `src/components/hooks/use-calendar-day.ts` (jest; rozszerzyć o API dla optimistic update/invalidate)
  - `src/components/hooks/use-watering-task-mutations.ts` (nowy)
  - `src/components/hooks/use-plant-search.ts` (nowy; dla PlantPicker)
- **Klienci API po stronie frontendu**:
  - `src/lib/services/calendar/day-client.ts` (jest)
  - `src/lib/services/watering-tasks/adhoc-client.ts` (jest, ale bez typowania błędów – rekomendowane ulepszenie)
  - `src/lib/services/watering-tasks/watering-task-client.ts` (nowy: PATCH/DELETE `/api/watering-tasks/:id`)
  - `src/lib/services/plants/plants-client.ts` (nowy: GET `/api/plants` pod PlantPicker)

## 4. Szczegóły komponentu
Poniżej opisane komponenty są „kontraktami implementacyjnymi” – inny dev powinien móc je wdrożyć 1:1.

### `src/pages/calendar/day/index.astro`
- **Opis**: Serwerowy redirect do dzisiejszej daty (już istnieje).
- **Główne elementy**: `Astro.redirect(...)`.
- **Obsługiwane zdarzenia**: brak.
- **Warunki walidacji**: brak danych wejściowych od usera.
- **Typy**: brak.
- **Propsy**: brak.

### `src/pages/calendar/day/[date].astro`
- **Opis**: Strona routingu dla widoku dnia. Wyciąga `date` i query paramy, normalizuje je (fallback do domyślnych) i renderuje React island.
- **Główne elementy**:
  - `<Layout title=...>`
  - `<CalendarDayView client:load ... />`
- **Obsługiwane zdarzenia**: brak (to routing).
- **Warunki walidacji**:
  - `date` musi mieć format `YYYY-MM-DD` (regex); w razie błędu tytuł „Kalendarz — niepoprawna data” i dalej UI pokaże `CalendarErrorState` z VM walidacji (już działa).
  - `status|sort|order`: normalizacja przez `normalizeCalendarDayStatus/Sort/Order` (już działa).
- **Typy**:
  - `CalendarTaskStatusFilter`, `CalendarTaskSortField`, `SortOrder` (`src/lib/services/calendar/types.ts`)
- **Propsy** (do `CalendarDayView`):
  - `date: string`
  - `status: CalendarTaskStatusFilter`
  - `sort: CalendarTaskSortField`
  - `order: SortOrder`

### `src/components/calendar/day/CalendarDayView.tsx`
- **Opis**: Główny kontener widoku dnia. Odpowiada za:
  - pobranie danych (`useCalendarDay`),
  - zbudowanie VM dla header/filtrów,
  - render listy + CTA ad hoc,
  - koordynację mutacji (confirm/undo/edit/delete/adhoc) i komunikatów.
- **Główne elementy UI**:
  - `<main>` z marginesami (`max-w-3xl`, padding)
  - `<header>` z datą i linkiem do miesiąca + link „Dziś”
  - `<CalendarStatusFilter />` (status)
  - `<CalendarDaySortControls />` (sort + order)
  - `CTA` „Dodaj wpis ad hoc”
  - `InlineAlertArea` na błędy mutacji/konflikt 409 (zalecane `role="status"` / `aria-live`)
  - `<CalendarDayTaskList />` albo `<CalendarDayEmptyState />`
- **Obsługiwane zdarzenia**:
  - klik `Potwierdź` → PATCH taska (optimistic)
  - klik `Cofnij` → PATCH taska (optimistic)
  - klik `Edytuj` → otwarcie `EditWateringEntryDialog` + PATCH po submit
  - klik `Usuń` → otwarcie `ConfirmDeleteDialog` + DELETE po potwierdzeniu
  - klik `Dodaj wpis ad hoc` → otwarcie `AdhocWateringDialog` + POST po submit
  - klik linków filtra/sortu/order → nawigacja (pełny reload strony Astro; spójne z miesiącem)
- **Warunki walidacji (frontend)**:
  - blokada akcji przy aktywnej mutacji dla danej pozycji (anti double-submit).
  - `adhoc`:
    - brak przycisku „Cofnij” (backend blokuje ustawienie `pending` dla adhoc).
    - w edycji status dla adhoc zablokowany na `completed`.
  - delete:
    - dla `scheduled`: UI nie powinien oferować „Usuń wpis” gdy `status !== completed` (backend zwróci 409 `NOT_ALLOWED`).
  - 409 dla ad hoc (TASK_ALREADY_EXISTS): pokaż komunikat i umożliw wyróżnienie istniejącej pozycji (patrz sekcja 10).
- **Typy (DTO/VM)**:
  - VM: `CalendarDayVm`, `CalendarDayHeaderVm`, `CalendarDayTaskVm`, `CalendarStatusFilterOption`, `CalendarDaySortOption`, `CalendarDayOrderOption` (`src/lib/services/calendar/day-view-model.ts`)
  - DTO mutacji: `UpdateWateringTaskCommand`, `UpdateWateringTaskResultDto`, `DeleteWateringTaskResultDto`, `AdhocWateringCommand`, `AdhocWateringResultDto` (`src/types.ts`)
  - **Nowe**: `CalendarDayMutationErrorVm` (local), `CalendarDayHighlightVm` (local)
- **Propsy**:
  - `CalendarDayViewProps` (już jest): `{ date: string; status?: CalendarTaskStatusFilter; sort?: CalendarTaskSortField; order?: SortOrder }`

### `src/components/calendar/day/CalendarDayTaskList.tsx` (do refaktoru)
- **Opis**: Lista pozycji dla dnia. Wymagania produktu mówią o dużych akcjach na wierszu, więc lista powinna renderować nowy komponent `WateringTaskRow` zamiast statycznego carda.
- **Główne elementy UI**:
  - `<ul>` z `<li>`
  - `n × <WateringTaskRow />`
- **Obsługiwane zdarzenia**:
  - delegowane do `WateringTaskRow` (confirm/undo/edit/delete).
- **Warunki walidacji**:
  - brak własnych; lista tylko przekazuje `disabled` i callbacki.
- **Typy**:
  - `CalendarDayTaskVm[]`
- **Propsy (proponowany kontrakt)**:
  - `items: CalendarDayTaskVm[]`
  - `pendingByTaskId: Record<string, boolean>` (lub `Set<string>`)
  - `onConfirm(taskId: string): void`
  - `onUndo(taskId: string): void`
  - `onEdit(taskId: string): void`
  - `onDelete(taskId: string): void`
  - `highlightPlantId?: string` (opcjonalnie, dla 409)

### `src/components/calendar/day/WateringTaskRow.tsx` (nowy)
- **Opis**: Pojedynczy wiersz zadania podlewania (czytelny na mobile). Powinien pokazywać:
  - roślina: `display_name` + (opcjonalnie) `nickname`,
  - status (pending/completed),
  - źródło (scheduled/adhoc),
  - notatka,
  - akcje.
- **Główne elementy UI**:
  - `<li id="plant-<plantId>">` (dla anchor/scroll)
  - kontener w stylu card: `<article className="rounded-xl border bg-card p-4 ...">`
  - sekcja meta:
    - `<p>` nazwa rośliny
    - `<p>` nickname (jeśli istnieje)
    - badge statusu + badge źródła
  - sekcja akcji:
    - `Button`: „Potwierdź” lub „Cofnij”
    - `Button`: „Edytuj”
    - `Button`: „Usuń”
- **Obsługiwane zdarzenia**:
  - `onConfirm(task.id)`
  - `onUndo(task.id)`
  - `onEdit(task.id)`
  - `onDelete(task.id)`
- **Warunki walidacji**:
  - jeśli `task.status === 'pending'` → pokazuj „Potwierdź”
  - jeśli `task.status === 'completed' && task.source === 'scheduled'` → pokazuj „Cofnij”
  - jeśli `task.source === 'adhoc'` → nie pokazuj „Cofnij” (lub disabled z tooltipem)
  - jeśli `task.source === 'scheduled' && task.status !== 'completed'` → nie pokazuj „Usuń wpis” (opcjonalnie: pokazuj disabled z opisem)
  - podczas `pending` dla taska → disable wszystkich przycisków + spinner/tekst „Zapisywanie…”
- **Typy**:
  - `CalendarDayTaskVm` (rozszerzony – patrz sekcja 5)
- **Propsy**:
  - `task: CalendarDayTaskVm`
  - `isPending?: boolean`
  - `isHighlighted?: boolean`
  - `onConfirm(taskId: string): void`
  - `onUndo(taskId: string): void`
  - `onEdit(taskId: string): void`
  - `onDelete(taskId: string): void`

### `src/components/calendar/day/EditWateringEntryDialog.tsx` (nowy)
- **Opis**: Dialog edycji wpisu podlewania (status, `completed_on`, notatka) zgodnie z API `PATCH /api/watering-tasks/{taskId}`.
- **Główne elementy UI**:
  - `Dialog` (shadcn) z:
    - pole `Status` (select lub radio) – dla `adhoc` tylko `completed` (disabled)
    - pole `Data wykonania` (`completed_on`) – input date lub prosty tekst + walidacja ISO
    - pole `Notatka` (`textarea`)
    - przyciski: Anuluj / Zapisz
- **Obsługiwane zdarzenia**:
  - `onOpenChange(false)` – zamknięcie
  - `onSubmit(command: UpdateWateringTaskCommand)`
- **Warunki walidacji (muszą odzwierciedlać backend)**:
  - co najmniej jedno pole zmienione / przekazane (backend: `NO_FIELDS_TO_UPDATE` / „At least one field must be provided”)
  - jeśli `status === 'completed'` → `completed_on` wymagane
  - jeśli `status === 'pending'` → `completed_on` nie może być podane
  - `note`:
    - trim, pusty string → `null`
    - długość `<= 500`
  - jeśli `task.source === 'adhoc'`:
    - `status` nie może być ustawiony na `pending` (backend zwraca 409 `CONSTRAINT_VIOLATION`) → zablokować w UI
- **Typy**:
  - `UpdateWateringTaskCommand` (`src/types.ts`)
  - `UpdateWateringTaskResultDto` (na potrzeby obsługi sukcesu)
  - `ValidationIssueVm` (local; mapowanie `details.issues[]` lub `details.fields`)
- **Propsy (proponowany kontrakt)**:
  - `open: boolean`
  - `task: CalendarDayTaskVm`
  - `dateContext: string` (aktualny dzień widoku – do domyślnego `completed_on`)
  - `pending?: boolean`
  - `error?: { message: string; fieldErrors?: Record<string, string[]> } | null`
  - `onOpenChange(open: boolean): void`
  - `onSubmit(command: UpdateWateringTaskCommand): void`

### `src/components/calendar/day/ConfirmDeleteDialog.tsx` (nowy)
- **Opis**: Dialog potwierdzający operację „Usuń wpis”. Operacja różni się w zależności od źródła:
  - `adhoc`: realnie usuwa rekord (`DELETE`)
  - `scheduled` (tylko gdy `completed`): resetuje wpis do `pending` i czyści `note` (`DELETE` w backendzie robi reset)
- **Główne elementy UI**:
  - `AlertDialog` (shadcn) z dynamicznym opisem i „Usuń / Anuluj”.
- **Obsługiwane zdarzenia**:
  - `onConfirm(taskId)`
  - `onOpenChange(false)`
- **Warunki walidacji**:
  - jeśli `task.source === 'scheduled'` i `task.status !== 'completed'` → nie pozwalaj otworzyć dialogu (lub pokaż disabled + opis).
  - zawsze wysyłaj `confirm=true` w query (backend wymaga).
- **Typy**:
  - `DeleteWateringTaskResultDto` (`src/types.ts`)
- **Propsy**:
  - `open: boolean`
  - `task: CalendarDayTaskVm`
  - `pending?: boolean`
  - `onOpenChange(open: boolean): void`
  - `onConfirm(taskId: string): void`

### `src/components/calendar/day/AdhocWateringDialog.tsx` (nowy)
- **Opis**: Dialog dodawania wpisu ad hoc (PlantPicker + data + notatka) → `POST /api/plants/{plantId}/watering/adhoc`.
- **Główne elementy UI**:
  - `Dialog` z:
    - `PlantPicker` (wyszukiwarka roślin)
    - `completed_on` (domyślnie bieżący dzień widoku)
    - `note` (textarea, opcjonalna)
    - przyciski: Anuluj / Dodaj
- **Obsługiwane zdarzenia**:
  - `onSubmit(plantId, command)`
- **Warunki walidacji (backend)**:
  - `plantId` musi być UUID (w UI: wymagane, blokuj submit dopóki nie wybrano).
  - `completed_on` wymagane i poprawne ISO (YYYY-MM-DD).
  - `note` trim + max 500.
- **Typy**:
  - `AdhocWateringCommand`, `AdhocWateringResultDto` (`src/types.ts`)
- **Propsy**:
  - `open: boolean`
  - `defaultCompletedOn: string`
  - `pending?: boolean`
  - `error?: { message: string } | null`
  - `onOpenChange(open: boolean): void`
  - `onSubmit(plantId: string, command: AdhocWateringCommand): void`

### `src/components/calendar/day/PlantPicker.tsx` (nowy)
- **Opis**: Wybór rośliny do wpisu ad hoc. MVP: wyszukiwarka oparta o `GET /api/plants?q=...&limit=...`.
- **Główne elementy UI** (minimalne, bez ciężkich zależności):
  - `Input` (query) + lista wyników (np. `<ul role="listbox">`)
  - element wyniku jako `<button type="button">`
  - `aria-activedescendant` / prostszy wariant: w pełni klikalne przyciski + focus
- **Obsługiwane zdarzenia**:
  - `onQueryChange(q)`
  - `onSelect(plant: PlantListItemDto)`
  - `onClear()`
- **Warunki walidacji**:
  - `q` max 120 znaków (zgodnie z backendem).
  - debounce 300–500ms.
- **Typy**:
  - `PlantListItemDto` (`src/types.ts`)
- **Propsy**:
  - `value?: PlantListItemDto | null`
  - `onChange(next: PlantListItemDto | null): void`

## 5. Typy
### DTO (istniejące, backend/transport)
- **`CalendarDayResponseDto`** (`src/types.ts`):
  - `date: string` (`YYYY-MM-DD`)
  - `items: CalendarTaskSummaryDto[]`
- **`CalendarTaskSummaryDto`** (`src/types.ts`):
  - `task`: `WateringTaskSummaryFields` (`id`, `due_on`, `status`, `source`, `note`, `completed_at`, `completed_on`)
  - `plant`: `{ id, display_name, nickname }`
- **Mutacje** (`src/types.ts`):
  - `UpdateWateringTaskCommand`: `{ status?: 'pending'|'completed'; completed_on?: string; note?: string|null }`
  - `UpdateWateringTaskResultDto`: `{ task: WateringTaskSummaryFields; schedule_effect: { tasks_regenerated: boolean; reason: string|null } }`
  - `AdhocWateringCommand`: `{ completed_on: string; note: string|null }`
  - `AdhocWateringResultDto`: `{ task: WateringTaskSummaryFields & { plant_id: string } }`
  - `DeleteWateringTaskResultDto`: `{ deleted: true; task_id: string }`

### ViewModel (istniejące, do rozszerzenia)
Aktualny VM w `src/lib/services/calendar/day-view-model.ts` nie przenosi `plant.id` ani `nickname`. Dla wymagań widoku dziennego (wyświetlanie nickname + highlight po 409) rekomendowane jest rozszerzenie:

- **`CalendarDayTaskVm` (zmiana rekomendowana)**:
  - `id: string` (task id)
  - `plantId: string` (NOWE)
  - `plantDisplayName: string` (zamiast `plantName`, lub alias)
  - `plantNickname?: string | null` (NOWE)
  - `note?: string | null`
  - `status: 'pending' | 'completed'`
  - `source: 'scheduled' | 'adhoc'` (zawęzić z `string` → union)
  - `sourceLabel: string` (NOWE; np. „Zaplanowane”, „Ad hoc”)
  - `completedOn?: string | null`
  - `isAdhoc: boolean` (NOWE; ułatwia warunki UI)
  - `isScheduled: boolean` (NOWE)
- **`CalendarDayVm`** (bez zmian krytycznych):
  - `date`, `status`, `sort`, `order`, `items`, `hasTasks`

### Typy lokalne (frontend, rekomendowane)
- **`CalendarDayMutationState`**:
  - `pendingByTaskId: Record<string, boolean>`
  - `pendingGlobal?: boolean` (dla dialogów ad hoc)
  - `error?: { kind: 'conflict'|'validation'|'http'|'network'|'unknown'; message: string; details?: unknown } | null`
- **`HighlightState`**:
  - `highlightPlantId?: string`
  - `highlightTaskId?: string` (opcjonalnie)
  - `source?: 'adhoc_conflict'|'user_action'`

## 6. Zarządzanie stanem
### Podejście bazowe (spójne z repo)
- **Fetch**: zostaje w `useCalendarDay` (jest).
- **Mutacje**: dodać dedykowany hook `useWateringTaskMutations`, który:
  - trzyma mapę `pendingByTaskId`,
  - wykonuje optimistic update na liście (confirm/undo),
  - po sukcesie robi `reload()` oraz **inwaliduje cache miesiąca** (patrz niżej),
  - mapuje błędy do komunikatów UI.

### Proponowane hooki
- **`useCalendarDay(...)` (rozszerzenie, opcjonalnie)**:
  - dodać eksportowaną funkcję `invalidateCalendarDayCache(prefix: string)` albo przenieść cache do wspólnego modułu, aby mutacje mogły kasować wpisy cache (dzień + miesiąc).
- **`useWateringTaskMutations({ date, onAfterSuccess })`** (nowy):
  - `confirmTask(task: CalendarDayTaskVm)` → PATCH `{ status:'completed', completed_on: date }` + optimistic
  - `undoTask(task: CalendarDayTaskVm)` → PATCH `{ status:'pending' }` + optimistic (tylko scheduled)
  - `editTask(taskId, command)` → PATCH (bez optimistic; po sukcesie reload)
  - `deleteTask(task: CalendarDayTaskVm)` → DELETE `?confirm=true` (bez optimistic; po sukcesie reload)
  - `createAdhoc(plantId, command)` → POST (bez optimistic; po sukcesie reload)
- **`usePlantSearch({ q, limit })`** (nowy):
  - debounce + fetch `/api/plants?q=...&limit=...`

### Inwalidacja/odświeżanie kalendarza (wymóg PRD: „odświeża się po każdej zmianie”)
W repo istnieje cache w `useCalendarDay` i `useCalendarMonth` (Map w module). Żeby uniknąć sytuacji „wracam do miesiąca i widzę stary stan”, plan zakłada:

- po każdej mutacji, która zmienia status/daty:
  - **usunąć wpisy cache** dla:
    - dnia `date` (wszystkie kombinacje status/sort/order – najprościej: `cache.clear()` w hooku lub invalidacja prefixem),
    - miesiąca `date.slice(0,7)` (wszystkie statusy).
  - oraz wykonać `reload()` w aktualnym widoku dnia.

## 7. Integracja API
### GET `/api/calendar/day`
- **Wywołanie**: `getCalendarDay({ date, status, sort, order })` z `src/lib/services/calendar/day-client.ts`.
- **Walidacja wejścia (frontend)**:
  - `date` format regex (w `useCalendarDay`), reszta przez normalizatory.
  - i tak trzeba obsłużyć 400 `VALIDATION_ERROR` z backendu (np. data nieistniejąca jak 2026-02-31).
- **Odpowiedź**:
  - envelope: `{ data: CalendarDayResponseDto, error: null, meta: { request_id } }`
- **Frontend mapping**:
  - `buildCalendarDayVm(...)` → `CalendarDayVm`

### PATCH `/api/watering-tasks/{taskId}`
- **Wywołanie**: nowy klient `watering-task-client.ts`:
  - `updateWateringTask(taskId, command)`
- **Request body**: `UpdateWateringTaskCommand`
- **Kluczowe scenariusze w widoku**:
  - **confirm**: `{ status: 'completed', completed_on: <date_z_widoku> }`
  - **undo** (scheduled): `{ status: 'pending' }`
  - **edit**: kombinacja pól zgodna z walidacją (np. zmiana notatki bez statusu)
- **Odpowiedź**:
  - `UpdateWateringTaskResultDto` (uwaga: zwraca tylko `task` bez danych rośliny → po sukcesie zwykle `reload()` dla pełnego odświeżenia listy).
- **Błędy, które musimy obsłużyć w UI** (minimum):
  - `401 UNAUTHENTICATED` → stan błędu jak w day-client (`kind='unauthenticated'`), ewentualnie CTA do logowania.
  - `422 VALIDATION_ERROR` / `NO_FIELDS_TO_UPDATE` → błędy formularza dialogu.
  - `409 CONSTRAINT_VIOLATION` → komunikat + rollback optimistic.
  - `404 WATERING_TASK_NOT_FOUND` → toast + reload.

### DELETE `/api/watering-tasks/{taskId}?confirm=true`
- **Wywołanie**: `deleteWateringTask(taskId)` w nowym kliencie.
- **Warunek wejścia**: zawsze `confirm=true` (backend: `CONFIRMATION_REQUIRED`).
- **Zachowanie**:
  - `adhoc` → usuwa rekord
  - `scheduled` → tylko gdy `completed`, resetuje do `pending` i czyści pola (`note` też)
- **Błędy**:
  - `409 NOT_ALLOWED` gdy próbujemy resetować scheduled, które nie jest completed → UI nie powinien do tego dopuścić.

### POST `/api/plants/{plantId}/watering/adhoc`
- **Wywołanie**: `createAdhocWateringEntry` z `src/lib/services/watering-tasks/adhoc-client.ts` (albo ulepszony klient z typowaniem błędów).
- **Request body**: `AdhocWateringCommand`
- **Success**:
  - 201 + `AdhocWateringResultDto` + `Location` wskazujący `/api/watering-tasks/{id}`
  - po sukcesie: `reload()` + invalidacja cache miesiąca
- **Błędy**:
  - `409 TASK_ALREADY_EXISTS` → wymagany UX (patrz sekcja 10)
  - `404 PLANT_NOT_FOUND` → komunikat (np. roślina usunięta w tle)
  - `400 VALIDATION_ERROR` → błędy formularza

### GET `/api/plants` (pod PlantPicker)
- **Wywołanie**: nowy klient `plants-client.ts`:
  - `listPlants({ q, limit, sort?, order?, cursor? })`
- **Użycie**: tylko `q` + `limit` (MVP), sort opcjonalnie.

## 8. Interakcje użytkownika
### Lista interakcji i oczekiwane rezultaty
- **Wejście na widok**:
  - pobiera dane dnia i renderuje listę lub pusty stan.
- **Filtr statusu**:
  - zmienia URL (link), widok przeładowuje się i pobiera dane ponownie.
- **Potwierdź (scheduled pending)**:
  - natychmiast pokazuje status „Ukończone” (optimistic),
  - wysyła PATCH,
  - po sukcesie: utrzymuje stan, wyświetla komunikat „Zapisano” (opcjonalnie), inwaliduje cache miesiąca,
  - po błędzie: rollback + komunikat błędu.
- **Cofnij (scheduled completed)**:
  - natychmiast pokazuje „Do wykonania” (optimistic),
  - wysyła PATCH `{ status:'pending' }`,
  - po błędzie: rollback.
- **Edytuj**:
  - otwiera dialog, waliduje lokalnie, wysyła PATCH,
  - po sukcesie: zamyka dialog + reload listy.
- **Usuń wpis**:
  - otwiera dialog z odpowiednim copy (adhoc vs scheduled),
  - po potwierdzeniu: wysyła DELETE `?confirm=true`,
  - po sukcesie: reload listy.
- **Dodaj wpis ad hoc**:
  - otwiera dialog, wybór rośliny + data,
  - po sukcesie: reload listy,
  - po 409: komunikat + link/scroll do rośliny (bez reload, bo i tak istnieje).

### Mapowanie user stories → implementacja
- **US-005 (widok dzienny + potwierdzanie)**:
  - `CalendarDayView` + `useCalendarDay` + `WateringTaskRow` z akcjami.
  - confirm/undo: `useWateringTaskMutations.confirmTask/undoTask` + optimistic update.
  - „natychmiast” → optimistic UI + odświeżenie cache miesiąca.
- **US-006 (edycja wpisu)**:
  - `EditWateringEntryDialog` + `updateWateringTask(...)`.
  - walidacja zgodna z backendem (sekcja 9).
  - odświeżenie dnia i miesiąca po sukcesie.

## 9. Warunki i walidacja
### Walidacje na poziomie routingu / widoku
- `date`:
  - w `[date].astro`: normalize + przekazanie do `CalendarDayView`
  - w `useCalendarDay`: jeśli format niepoprawny → error VM `buildCalendarDayValidationErrorVm`
  - jeśli data istnieje, ale jest „nierealna” (np. 2026-02-31) → backend zwróci `VALIDATION_ERROR`; UI pokaże `CalendarErrorState`.

### Walidacje akcji / komponentów (zgodne z API)
- **Confirm (PATCH)**:
  - dozwolone tylko gdy `task.status === 'pending'`
  - payload: `status='completed'` wymaga `completed_on` (backend wymaga)
- **Undo (PATCH)**:
  - dozwolone tylko gdy `task.source === 'scheduled' && task.status === 'completed'`
  - payload: `status='pending'` nie może mieć `completed_on`
- **Edit (PATCH)**:
  - minimum jedno pole
  - `status='completed'` → `completed_on` wymagane
  - `status='pending'` → `completed_on` zabronione
  - adhoc → `status` nie może być `pending` (zablokować UI)
  - `note` trim + max 500 (pusty → null)
- **Delete (DELETE)**:
  - zawsze `confirm=true`
  - `scheduled` można „usunąć wpis” tylko jeśli `status='completed'` (inaczej backend 409 `NOT_ALLOWED`)
- **Ad hoc (POST)**:
  - `plantId` wymagane
  - `completed_on` wymagane i poprawne ISO
  - `note` trim + max 500

## 10. Obsługa błędów
### Błędy pobierania listy (GET /api/calendar/day)
Obsługa już istnieje poprzez `CalendarDayApiError` i `CalendarErrorState`. Należy dopilnować:

- `unauthenticated`: w MVP może zostać w `CalendarErrorState`; docelowo (zgodnie z `ui-plan`) dodać CTA/przekierowanie do `/auth/login` z `returnTo` gdy routy auth będą dostępne.

### Błędy mutacji (PATCH/DELETE/POST)
Rekomendacja: centralnie mapować błędy w `useWateringTaskMutations` i pokazywać je:

- jako inline `Alert`/Card nad listą (łatwiejsze bez dodatkowych komponentów UI),
- lub jako toast (jeśli dołożycie shadcn/sonner).

#### Konflikt 409 dla ad hoc („Na ten dzień istnieje już wpis podlewania”)
Wymagany UX z `ui-plan.md`:

- jeśli `createAdhocWateringEntry` zwróci 409 `TASK_ALREADY_EXISTS`:
  - pokaż komunikat: **„Na ten dzień istnieje już wpis podlewania.”**
  - dodaj link „Pokaż na liście”:
    - wariant A (rekomendowany, bez routera): `href="#plant-<plantId>"`
    - wariant B: nawigacja do `/calendar/day/<date>?highlightPlantId=<plantId>#plant-<plantId>`
  - dodatkowo uruchom `scrollIntoView` + chwilowy highlight (np. ring/border) na `WateringTaskRow`.

#### Walidacje formularzy (400/422)
- mapuj backend `details`:
  - `UpdateWateringTaskRequest` zwraca `details.issues[]` (ścieżka + message) – pokaż pod polami.
  - `CalendarDay` GET zwraca `details.fields` – już mapowane w VM.
- utrzymuj błędy w stanie dialogu i czyść po zamknięciu.

#### Rollback optimistic
- dla confirm/undo:
  - przed zmianą zapisz snapshot taska (status, completedOn, note jeśli modyfikowane),
  - przy błędzie przywróć snapshot.

## 11. Kroki implementacji
1. **Rozszerz VM dnia** w `src/lib/services/calendar/day-view-model.ts`:
   - dodaj do `CalendarDayTaskVm`: `plantId`, `plantNickname`, zawęź `source` do union, dodaj `isAdhoc/isScheduled` i etykiety źródła.
   - zaktualizuj mapper `toTaskVm(...)` (ma dostęp do `dto.items[].plant`).
2. **Zrefaktoruj listę**:
   - z `CalendarDayTaskList` wyciągnij `WateringTaskRow` i dodaj sekcję akcji.
   - dodaj `id="plant-<plantId>"` do wiersza (pod highlight/anchor).
3. **Dodaj klientów dla mutacji**:
   - `src/lib/services/watering-tasks/watering-task-client.ts`:
     - `updateWateringTask(taskId, command)`
     - `deleteWateringTask(taskId)` (zawsze `confirm=true`)
   - (opcjonalnie) ujednolić styl błędów na wzór `CalendarDayApiError`.
4. **Dodaj hook mutacji**:
   - `src/components/hooks/use-watering-task-mutations.ts` z:
     - `pendingByTaskId`, `error`, `clearError`
     - `confirm/undo/edit/delete/createAdhoc`
     - invalidacją cache miesiąca i dnia.
5. **Dodaj dialogi**:
   - `EditWateringEntryDialog` z walidacją zgodną z API,
   - `ConfirmDeleteDialog` z copy zależnym od `source`,
   - `AdhocWateringDialog` (PlantPicker + date + note).
6. **Zaimplementuj PlantPicker**:
   - klient `plants-client.ts` + hook `use-plant-search` z debounce,
   - UI z listą wyników i wyborem.
7. **Wbuduj mutacje w `CalendarDayView`**:
   - przekazuj callbacki do listy,
   - pokaż inline komunikaty błędów (w tym 409) + link do wyróżnienia.
8. **Obsłuż highlight rośliny**:
   - parsuj `highlightPlantId` z URL (lub hash),
   - po mount `scrollIntoView` + highlight przez 2–3 sekundy.
9. **Dopracuj dostępność i UX**:
   - focus management w dialogach,
   - `aria-live` dla komunikatów,
   - blokada przycisków w trakcie requestów.
10. **Zadbaj o „odświeżanie kalendarza”**:
   - inwaliduj cache miesiąca po mutacji,
   - po powrocie do miesiąca wymuś pobranie świeżych danych (np. przez czyszczenie Map cache w hooku).
