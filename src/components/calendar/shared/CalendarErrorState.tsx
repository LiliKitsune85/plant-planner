import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { CalendarMonthErrorVm } from "@/lib/services/calendar/month-view-model";
import type { CalendarDayErrorVm } from "@/lib/services/calendar/day-view-model";
import { cn } from "@/lib/utils";

type CalendarErrorVm = CalendarMonthErrorVm | CalendarDayErrorVm;

interface CalendarErrorStateProps {
  error: CalendarErrorVm;
  onRetry?: () => void;
  className?: string;
  title?: string;
  validationCtaHref?: string;
  validationCtaLabel?: string;
  loginHref?: string;
  loginCtaLabel?: string;
}

const shouldShowRetry = (kind: CalendarErrorVm["kind"]) => kind !== "validation" && kind !== "unauthenticated";

export const CalendarErrorState = ({
  error,
  onRetry,
  className,
  title = "Nie udało się wczytać danych",
  validationCtaHref = "/calendar",
  validationCtaLabel = "Przejdź do bieżącego widoku",
  loginHref = "/auth/login",
  loginCtaLabel = "Przejdź do logowania",
}: CalendarErrorStateProps) => (
  <Card className={cn("border-destructive/30 bg-destructive/5", className)}>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{error.message}</CardDescription>
    </CardHeader>
    <CardContent>
      {error.fieldErrors && (
        <div className="space-y-2 text-sm text-muted-foreground">
          {Object.entries(error.fieldErrors).map(([field, messages]) => (
            <p key={field}>
              <span className="font-medium">{field}:</span> {messages.join(", ")}
            </p>
          ))}
        </div>
      )}
      {error.requestId && (
        <p className="mt-4 text-xs text-muted-foreground">
          Identyfikator zgłoszenia: <span className="font-mono">{error.requestId}</span>
        </p>
      )}
    </CardContent>
    <CardFooter className="flex flex-wrap gap-2">
      {shouldShowRetry(error.kind) && onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Spróbuj ponownie
        </Button>
      )}
      {error.kind === "validation" && validationCtaHref && (
        <Button asChild>
          <a href={validationCtaHref}>{validationCtaLabel}</a>
        </Button>
      )}
      {error.kind === "unauthenticated" && loginHref && (
        <Button asChild>
          <a href={loginHref}>{loginCtaLabel}</a>
        </Button>
      )}
    </CardFooter>
  </Card>
);

CalendarErrorState.displayName = "CalendarErrorState";
