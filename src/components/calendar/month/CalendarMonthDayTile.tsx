import type { CalendarMonthGridDayVm } from "@/lib/services/calendar/month-view-model";
import { cn } from "@/lib/utils";

interface CalendarMonthDayTileProps {
  day: CalendarMonthGridDayVm;
}

export const CalendarMonthDayTile = ({ day }: CalendarMonthDayTileProps) => {
  const badge =
    day.count > 0 ? (
      <span
        className={cn(
          "rounded-full px-3 py-1 text-base font-semibold",
          day.isToday ? "bg-background text-primary shadow-sm" : "bg-primary/10 text-primary"
        )}
      >
        {day.count}
      </span>
    ) : null;

  return (
    <a
      href={day.href}
      aria-label={day.ariaLabel}
      aria-current={day.isToday ? "date" : undefined}
      className={cn(
        "group relative flex min-h-[110px] flex-col rounded-xl border p-3 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        day.isInCurrentMonth ? "bg-background" : "bg-muted text-muted-foreground",
        day.isToday && "border-primary text-primary-foreground bg-primary/90 shadow-sm focus-visible:ring-primary"
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        <span>{day.dayNumber}</span>
      </div>
      {badge ? (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          {badge}
        </div>
      ) : null}

    </a>
  );
};

CalendarMonthDayTile.displayName = "CalendarMonthDayTile";
