import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CALENDAR_STATUS_LABELS } from "@/lib/services/calendar/month-view-model";
import type { CalendarTaskStatusFilter } from "@/lib/services/calendar/types";

interface CalendarMonthEmptyStateProps {
  ctaHref: string;
  status: CalendarTaskStatusFilter;
}

export const CalendarMonthEmptyState = ({ ctaHref, status }: CalendarMonthEmptyStateProps) => (
  <Card className="text-center">
    <CardHeader>
      <CardTitle>Brak zadań w tym miesiącu</CardTitle>
      <CardDescription>
        Nie zaplanowano {CALENDAR_STATUS_LABELS[status].toLowerCase()} w wybranym miesiącu. Dodaj roślinę, aby rozpocząć
        harmonogram podlewania.
      </CardDescription>
    </CardHeader>
    <CardContent />
    <CardFooter className="justify-center">
      <Button asChild>
        <a href={ctaHref}>Dodaj roślinę</a>
      </Button>
    </CardFooter>
  </Card>
);

CalendarMonthEmptyState.displayName = "CalendarMonthEmptyState";
