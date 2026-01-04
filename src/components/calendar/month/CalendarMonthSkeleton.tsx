const weekdayPlaceholders = Array.from({ length: 7 })
const dayPlaceholders = Array.from({ length: 42 })

export const CalendarMonthSkeleton = () => (
  <section className="space-y-4" aria-live="polite" aria-busy="true">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="h-10 w-full animate-pulse rounded-xl bg-muted sm:w-2/3" />
      <div className="h-9 w-32 animate-pulse rounded-full bg-muted" />
    </div>

    <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase text-muted-foreground">
      {weekdayPlaceholders.map((_, index) => (
        <span
          key={`weekday-placeholder-${index}`}
          className="h-4 rounded-full bg-muted/70"
          aria-hidden="true"
        />
      ))}
    </div>

    <div className="grid grid-cols-7 gap-2">
      {dayPlaceholders.map((_, index) => (
        <div
          key={`day-placeholder-${index}`}
          className="h-[110px] rounded-xl border border-dashed border-muted-foreground/20 bg-muted animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  </section>
)

CalendarMonthSkeleton.displayName = 'CalendarMonthSkeleton'
