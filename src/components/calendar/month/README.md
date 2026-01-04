## Calendar Month View Structure

### Page-Level Flow
- `src/pages/calendar/index.astro` redirects to the canonical month route.
- `src/pages/calendar/[month].astro` validates the `month` param and renders the React `CalendarMonthView` island.
- `CalendarMonthView` orchestrates data fetching (via `useCalendarMonth`) and renders the correct UI sub-state.

### Component Hierarchy
```
CalendarMonthView
├─ MonthPicker
│  ├─ Previous month button
│  ├─ Month label
│  └─ Next / Today buttons
├─ CalendarMonthStates
│  ├─ CalendarMonthSkeleton
│  ├─ CalendarErrorState
│  └─ CalendarMonthEmptyState
└─ CalendarMonthGrid
   ├─ Weekday header row
   └─ CalendarMonthDayTile (×42)
```

### Responsibilities
- **CalendarMonthView**
  - Validates props (`month`, `status`).
  - Invokes `useCalendarMonth` to load data and exposes retry.
  - Decides which sub-state to display (loading, error, empty, grid).
- **MonthPicker**
  - Receives normalized navigation VM (current, previous, next, today) and status to keep filter in URL.
  - Emits navigation intents via anchor links to guarantee accessible routing (no client-only state).
- **CalendarMonthGrid**
  - Receives `CalendarMonthGridVm` and renders weekday headers and individual tiles inside a responsive CSS grid.
  - Delegates day-level interactions to `CalendarMonthDayTile`.
- **CalendarMonthDayTile**
  - Accessible link to daily view.
  - Shows day number, badge with task count, and states for “today” / “outside of current month”.
  - Provides descriptive `aria-label` (e.g., “2026-01-04 — 3 podlewania do wykonania”).
- **CalendarMonthEmptyState**
  - Shadcn `Card` with contextual messaging and CTA (e.g., `/plants/new`).
- **CalendarErrorState**
  - Differentiates `kind` (validation / unauthenticated / network / http / parse / unknown).
  - Renders retry / login actions depending on the error VM.
- **CalendarMonthSkeleton**
  - Lightweight skeleton for MonthPicker and 6×7 grid while fetch is in flight.

### Shared View Models & Utils
- `CalendarMonthVm` — normalized DTO for month summary.
- `CalendarMonthGridVm` — grid layout metadata for rendering.
- `CalendarMonthErrorVm` — typed error surface for UI states.
- Navigation helpers — `parseMonth`, `formatMonthLabel`, `getPrevMonth`, `getNextMonth`, `isToday`, `buildMonthGridVm`.
