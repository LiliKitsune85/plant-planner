## Plan implementacji widoku „Proponowany plan podlewania” (`/plants/:plantId/watering-plan`)

## 1. Przegląd
Widok **„Proponowany plan podlewania”** jest drugim krokiem flow po utworzeniu rośliny. Jego zadania (PRD + US-002/US-003 + `ui-plan.md`):

- **Wygenerować i pokazać sugestię AI** (albo czytelnie pokazać powód braku sugestii) w budżecie **≤ 5 s**.
- Pozwolić użytkownikowi:
  - **Akceptować** sugestię bez zmian (zapis planu do DB),
  - **Edytować i zapisać** plan (zachowując, że źródło to AI, ale `accepted_without_changes=false`),
  - **Odrzucić AI i ustawić plan ręcznie** (źródło `manual`).
- Wymusić spójność z API:
  - Sugestia zawiera `interval_days` + `explanation` (explanation wyświetlana, **nie zapisywana**).
  - Zapis planu odbywa się przez `PUT /api/plants/{plantId}/watering-plan` i **musi** nieść informacje czy plan był zaakceptowany bez zmian (w DB poprzez `was_ai_accepted_without_changes`).
- Zapewnić poprawny UX w sytuacjach: `AI_RATE_LIMITED` (429), `AI_TIMEOUT` (408), `AI_PROVIDER_ERROR` (502), `UNAUTHENTICATED` (401), `PLANT_NOT_FOUND` (404), walidacje 422.

W repo istnieje już komplet fundamentów do takiej implementacji:
- wzorzec `client fetcher` + `ApiError` + `hook` + `view-model` (kalendarz, watering tasks),
- komponenty shadcn (`Button`, `Card`, prosty `Modal`) i spójny `ErrorState` w kalendarzu.

Ważna obserwacja dot. obecnego backendu:
- `POST /api/plants` **nie zwraca jeszcze** realnej sugestii AI (aktualnie `status='skipped'` i tekst „not implemented yet”).
- `POST /api/plants/{plantId}/watering-plan/suggest` jest za to zaimplementowany i jest głównym źródłem sugestii AI dla tego widoku.
- `PUT /api/plants/{plantId}/watering-plan` ma implementację serwisową i walidację requestu, ale **brakuje** jeszcze pliku endpointu w `src/pages/api/...` (widok powinien traktować to jako zależność; patrz sekcja 7 i 11).

## 2. Routing widoku
- **Ścieżka**: `/plants/:plantId/watering-plan`
- **Plik routingu (Astro)**: `src/pages/plants/[plantId]/watering-plan/index.astro`
- **Renderowanie**:
  - `export const prerender = false`
  - Strona Astro osadza React island: `<PlantWateringPlanView client:load ... />`
- **Parametry path**:
  - `plantId` (wymagany): UUID
- **Query params (opcjonalne, rekomendowane dla UX)**:
  - `mode?: 'suggest' | 'edit'` — pozwala deep-linkować do edytora bez rozbudowy routingu (domyślnie `suggest`).
  - `species_name?: string` — opcjonalnie jako fallback, jeśli widok nie może pobrać `species_name` z API (patrz sekcja 7.1).

## 3. Struktura komponentów
### Drzewo komponentów (wysoki poziom)
```
src/pages/plants/[plantId]/watering-plan/index.astro
└─ <Layout>
   └─ <PlantWateringPlanView client:load plantId mode initialSpeciesName? />
      ├─ <PlantWateringPlanHeader />
      ├─ <WateringPlanStateBoundary>
      │  ├─ <FullScreenState /> (ładowanie sugestii, ≤5s)
      │  ├─ <AiSuggestionCard /> (status=available)
      │  ├─ <AiBlockedState /> (status=rate_limited)
      │  ├─ <AiErrorState /> (status=timeout/provider_error)
      │  └─ <AiSkippedState /> (status=skipped)
      ├─ <WateringPlanEditor /> (mode=edit)
      │  ├─ <WateringPlanFormCard />
      │  │  └─ <WateringPlanForm />
      │  │     ├─ IntervalDaysField
      │  │     ├─ StartFromField + CustomStartOnField
      │  │     └─ AdvancedSection (collapsible)
      │  │        ├─ HorizonDaysField (default 90)
      │  │        ├─ ScheduleBasisField (default completed_on)
      │  │        └─ OverduePolicyField (default carry_forward)
      │  └─ <EditorActions /> (Zapisz/Wróć)
      └─ <InlineAlertArea /> (błędy zapisu, request_id, itp.)
```

### Lokalizacje plików (propozycja)
- Routing:
  - `src/pages/plants/[plantId]/watering-plan/index.astro`
- Komponenty widoku:
  - `src/components/plants/watering-plan/PlantWateringPlanView.tsx`
  - `src/components/plants/watering-plan/PlantWateringPlanHeader.tsx`
  - `src/components/plants/watering-plan/AiSuggestionCard.tsx`
  - `src/components/plants/watering-plan/AiErrorState.tsx`
  - `src/components/plants/watering-plan/AiBlockedState.tsx`
  - `src/components/plants/watering-plan/AiSkippedState.tsx`
  - `src/components/plants/watering-plan/WateringPlanEditor.tsx`
  - `src/components/plants/watering-plan/WateringPlanForm.tsx`
  - `src/components/plants/watering-plan/types.ts` (lokalne VM)
- Hooki:
  - `src/components/hooks/use-watering-plan-suggestion.ts`
  - `src/components/hooks/use-set-watering-plan.ts`
- Klienci API (frontend):
  - `src/lib/services/watering-plans/suggest-client.ts`
  - `src/lib/services/watering-plans/set-plan-client.ts`
  - (opcjonalnie) `src/lib/services/ai/quota-client.ts` — jeśli chcesz pokazywać pełny quota widget.

## 4. Szczegóły komponentu

### `src/pages/plants/[plantId]/watering-plan/index.astro`
- **Opis**: Routing SSR. Waliduje/normalizuje parametry i montuje React island.
- **Główne elementy**:
  - `<Layout title="Plan podlewania">`
  - `<PlantWateringPlanView client:load plantId={...} mode={...} initialSpeciesName={...} />`
- **Obsługiwane zdarzenia**: n/a.
- **Warunki walidacji**:
  - `plantId` musi wyglądać jak UUID (regex lub minimalna walidacja); jeśli nie — ustaw tytuł „Niepoprawna roślina” i przekaż `plantId` dalej, aby UI pokazało `validation` error state.
  - `mode`: normalizacja do `'suggest' | 'edit'` (domyślnie `'suggest'`).
- **Typy**:
  - `PlantWateringPlanMode` (nowy, sekcja 5)
- **Propsy do React**:
  - `plantId: string`
  - `mode: PlantWateringPlanMode`
  - `initialSpeciesName?: string` (z query `species_name`)

### `PlantWateringPlanView` (np. `src/components/plants/watering-plan/PlantWateringPlanView.tsx`)
- **Opis**: Kontener całego widoku. Koordynuje:
  - pozyskanie `species_name` (z „hand-off” po create, query param lub API),
  - wywołanie sugestii (`POST /watering-plan/suggest`),
  - przełączanie trybu `suggest` ↔ `edit`,
  - zapis planu (`PUT /watering-plan`) zgodnie z akcją użytkownika,
  - blokady przycisków i obsługę błędów.
- **Główne elementy**:
  - `<main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6" aria-live="polite">`
  - Nagłówek, sekcja contentu, sekcja alertów.
- **Obsługiwane zdarzenia**:
  - `onRetrySuggest()` → ponawia sugestię (pełny loader).
  - `onAccept()` → zapis planu AI `accepted_without_changes=true`.
  - `onEdit()` → przełącza na tryb edycji z prefill suggestion.
  - `onRejectToManual()` → tryb edycji z `source.type='manual'`.
  - `onSavePlan(values, source)` → wysyła `PUT`.
  - `onBackFromEditor()` → wraca do sugestii (jeśli jest) lub do stanu „manual” (jeśli brak sugestii).
- **Warunki walidacji**:
  - nie wołaj sugestii jeśli nie znasz `species_name` (wtedy `skipped`).
  - blokuj akcje podczas `isSaving===true` lub `isSuggesting===true`.
  - `Accept` dostępne tylko, gdy:
    - `suggestion.suggestion !== null` i
    - jest `ai_request_id`.
- **Typy (DTO + VM)**:
  - DTO: `WateringPlanSuggestionDto`, `SuggestWateringPlanCommand`, `SetWateringPlanCommand`, `SetWateringPlanResultDto` (`src/types.ts`)
  - VM: `AiSuggestionStateVm`, `WateringPlanFormVm`, `SetPlanErrorVm` (sekcja 5)
- **Propsy**:

```ts
export type PlantWateringPlanViewProps = {
  plantId: string
  mode?: PlantWateringPlanMode
  initialSpeciesName?: string
}
```

### `PlantWateringPlanHeader`
- **Opis**: Nagłówek strony + kontekst (co robimy i dla jakiej rośliny).
- **Główne elementy**:
  - `<header className="space-y-1">`
  - `<h1 className="text-xl font-semibold">Ustaw plan podlewania</h1>`
  - `<p className="text-sm text-muted-foreground">Na podstawie: {speciesName}</p>` (jeśli dostępne)
- **Obsługiwane zdarzenia**: n/a.
- **Walidacja**: n/a.
- **Typy**:
  - `speciesName?: string`
- **Propsy**:

```ts
export type PlantWateringPlanHeaderProps = {
  speciesName?: string
}
```

### `FullScreenState` (lokalnie w widoku albo współdzielone)
- **Opis**: Pełnoekranowy stan „Sugerowanie planu…” (budżet 5 s).
- **Główne elementy**:
  - `div` wypełniający viewport z:
    - spinnerem,
    - tytułem „Sugerowanie planu…”
    - opisem „To może potrwać do 5 sekund”
- **Obsługiwane zdarzenia**:
  - opcjonalnie: `Anuluj` → przejście do trybu manualnego (bez wołania AI ponownie).
- **Walidacja**: n/a.
- **Typy**: n/a.
- **Propsy**:

```ts
export type FullScreenStateProps = {
  title: string
  description?: string
  onCancel?: () => void
}
```

### `AiSuggestionCard`
- **Opis**: Karta z propozycją planu AI + explanation + akcje.
- **Główne elementy**:
  - `Card`
    - `CardHeader`: tytuł „Proponowany plan”
    - `CardContent`:
      - kluczowa wartość: `interval_days` (np. „Podlewaj co 7 dni”)
      - `explanation` (tekst, max ~800 znaków; może być dłuższy, więc dodaj clamp/„pokaż więcej” opcjonalnie)
      - sekcja „Szczegóły” (opcjonalnie, jako `<dl>`):
        - `start_from`, `overdue_policy`, itd.
    - `CardFooter`:
      - `Button` „Akceptuj”
      - `Button variant="outline"` „Edytuj i zapisz”
      - `Button variant="ghost"` „Odrzuć i ustaw ręcznie”
- **Obsługiwane zdarzenia**:
  - klik Akceptuj / Edytuj / Odrzuć.
- **Warunki walidacji**:
  - `Akceptuj` disabled jeśli brak `ai_request_id` lub brak `suggestion`.
  - W trakcie zapisu: disable wszystkich akcji.
- **Typy**:
  - `AiSuggestionAvailableVm`
- **Propsy**:

```ts
export type AiSuggestionCardProps = {
  suggestion: AiSuggestionAvailableVm
  isSaving: boolean
  onAccept: () => void
  onEdit: () => void
  onRejectToManual: () => void
}
```

### `AiBlockedState` (rate-limited)
- **Opis**: Stan dla `AI_RATE_LIMITED` z pokazaniem `unlock_at` i ścieżką „Ustaw ręcznie”.
- **Główne elementy**:
  - `Card` (lub full-screen, jeśli UX tak zakłada)
  - komunikat: „Limit AI został wykorzystany. Odblokowanie: {unlockAt}”
  - CTA:
    - `Button` „Ustaw ręcznie”
    - opcjonalnie `Button variant="outline"` „Wróć do rośliny” (jeśli istnieje widok szczegółów)
- **Obsługiwane zdarzenia**:
  - przejście do trybu manualnego (`mode='edit'` + `source='manual'`).
- **Walidacja**: n/a.
- **Typy**:
  - `AiSuggestionRateLimitedVm`
- **Propsy**:

```ts
export type AiBlockedStateProps = {
  unlockAt?: string | null
  onManual: () => void
  onBackToPlant?: () => void
}
```

### `AiErrorState` (timeout/provider_error)
- **Opis**: Stan dla błędów AI `AI_TIMEOUT` (408) i `AI_PROVIDER_ERROR` (502) oraz fallback retry/manual.
- **Główne elementy**:
  - `Card` w stylu błędu (jak `CalendarErrorState`)
  - tytuł zależny od scenariusza:
    - `AI_TIMEOUT`: „AI nie odpowiedziało na czas”
    - `AI_PROVIDER_ERROR`: „Wystąpił błąd dostawcy AI”
  - CTA:
    - `Button variant="outline"` „Spróbuj ponownie”
    - `Button` „Ustaw ręcznie”
- **Obsługiwane zdarzenia**:
  - retry → ponów sugestię,
  - manual → przejdź do edytora.
- **Warunki walidacji**:
  - retry disabled podczas aktywnego requestu.
- **Typy**:
  - `AiSuggestionErrorVm`
- **Propsy**:

```ts
export type AiErrorStateProps = {
  error: AiSuggestionErrorVm
  onRetry: () => void
  onManual: () => void
}
```

### `AiSkippedState`
- **Opis**: Gdy sugestia jest pominięta (brak `species_name` lub użytkownik nie chce AI) pokaż ścieżkę manualną.
- **Główne elementy**:
  - komunikat „Nie można wygenerować sugestii AI. Ustaw plan ręcznie.”
  - `Button` „Ustaw ręcznie”
- **Obsługiwane zdarzenia**:
  - przejście do edytora.
- **Walidacja**: n/a.
- **Typy**:
  - `AiSuggestionSkippedVm`
- **Propsy**:

```ts
export type AiSkippedStateProps = {
  reason?: string | null
  onManual: () => void
}
```

### `WateringPlanEditor`
- **Opis**: Kontener edytora (manual lub edycja AI). Składa `WateringPlanForm` + obsługa submitu + błędy 422 inline.
- **Główne elementy**:
  - `Card` z formularzem
  - sekcja błędów walidacji pól (inline pod polami) + błąd ogólny
- **Obsługiwane zdarzenia**:
  - `onSubmit(values)` → wywołanie `PUT`.
  - `onBack()` → powrót do sugestii.
- **Warunki walidacji**:
  - nie pozwól wysłać formularza, jeśli:
    - `interval_days` poza zakresem 1..365,
    - `start_from='custom_date'` i brak `custom_start_on`,
    - `custom_start_on` ustawione gdy `start_from != 'custom_date'`.
- **Typy**:
  - `WateringPlanFormValues`, `WateringPlanFormErrors`, `WateringPlanSourceVm`
- **Propsy**:

```ts
export type WateringPlanEditorProps = {
  mode: 'ai_edit' | 'manual'
  initialValues: WateringPlanFormValues
  isSaving: boolean
  saveError?: SetPlanErrorVm | null
  onSubmit: (values: WateringPlanFormValues) => void
  onBack: () => void
}
```

### `WateringPlanForm`
- **Opis**: Formularz (prezentacyjny), sterowany przez `value` + `errors`. Minimalne pola MVP + sekcja „Zaawansowane”.
- **Główne elementy**:
  - `<form>`
  - `interval_days`: `<input type="number" min=1 max=365 inputMode="numeric" />`
  - `start_from`: radio/select:
    - `today` (domyślne)
    - `custom_date` (pokazuje date input)
    - (opcjonalnie) `purchase_date` (jeśli chcemy; API wspiera)
  - `custom_start_on`: `<input type="date">` (tylko dla `custom_date`)
  - Zaawansowane (collapsible):
    - `horizon_days` (1..365, domyślnie 90)
    - `schedule_basis` (`completed_on` vs `due_on`)
    - `overdue_policy` (`carry_forward` vs `reschedule`)
  - Akcje: `Zapisz` + `Wróć`
- **Obsługiwane zdarzenia**:
  - `onChange(patch)` dla pól
  - `onSubmit()` (deleguje do `WateringPlanEditor`)
- **Warunki walidacji**:
  - `Zapisz` disabled gdy `isSaving` lub formularz niepoprawny.
  - `aria-invalid` i opis błędu dla pól z błędami.
- **Typy**:
  - `WateringPlanFormValues`, `WateringPlanFormErrors`
- **Propsy**:

```ts
export type WateringPlanFormProps = {
  value: WateringPlanFormValues
  errors: WateringPlanFormErrors
  isSaving: boolean
  onChange: (patch: Partial<WateringPlanFormValues>) => void
  onSubmit: () => void
  onBack: () => void
}
```

## 5. Typy

### DTO (istniejące, z backendu)
Wykorzystaj typy z `src/types.ts`:
- `SuggestWateringPlanCommand`
- `WateringPlanSuggestionDto`:
  - `ai_request_id: string`
  - `suggestion: WateringPlanConfigFields | null`
  - `explanation?: string | null`
- `SetWateringPlanCommand`
- `SetWateringPlanResultDto`
- `AiQuotaDto` (opcjonalnie do UI)

### Nowe typy ViewModel (frontend)
Rekomendowane w `src/components/plants/watering-plan/types.ts`:

```ts
export type PlantWateringPlanMode = 'suggest' | 'edit'

export type WateringPlanSourceVm =
  | { type: 'ai'; aiRequestId: string; acceptedWithoutChanges: boolean }
  | { type: 'manual' }

export type AiSuggestionStatus =
  | 'idle'
  | 'loading'
  | 'available'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error'
  | 'unauthenticated'
  | 'not_found'
  | 'skipped'
  | 'unknown_error'

export type AiSuggestionAvailableVm = {
  status: 'available'
  aiRequestId: string
  intervalDays: number
  horizonDays: number
  scheduleBasis: 'due_on' | 'completed_on'
  startFrom: 'today' | 'purchase_date' | 'custom_date'
  customStartOn: string | null
  overduePolicy: 'carry_forward' | 'reschedule'
  explanation: string
}

export type AiSuggestionRateLimitedVm = {
  status: 'rate_limited'
  unlockAt?: string | null
  aiRequestId?: string | null
}

export type AiSuggestionErrorVm = {
  status: 'timeout' | 'provider_error' | 'unknown_error' | 'unauthenticated' | 'not_found'
  code?: string
  message: string
  requestId?: string
  details?: unknown
}

export type AiSuggestionSkippedVm = {
  status: 'skipped'
  reason?: string | null
}

export type AiSuggestionStateVm =
  | { status: 'idle' }
  | { status: 'loading' }
  | AiSuggestionAvailableVm
  | AiSuggestionRateLimitedVm
  | AiSuggestionErrorVm
  | AiSuggestionSkippedVm

export type WateringPlanFormValues = {
  interval_days: string // trzymamy jako string dla input; na submit parsujemy do number
  start_from: 'today' | 'purchase_date' | 'custom_date'
  custom_start_on: string // '' oznacza brak; na submit parsujemy do null
  // advanced:
  horizon_days: string // default '90'
  schedule_basis: 'due_on' | 'completed_on'
  overdue_policy: 'carry_forward' | 'reschedule'
}

export type WateringPlanFormField =
  | 'interval_days'
  | 'start_from'
  | 'custom_start_on'
  | 'horizon_days'
  | 'schedule_basis'
  | 'overdue_policy'
  | 'form'

export type WateringPlanFormErrors = {
  fieldErrors: Partial<Record<WateringPlanFormField, string[]>>
  formError?: string
}

export type SetPlanErrorVm = {
  kind: 'validation' | 'unauthenticated' | 'not_found' | 'conflict' | 'network' | 'http' | 'parse' | 'unknown'
  message: string
  code?: string
  requestId?: string
  details?: unknown
  fieldErrors?: Record<string, string[]>
}
```

### Funkcje mapujące (VM builder)
Rekomendowane helpery (np. `src/components/plants/watering-plan/view-model.ts`):
- `toAiSuggestionVm(dto: WateringPlanSuggestionDto): AiSuggestionAvailableVm | AiSuggestionSkippedVm`
- `buildRateLimitedVm(error: SuggestWateringPlanApiError): AiSuggestionRateLimitedVm`
- `buildAiErrorVm(error: SuggestWateringPlanApiError): AiSuggestionErrorVm`
- `sanitizeFormToSetCommand(values: WateringPlanFormValues, source: WateringPlanSourceVm): SetWateringPlanCommand`
- `validateWateringPlanForm(values: WateringPlanFormValues): WateringPlanFormErrors`

## 6. Zarządzanie stanem

### Podejście
Spójnie z istniejącym kodem (kalendarz):
- fetch i klasyfikację błędów umieść w `client` (`src/lib/services/.../*-client.ts`),
- stan ekranu i anulowanie requestów w custom hookach (`src/components/hooks`),
- komponenty widoku utrzymują minimalny state UI (mode, source, form).

### Hook 1: `useWateringPlanSuggestion`
Lokalizacja: `src/components/hooks/use-watering-plan-suggestion.ts`
- **Cel**: wykonać `POST /api/plants/{plantId}/watering-plan/suggest` i zmapować wynik na `AiSuggestionStateVm`.
- **Wejście**:
  - `plantId: string`
  - `speciesName?: string | null`
  - `enabled: boolean` (czy w ogóle próbować AI)
- **Stan**:
  - `state: AiSuggestionStateVm`
  - `requestId?: string`
- **Akcje**:
  - `run()` — uruchamia sugestię (ustawia `loading`), anuluje poprzedni request
  - `reset()` — czyści stan do `idle`
- **Zasady**:
  - jeśli `enabled=false` lub brak `speciesName` → `skipped`
  - jeśli `plantId` nie wygląda jak UUID → `skipped` + reason (albo `validation`)
  - request jest abortowany przy unmount.

### Hook 2: `useSetWateringPlan`
Lokalizacja: `src/components/hooks/use-set-watering-plan.ts`
- **Cel**: wykonać `PUT /api/plants/{plantId}/watering-plan` i zarządzić stanem zapisu.
- **Wejście**:
  - `plantId: string`
- **Stan**:
  - `isSaving: boolean`
  - `error: SetPlanErrorVm | null`
  - `lastResult?: SetWateringPlanResultDto`
- **Akcje**:
  - `save(command: SetWateringPlanCommand): Promise<SetWateringPlanResultDto | null>`
  - `clearError()`
- **Zasady**:
  - przy sukcesie: zwraca wynik i czyści błąd,
  - przy błędzie 422: mapuje `details.issues[]` z backendu (patrz sekcja 9/10).

### Stan w `PlantWateringPlanView` (minimum)
- `mode: PlantWateringPlanMode` (`suggest` / `edit`)
- `aiEnabled: boolean`:
  - w tym widoku domyślnie `true`, ale jeśli użytkownik przejdzie na manual, nie uruchamiaj AI automatycznie ponownie.
- `speciesName: string | null` (pozyskany z hand-off)
- `suggestionState: AiSuggestionStateVm` (z hooka)
- `editorSource: WateringPlanSourceVm`:
  - `ai` w przypadku edycji sugestii, `manual` w przypadku ręcznego ustawienia.
- `formValues: WateringPlanFormValues` (prefill z suggestion lub defaulty)

## 7. Integracja API

### 7.1 Skąd wziąć `species_name` (konieczne dla `suggest`)
Endpoint `POST /api/plants/{plantId}/watering-plan/suggest` wymaga body:

- `SuggestWateringPlanCommand = { context: { species_name } }`

W repo **brakuje** dziś `GET /api/plants/{plantId}`, więc widok nie ma gwarantowanego źródła `species_name`.

Rekomendowane rozwiązania (wybrać jedno, w kolejności preferencji):
- **A (docelowe, najlepsze)**: wdrożyć `GET /api/plants/{plantId}` zgodnie z `.ai/api-impl-plan/get-plant-implementation-plan.md` i pobierać `species_name` w tym widoku.
- **B (MVP szybkie, bez backendu)**: hand-off kontekstu przez `sessionStorage` z widoku `/plants/new` (i/lub innego miejsca, które ma `species_name`):
  - po `POST /api/plants` zapisz:
    - key: `pp:plant:${plantId}:context`
    - value: `{ species_name, created_at: Date.now(), watering_suggestion?: WateringSuggestionForCreationDto }`
  - na wejściu do `/plants/:plantId/watering-plan` odczytaj i usuń wpis.
  - jeśli `watering_suggestion.status === 'available'`:
    - **nie wołaj** od razu `POST suggest` (oszczędzasz quota i czas),
    - zbuduj od razu VM „available” na podstawie payloadu z create (`interval_days`, `explanation`, itd.),
    - zachowaj `ai_request_id` z create i użyj go potem w `PUT` (source AI).
- **C (fallback linkowy)**: dopisywać `?species_name=...` w linku do tego widoku (np. z listy roślin).

Plan w tym dokumencie zakłada **B** (żeby nie blokować frontendu), ale uwzględnia A jako zależność dla pełnego UX.

### 7.2 `GET /api/ai/quota` (opcjonalne, UX limitów)
Endpoint istnieje i zwraca `AiQuotaDto`. W tym widoku można go użyć do:
- pokazywania „ile zostało” (jeśli chcesz rozszerzyć UX),
- szybkiego wykrycia blokady (gdy `is_rate_limited=true`) i wyświetlenia `unlock_at` **bez wykonywania** droższego `POST suggest`,
- wyłączenia przycisku „Spróbuj ponownie” do czasu `unlock_at` (opcjonalnie).

**Typ odpowiedzi**: `AiQuotaDto` (`src/types.ts`).
**Obsługa błędów**: jak inne endpointy (`401`).

### 7.3 `POST /api/plants/{plantId}/watering-plan/suggest`
- **Wywołanie**: klient FE `suggestWateringPlan(plantId, command)`
- **Request body**: `SuggestWateringPlanCommand`
- **Response (success)**:
  - envelope `data: WateringPlanSuggestionDto`
  - `meta.response_time_budget_ms = 5000`
- **Response (rate-limited)**:
  - status `429`, `error.code = 'AI_RATE_LIMITED'`
  - `error.details.unlock_at` (string ISO)
  - `data` nadal jest zwracane (z `ai_request_id` i `suggestion:null`) — frontend powinien to obsłużyć.
- **Response (timeout/provider)**:
  - `408 AI_TIMEOUT` lub `502 AI_PROVIDER_ERROR`
- **Frontend action**:
  - `success`: zbuduj `AiSuggestionAvailableVm`
  - `429`: zbuduj `AiSuggestionRateLimitedVm` (pokaz `unlock_at`)
  - `408/502`: zbuduj `AiSuggestionErrorVm` + pokaż retry/manual

### 7.4 `PUT /api/plants/{plantId}/watering-plan`
- **Uwaga**: plik endpointu nie istnieje jeszcze w `src/pages/api` — potrzebna implementacja backendu (patrz `.ai/api-impl-plan/put-watering-plan-implementation-plan.md`).
- **Request body**: `SetWateringPlanCommand`
  - `source.type='ai'`:
    - `ai_request_id` i `accepted_without_changes` wymagane
  - `source.type='manual'`:
    - `ai_request_id` ma być `null` (backend wymusza)
- **Frontend action po sukcesie**:
  - pokaż komunikat sukcesu (toast lub inline) „Plan zapisany”
  - wykonaj redirect do dnia w kalendarzu (rekomendowany algorytm poniżej).

### 7.5 Redirect po zapisie planu (kalendarz)
Ponieważ `PUT` nie zwraca „pierwszego due_on”, UX z `ui-plan.md` sugeruje:
- `GET /api/calendar/day?date=<today>&status=pending`:
  - jeśli `items.length > 0` → redirect do `/calendar/day/<today>`
- w przeciwnym razie:
  - `GET /api/calendar/month?month=<YYYY-MM>&status=pending`
  - wybierz najbliższy dzień z `days[]` i redirect do `/calendar/day/<thatDate>`
- jeśli brak zadań w miesiącu:
  - fallback do `/calendar` (miesiąc) i pokaż „Brak zadań” lub toast.

## 8. Interakcje użytkownika

### Wejście na widok
- Jeśli `mode='suggest'` i mamy `species_name`:
  - pokaz `FullScreenState` i wywołaj sugestię.
- Jeśli brak `species_name`:
  - pokaż `AiSkippedState` + CTA „Ustaw ręcznie”.

### Akcje w stanie „sugestia dostępna”
- **Akceptuj**:
  - wyślij `PUT` z `source.type='ai'`, `accepted_without_changes=true`, `ai_request_id` z sugestii
  - blokada przycisków podczas zapisu
  - po sukcesie: redirect do kalendarza (sekcja 7.4)
- **Edytuj i zapisz**:
  - przełącz `mode='edit'`
  - prefill formularza wartościami z sugestii
  - po zapisie: `accepted_without_changes=false`
- **Odrzuć i ustaw ręcznie**:
  - przełącz `mode='edit'`
  - prefill wartościami domyślnymi (albo sugestią, ale `source.type='manual'`)

### Retry (dla timeout/provider_error)
- Klik „Spróbuj ponownie”:
  - ponawia `POST suggest` (z pełnym loaderem)
  - w razie sukcesu pokazuje kartę sugestii.

### Ustawienie planu ręcznie
- Użytkownik wpisuje `interval_days` i wybiera start:
  - `today` albo `custom_date`
- Klik „Zapisz”:
  - wyślij `PUT` z `source.type='manual'`
  - po sukcesie redirect do kalendarza.

### Mapowanie user stories → implementacja
- **US-002 (generowanie planu w 5s)**:
  - `useWateringPlanSuggestion` + `FullScreenState` + obsługa 408/502/429
- **US-003 (akceptacja/korekta + zapis decyzji)**:
  - akcje w `AiSuggestionCard` i `WateringPlanEditor`
  - `PUT` z poprawnym `source` i `accepted_without_changes`

## 9. Warunki i walidacja

### 9.1 Walidacja wejścia widoku (routing)
- `plantId`:
  - waliduj jako UUID (minimum regex); jeśli niepoprawny → pokaż stan walidacji (np. `AiSkippedState` z powodem) i CTA „Wróć do roślin”.

### 9.2 Walidacja requestu `POST suggest`
- `species_name`:
  - trim + normalizacja whitespace (backend robi dodatkowo, ale UI powinna blokować puste)
  - max długość: backend ma `MAX_SPECIES_NAME_LENGTH=200` dla suggest (różni się od create-plant 120)
  - UI: `maxLength=200` w inputach, które przekazują tę wartość dalej (np. create plant).

### 9.3 Walidacja formularza planu (`PUT`)
Zgodnie z `src/lib/api/watering-plans/set-watering-plan-request.ts`:
- `interval_days`:
  - required, int, **1..365**
- `horizon_days`:
  - optional, int, **1..365**, default **90**
- `schedule_basis`:
  - enum: `due_on | completed_on` (MVP default: `completed_on`)
- `start_from`:
  - enum: `today | purchase_date | custom_date` (MVP UI: `today | custom_date`)
- `custom_start_on`:
  - jeśli `start_from='custom_date'` → wymagane i ISO `YYYY-MM-DD`
  - w przeciwnym razie musi być **null**
- `overdue_policy`:
  - enum: `carry_forward | reschedule` (MVP default: `carry_forward`)
- `source`:
  - `type='ai'`:
    - `ai_request_id` UUID wymagane
    - `accepted_without_changes` boolean wymagane
  - `type='manual'`:
    - `ai_request_id` musi wyjść `null`
    - `accepted_without_changes` nie wolno wysyłać

### 9.4 Weryfikacja na poziomie komponentów
- `WateringPlanForm`:
  - waliduje pola i ustawia `aria-invalid`, renderuje błędy inline
- `AiSuggestionCard`:
  - dopuszcza `Akceptuj` tylko gdy suggestion jest kompletna
- `PlantWateringPlanView`:
  - przed `PUT` buduje `SetWateringPlanCommand` przez `sanitizeFormToSetCommand(...)` i robi guard clauses (np. brak `aiRequestId` przy source ai).

## 10. Obsługa błędów

### 10.1 Błędy AI (suggest)
- `429 AI_RATE_LIMITED`:
  - pokaż `AiBlockedState` z `unlock_at`
  - CTA: „Ustaw ręcznie”
- `408 AI_TIMEOUT`:
  - pokaż `AiErrorState` z retry/manual
- `502 AI_PROVIDER_ERROR`:
  - pokaż `AiErrorState` z retry/manual
- `401 UNAUTHENTICATED`:
  - pokaż stan „Sesja wygasła” + CTA do logowania (docelowo `/auth/login?returnTo=...`)
- `404 PLANT_NOT_FOUND`:
  - pokaż „Roślina nie istnieje lub nie masz dostępu” + CTA do `/plants`
- `400 VALIDATION_ERROR` (body/plantId):
  - pokaż błąd walidacji (czasem zawiera `details.issues[]`)

### 10.2 Błędy zapisu planu (set plan)
- `422 VALIDATION_ERROR`:
  - mapuj `details.issues[]` na `fieldErrors`:
    - `issue.path` (np. `custom_start_on`) → pole
    - `issue.message` → tekst pod polem
  - jeśli brak `details` → pokaż błąd formularza ogólny
- `409 PLAN_CONFLICT`:
  - pokaż komunikat „Plan zmienił się w tle. Spróbuj ponownie.” + CTA retry (ponów `PUT`)
- `401 UNAUTHENTICATED`:
  - jak wyżej, CTA do logowania
- `404 PLANT_NOT_FOUND` / `AI_REQUEST_NOT_FOUND`:
  - pokaż błąd i zaproponuj powrót do sugestii (retry) lub do listy roślin
- `500`:
  - komunikat ogólny + (jeśli posiadasz) `request_id` z `meta` / error object

### 10.3 Błędy sieci / parse
Spójnie z klientami kalendarza:
- `network`: „Brak połączenia z serwerem” + retry
- `parse`: „Nie udało się przetworzyć odpowiedzi serwera” + retry

## 11. Kroki implementacji
1. **Routing Astro**:
   - dodaj `src/pages/plants/[plantId]/watering-plan/index.astro`
   - `prerender=false`, `Layout`, `PlantWateringPlanView client:load`
   - normalizacja `mode` + przekazanie `plantId`
2. **Katalog komponentów widoku**:
   - utwórz `src/components/plants/watering-plan/` i dodaj szkielety komponentów z sekcji 3/4.
3. **Nowe typy VM**:
   - dodaj `src/components/plants/watering-plan/types.ts` z typami z sekcji 5.
4. **Klient FE: suggest**:
   - dodaj `src/lib/services/watering-plans/suggest-client.ts` w stylu `calendar/*-client.ts`:
     - `SuggestWateringPlanApiError` z kindami: `rate_limited | timeout | provider_error | unauthenticated | not_found | validation | network | parse | http | unknown`
     - `suggestWateringPlan(plantId, command, {signal})`
5. **Hook: `useWateringPlanSuggestion`**:
   - implementuj anulowanie (AbortController) i stan `AiSuggestionStateVm`
   - expose `run()` + `state`
6. **Klient FE: set plan**:
   - dodaj `src/lib/services/watering-plans/set-plan-client.ts`:
     - `setWateringPlan(plantId, command)` (PUT)
     - analogiczna klasyfikacja błędów jak w `watering-task-client.ts`
7. **Hook: `useSetWateringPlan`**:
   - implementuj `save()` i mapowanie 422 → `fieldErrors` (obsłuż `details.issues[]`)
8. **Implementacja edytora planu**:
   - `WateringPlanForm` (controlled) + walidacja UI zgodna z sekcją 9.3
   - dodaj defaulty: `horizon_days=90`, `schedule_basis='completed_on'`, `overdue_policy='carry_forward'`
9. **Implementacja trybów i akcji** w `PlantWateringPlanView`:
   - na mount: pozyskaj `species_name` (wariant B: sessionStorage + fallback query)
   - jeśli jest → `run()` sugerowania
   - obsłuż `Accept`/`Edit`/`Manual` budując poprawny `SetWateringPlanCommand.source`
10. **Redirect po sukcesie**:
   - po `PUT` wykonaj algorytm z sekcji 7.4 (wspieraj brak zadań)
11. **Zależności backendowe (blokery do full flow)**:
   - dodać endpoint `PUT /api/plants/{plantId}/watering-plan` w `src/pages/api/plants/[plantId]/watering-plan.ts` (wg `.ai/api-impl-plan/put-watering-plan-implementation-plan.md`)
   - dodać endpoint `GET /api/plants/{plantId}` (wg `.ai/api-impl-plan/get-plant-implementation-plan.md`) lub utrzymać hand-off `species_name` (wariant B).
12. **Checklist akceptacyjny (PRD/US)**:
   - sugestia pojawia się ≤5 s (albo widoczny powód braku),
   - dostępne akcje: Akceptuj / Edytuj i zapisz / Odrzuć i ustaw ręcznie,
   - zapis planu ustawia metadane AI (przez `source`),
   - po zapisie kalendarz od razu pokazuje zadania dla rośliny (redirect do dnia + odświeżenie).

