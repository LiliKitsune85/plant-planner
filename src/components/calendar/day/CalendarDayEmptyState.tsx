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
}

export const CalendarDayEmptyState = ({ date, status }: CalendarDayEmptyStateProps) => (
  <Card className="text-center">
    <CardHeader>
      <CardTitle>Brak zadań dla {date}</CardTitle>
      <CardDescription>
        Nie znaleziono pozycji w kategorii {getCalendarStatusLabel(status).toLowerCase()}. Dodaj
        roślinę lub zmień filtr statusu.
      </CardDescription>
    </CardHeader>
    <CardContent />
    <CardFooter className="justify-center">
      <Button asChild variant="outline">
        <a href="/calendar">Wróć do kalendarza</a>
      </Button>
    </CardFooter>
  </Card>
)

CalendarDayEmptyState.displayName = 'CalendarDayEmptyState'
