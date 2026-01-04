import { useMemo } from 'react'

import { useCalendarMonth } from '@/components/hooks/use-calendar-month'
import { CalendarStatusFilter } from '@/components/calendar/shared/CalendarStatusFilter'
import { CalendarErrorState } from '@/components/calendar/shared/CalendarErrorState'
import type { CalendarTaskStatusFilter } from '@/lib/services/calendar/types'
import {
  buildCalendarMonthGridVm,
  buildCalendarMonthStatusFilterOptions,
  buildMonthPickerVm,
} from '@/lib/services/calendar/month-view-model'

import { CalendarMonthEmptyState } from './CalendarMonthEmptyState'
import { CalendarMonthGrid } from './CalendarMonthGrid'
import { CalendarMonthSkeleton } from './CalendarMonthSkeleton'
import { MonthPicker } from './MonthPicker'

type CalendarMonthViewProps = {
  month: string
  status?: CalendarTaskStatusFilter
}

export const CalendarMonthView = ({
  month,
  status = 'pending',
}: CalendarMonthViewProps) => {
  const { status: fetchStatus, data, error, reload } = useCalendarMonth({ month, status })

  const content = useMemo(() => {
    if (fetchStatus === 'error' && error) {
      return (
        <CalendarErrorState
          error={error}
          onRetry={reload}
          className="mx-auto max-w-2xl"
          title="Nie udało się wczytać kalendarza"
          validationCtaHref="/calendar"
          validationCtaLabel="Przejdź do bieżącego miesiąca"
        />
      )
    }

    if (!data) {
      return <CalendarMonthSkeleton />
    }

    const pickerVm = buildMonthPickerVm(data)
    const gridVm = buildCalendarMonthGridVm(data)
    const statusOptions = buildCalendarMonthStatusFilterOptions(data)

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
    )
  }, [data, error, fetchStatus, reload])

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6" aria-live="polite">
      {content}
      {fetchStatus === 'loading' && data && (
        <p className="text-sm text-muted-foreground" role="status">
          Trwa odświeżanie danych…
        </p>
      )}
    </main>
  )
}

CalendarMonthView.displayName = 'CalendarMonthView'
