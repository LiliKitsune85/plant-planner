import { useMemo } from "react";

import { useCalendarMonth } from "@/components/hooks/use-calendar-month";
import { CalendarStatusFilter } from "@/components/calendar/shared/CalendarStatusFilter";
import { CalendarErrorState } from "@/components/calendar/shared/CalendarErrorState";
import type { CalendarTaskStatusFilter } from "@/lib/services/calendar/types";
import {
  buildCalendarMonthGridVm,
  buildCalendarMonthStatusFilterOptions,
  buildMonthPickerVm,
} from "@/lib/services/calendar/month-view-model";
import { getActiveTimezone, getTodayIsoDateInTimezone, getTodayMonthInTimezone } from "@/lib/utils/timezone";

import { CalendarMonthEmptyState } from "./CalendarMonthEmptyState";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarMonthSkeleton } from "./CalendarMonthSkeleton";
import { MonthPicker } from "./MonthPicker";

interface CalendarMonthViewProps {
  month: string;
  status?: CalendarTaskStatusFilter;
}

export const CalendarMonthView = ({ month, status = "pending" }: CalendarMonthViewProps) => {
  const { status: fetchStatus, data, error, reload } = useCalendarMonth({ month, status });
  const timezone = useMemo(() => getActiveTimezone(), []);
  const todayIsoDate = useMemo(() => getTodayIsoDateInTimezone(timezone), [timezone]);
  const todayMonth = useMemo(() => getTodayMonthInTimezone(timezone), [timezone]);
  const loginHref = useMemo(() => {
    if (typeof window === "undefined") return "/auth/login";
    const target = `${window.location.pathname}${window.location.search}`;
    return `/auth/login?returnTo=${encodeURIComponent(target)}`;
  }, []);

  const content = useMemo(() => {
    if (fetchStatus === "error" && error) {
      return (
        <CalendarErrorState
          error={error}
          onRetry={reload}
          className="mx-auto max-w-2xl"
          title="Nie udało się wczytać kalendarza"
          validationCtaHref="/calendar"
          validationCtaLabel="Przejdź do bieżącego miesiąca"
          loginHref={loginHref}
          loginCtaLabel="Wróć do logowania"
        />
      );
    }

    if (!data) {
      return <CalendarMonthSkeleton />;
    }

    const pickerVm = buildMonthPickerVm(data, { todayMonth });
    const gridVm = buildCalendarMonthGridVm(data, { todayIsoDate });
    const statusOptions = buildCalendarMonthStatusFilterOptions(data);

    return (
      <>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <MonthPicker vm={pickerVm} />
          <CalendarStatusFilter options={statusOptions} />
        </div>
        {data.hasAnyTasks ? (
          <CalendarMonthGrid grid={gridVm} />
        ) : (
          <CalendarMonthEmptyState ctaHref="/plants/new" status={data.status} />
        )}
      </>
    );
  }, [data, error, fetchStatus, loginHref, reload, todayIsoDate, todayMonth]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6" aria-live="polite">
      {content}
      {fetchStatus === "loading" && data && (
        <p className="text-sm text-muted-foreground" role="status">
          Trwa odświeżanie danych…
        </p>
      )}
    </main>
  );
};

CalendarMonthView.displayName = "CalendarMonthView";
