import { Button } from "@/components/ui/button";
import type { CalendarStatusFilterOption } from "@/lib/services/calendar/month-view-model";
import { cn } from "@/lib/utils";

interface CalendarStatusFilterProps {
  options: CalendarStatusFilterOption[];
  className?: string;
}

export const CalendarStatusFilter = ({ options, className }: CalendarStatusFilterProps) => (
  <nav aria-label="Filtr statusu zadań" className={cn("flex items-center gap-2", className)}>
    <span className="text-sm font-medium text-muted-foreground">Status:</span>
    <div className="inline-flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={option.isActive ? "default" : "outline"}
          size="sm"
          asChild
          aria-pressed={option.isActive}
          data-active={option.isActive ? "true" : undefined}
        >
          <a href={option.href} className="capitalize" aria-current={option.isActive ? "page" : undefined}>
            {option.label}
          </a>
        </Button>
      ))}
    </div>
  </nav>
);

CalendarStatusFilter.displayName = "CalendarStatusFilter";
