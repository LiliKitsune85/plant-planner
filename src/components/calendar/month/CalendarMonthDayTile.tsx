import type { CalendarMonthGridDayVm } from '@/lib/services/calendar/month-view-model'
import { cn } from '@/lib/utils'

type CalendarMonthDayTileProps = {
  day: CalendarMonthGridDayVm
}

export const CalendarMonthDayTile = ({ day }: CalendarMonthDayTileProps) => {
  const badge =
    day.count > 0 ? (
      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
        {day.count}
      </span>
    ) : null

  return (
    <a
      href={day.href}
      aria-label={day.ariaLabel}
      aria-current={day.isToday ? 'date' : undefined}
      className={cn(
        'group flex min-h-[110px] flex-col rounded-xl border p-3 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        day.isInCurrentMonth ? 'bg-background' : 'bg-muted text-muted-foreground',
        day.isToday &&
          'border-primary text-primary-foreground bg-primary/90 shadow-sm focus-visible:ring-primary',
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        <span>{day.dayNumber}</span>
        {badge}
      </div>

      <span
        className={cn(
          'mt-auto text-xs text-muted-foreground',
          day.isToday && 'text-primary-foreground/80',
        )}
      >
        kliknij, aby zobaczyć szczegóły
      </span>
    </a>
  )
}

CalendarMonthDayTile.displayName = 'CalendarMonthDayTile'
