import { CalendarMonthDayTile } from "./CalendarMonthDayTile";

import type { CalendarMonthGridVm } from "@/lib/services/calendar/month-view-model";
import { cn } from "@/lib/utils";

interface CalendarMonthGridProps {
  grid: CalendarMonthGridVm;
  className?: string;
}

export const CalendarMonthGrid = ({ grid, className }: CalendarMonthGridProps) => (
  <section className={cn("flex flex-col gap-3", className)} aria-label={`Siatka dni dla ${grid.month}`}>
    <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {grid.weekdayLabels.map((label, index) => (
        <span key={`${label}-${index}`}>{label}</span>
      ))}
    </div>

    <div className="grid grid-cols-7 gap-2">
      {grid.weeks.map((week, weekIndex) => (
        <div key={`week-${weekIndex}`} className="contents">
          {week.days.map((day) => (
            <CalendarMonthDayTile key={day.date} day={day} />
          ))}
        </div>
      ))}
    </div>
  </section>
);

CalendarMonthGrid.displayName = "CalendarMonthGrid";
