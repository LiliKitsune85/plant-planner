import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getCalendarStatusLabel } from '@/lib/services/calendar/day-view-model'
import type { CalendarTaskStatusFilter } from '@/lib/services/calendar/types'

type CalendarDayEmptyStateProps = {
  date: string
  status: CalendarTaskStatusFilter
  onAddAdhoc?: () => void
  disableAdhoc?: boolean
}

export const CalendarDayEmptyState = ({
  date,
  status,
  onAddAdhoc,
  disableAdhoc = false,
}: CalendarDayEmptyStateProps) => (
  <Card className="text-center">
    <CardHeader>
      <CardTitle>Brak zadań dla {date}</CardTitle>
      <CardDescription>
        Nie znaleziono pozycji w kategorii {getCalendarStatusLabel(status).toLowerCase()}. Dodaj
        roślinę lub zmień filtr statusu.
      </CardDescription>
    </CardHeader>
    <CardContent />
    <CardFooter className="flex flex-wrap justify-center gap-3">
      {onAddAdhoc ? (
        <Button onClick={onAddAdhoc} disabled={disableAdhoc}>
          Dodaj wpis ad hoc
        </Button>
      ) : null}
      <Button asChild variant="outline">
        <a href="/plants/new">Dodaj roślinę</a>
      </Button>
    </CardFooter>
  </Card>
)

CalendarDayEmptyState.displayName = 'CalendarDayEmptyState'
