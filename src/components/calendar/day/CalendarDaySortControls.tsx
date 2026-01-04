import { Button } from '@/components/ui/button'
import type {
  CalendarDayOrderOption,
  CalendarDaySortOption,
} from '@/lib/services/calendar/day-view-model'

type CalendarDaySortControlsProps = {
  sortOptions: CalendarDaySortOption[]
  orderOptions: CalendarDayOrderOption[]
}

export const CalendarDaySortControls = ({
  sortOptions,
  orderOptions,
}: CalendarDaySortControlsProps) => (
  <section className="space-y-3" aria-label="Sortowanie listy zadań">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Sortuj według:</span>
      <div className="inline-flex flex-wrap gap-2">
        {sortOptions.map((option) => (
          <Button
            key={option.value}
            variant={option.isActive ? 'default' : 'outline'}
            size="sm"
            asChild
            aria-pressed={option.isActive}
          >
            <a href={option.href}>{option.label}</a>
          </Button>
        ))}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Kolejność:</span>
      <div className="inline-flex flex-wrap gap-2">
        {orderOptions.map((option) => (
          <Button
            key={option.value}
            variant={option.isActive ? 'default' : 'outline'}
            size="sm"
            asChild
            aria-pressed={option.isActive}
          >
            <a href={option.href}>{option.label}</a>
          </Button>
        ))}
      </div>
    </div>
  </section>
)

CalendarDaySortControls.displayName = 'CalendarDaySortControls'
