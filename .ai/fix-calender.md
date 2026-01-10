### Cel
Doprowadzić kalendarz (`/calendar/*`) do stanu zgodnego z `@.ai/prd.md` (US-004/005/006/017/018/020/021/022) oraz `@.ai/ui-plan.md` (App Shell, obsługa 401, timezone, puste stany, skróty “Dziś”, read-modele).

---

### Instrukcje zmian (krok po kroku)

### 1) Wprowadź **ochronę tras prywatnych** (kalendarz) + spójny redirect do logowania
- **Zaimplementuj guard dla tras UI**: `/calendar`, `/plants`, `/settings` (bez `/auth/*` i bez `/api/*`).
- **Dla niezalogowanego**: redirect do `/auth/login` z parametrem powrotu (ujednolić: `returnTo` albo `next` i stosować wszędzie tak samo).
- **Gdzie**:
  - Preferowane: `src/middleware/index.ts` (warunek po `context.url.pathname`).
  - Alternatywnie (szybciej, mniej spójnie): w każdym prywatnym `src/pages/**.astro` jak w `plants/[plantId]/index.astro`.

### 2) Zbuduj **App Shell** zgodny z UI-plan (nawigacja + globalne CTA + logout)
- Dodaj layout typu `AppShell` (Astro) używany przez prywatne strony.
- W shellu zapewnij:
  - Stałą nawigację: **Kalendarz / Rośliny / Ustawienia**
  - Globalne CTA: **“Dodaj roślinę” → `/plants/new`**
  - Akcję **Wyloguj** (zgodnie z PRD US-008).
- **Gdzie**:
  - Nowy layout np. `src/layouts/AppShell.astro` + podmiana `Layout` w `src/pages/calendar/*` na `AppShell`.

### 3) Dodaj spójną obsługę **401** w UI kalendarza (PRD US-022)
- Dla błędów `unauthenticated` w `CalendarErrorState` dodaj:
  - CTA **“Przejdź do logowania”** z `returnTo` ustawionym na bieżący URL **albo** automatyczny redirect.
- Ujednolić zachowanie między:
  - błędami fetchowania (`useCalendarMonth`, `useCalendarDay`)
  - błędami mutacji (`useWateringTaskMutations` już pokazuje komunikat + link do logowania — to trzeba doprowadzić do standardu również dla fetch).
- **Gdzie**: `src/components/calendar/shared/CalendarErrorState.tsx` (+ ewentualnie VM/error mapping).

### 4) Ustaw właściwe **domyślne filtry** dla “szybkiego odhaczania”
- Zmień domyślny status w day-view na **`pending`** (zgodnie z flow month→day i UI-plan).
- Upewnij się, że klik z miesiąca przenosi do day-view z zachowaniem filtra (lub że domyślne zachowanie to pending).
- **Gdzie**:
  - `src/lib/api/calendar/get-calendar-day-request.ts` (default `status`)
  - `src/lib/services/calendar/day-view-model.ts` (`normalizeCalendarDayStatus`)

### 5) Popraw dostępność i semantykę kafelków miesiąca dla różnych statusów
- `aria-label` dla dnia powinien opisywać **to, co liczy badge** (pending/completed/all), a nie zawsze “do wykonania”.
- **Gdzie**: `src/lib/services/calendar/month-view-model.ts` (`buildAriaLabel`) + przekazanie statusu do tekstu.

### 6) Zaimplementuj wymagania dot. **timezone** (PRD US-020, UI-plan)
- Zdecyduj źródło timezone: profil usera (preferowane) z fallbackiem do przeglądarki.
- Ujednolić liczenie:
  - “dziś” (highlight w miesiącu)
  - generowanie siatki miesiąca
  - interpretację `YYYY-MM` i `YYYY-MM-DD` w widokach
- Minimalnie: usuń mieszanie UTC/local w month grid (żeby “dziś” i daty nie rozjeżdżały się na granicach doby).
- **Gdzie**: `src/lib/services/calendar/month-view-model.ts` + ewentualnie wspólny helper dat.

### 7) Dodaj brakujące elementy UX w widoku dnia (UI-plan)
- Dodaj skrót **“Dziś”** w day-view (header) → `/calendar/day` (redirect already exists) lub `/calendar/day/YYYY-MM-DD`.
- Uzupełnij puste stany:
  - CTA **“Dodaj roślinę”** (`/plants/new`)
  - (opcjonalnie) CTA “Dodaj wpis ad hoc” jeśli UX ma być prowadzący
- **Gdzie**:
  - `src/components/calendar/day/CalendarDayView.tsx` (header)
  - `src/components/calendar/day/CalendarDayEmptyState.tsx`

### 8) Napraw odświeżanie po “przeniesieniu” wpisu na inną datę (cache invalidation)
- Po edycji `completed_on` (zwłaszcza dla ad hoc) trzeba invalidować cache dla:
  - starej daty/miesiąca **i** nowej daty/miesiąca (bo wpis realnie zmienia dzień).
- Obecnie invalidacja czyści tylko cache dla aktualnego `date` hooka.
- **Gdzie**: `src/components/hooks/use-watering-task-mutations.ts` (logika invalidacji po `editTask` — potrzebuje znać docelową datę).
