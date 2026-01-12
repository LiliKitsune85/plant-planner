export const CalendarDaySkeleton = () => (
  <section className="space-y-4" aria-live="polite" aria-busy="true">
    <div className="flex flex-col gap-2">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-32 animate-pulse rounded-lg bg-muted/70" />
    </div>

    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-8 w-24 animate-pulse rounded-full bg-muted" />
      ))}
    </div>

    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`task-skeleton-${index}`}
          className="h-24 rounded-xl border border-dashed border-muted-foreground/20 bg-muted animate-pulse"
        />
      ))}
    </div>
  </section>
);

CalendarDaySkeleton.displayName = "CalendarDaySkeleton";
