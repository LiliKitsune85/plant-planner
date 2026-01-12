import { Button } from "@/components/ui/button";
import type { MonthPickerVm } from "@/lib/services/calendar/month-view-model";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthPickerProps {
  vm: MonthPickerVm;
  className?: string;
}

export const MonthPicker = ({ vm, className }: MonthPickerProps) => (
  <section
    className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}
    aria-label="Nawigacja po miesiącach kalendarza"
  >
    <div className="flex items-center justify-between gap-2 sm:justify-start">
      <Button
        asChild
        variant="outline"
        size="icon"
        aria-label="Pokaż poprzedni miesiąc"
        title={`Przejdź do ${vm.prev.label}`}
      >
        <a href={vm.prev.href} className="inline-flex items-center justify-center">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </a>
      </Button>

      <time
        className="text-lg font-semibold text-foreground"
        dateTime={`${vm.currentMonth}-01`}
        aria-live="polite"
        aria-atomic="true"
      >
        {vm.currentLabel}
      </time>

      <Button
        asChild
        variant="outline"
        size="icon"
        aria-label="Pokaż następny miesiąc"
        title={`Przejdź do ${vm.next.label}`}
      >
        <a href={vm.next.href} className="inline-flex items-center justify-center">
          <ChevronRight className="size-4" aria-hidden="true" />
        </a>
      </Button>
    </div>

    {vm.today.isCurrentMonth ? (
      <Button variant="ghost" size="sm" disabled title="Jesteś w bieżącym miesiącu">
        <CalendarDays className="size-4" aria-hidden="true" />
        Dziś
      </Button>
    ) : (
      <Button
        asChild
        variant="ghost"
        size="sm"
        aria-label="Przejdź do bieżącego miesiąca"
        title={`Przejdź do ${vm.today.label}`}
      >
        <a href={vm.today.href} className="inline-flex items-center gap-2">
          <CalendarDays className="size-4" aria-hidden="true" />
          Dziś
        </a>
      </Button>
    )}
  </section>
);

MonthPicker.displayName = "MonthPicker";
