import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buildCalendarDayErrorVm,
  buildCalendarDayValidationErrorVm,
  buildCalendarDayVm,
  isValidCalendarDate,
  normalizeCalendarDayOrder,
  normalizeCalendarDaySort,
  normalizeCalendarDayStatus,
  type CalendarDayErrorVm,
  type CalendarDayVm,
} from '@/lib/services/calendar/day-view-model'
import { CalendarDayApiError, getCalendarDay } from '@/lib/services/calendar/day-client'
import type {
  CalendarTaskSortField,
  CalendarTaskStatusFilter,
  SortOrder,
} from '@/lib/services/calendar/types'
import type { CalendarDayVm } from '@/lib/services/calendar/day-view-model'

type UseCalendarDayParams = {
  date: string
  status?: CalendarTaskStatusFilter
  sort?: CalendarTaskSortField
  order?: SortOrder
}

type UseCalendarDayState =
  | { status: 'idle'; data?: undefined; error?: undefined; requestId?: undefined }
  | { status: 'loading'; data?: CalendarDayVm; error?: undefined; requestId?: string }
  | { status: 'success'; data: CalendarDayVm; error?: undefined; requestId?: string }
  | { status: 'error'; data?: CalendarDayVm; error: CalendarDayErrorVm; requestId?: string }

type UseCalendarDayResult = UseCalendarDayState & {
  reload: () => void
}

const cache = new Map<string, CalendarDayVm>()

const buildCacheKey = (
  date: string,
  status: CalendarTaskStatusFilter,
  sort: CalendarTaskSortField,
  order: SortOrder,
): string => `${date}:${status}:${sort}:${order}`

export const invalidateCalendarDayCache = (
  predicate?: (key: string, value: CalendarDayVm) => boolean,
): void => {
  if (!predicate) {
    cache.clear()
    return
  }

  for (const [key, value] of cache.entries()) {
    if (predicate(key, value)) {
      cache.delete(key)
    }
  }
}

export const invalidateCalendarDayCacheByDate = (date: string): void => {
  invalidateCalendarDayCache((key) => key.startsWith(`${date}:`))
}

export const useCalendarDay = ({
  date,
  status: statusInput,
  sort: sortInput,
  order: orderInput,
}: UseCalendarDayParams): UseCalendarDayResult => {
  const status = normalizeCalendarDayStatus(statusInput)
  const sort = normalizeCalendarDaySort(sortInput)
  const order = normalizeCalendarDayOrder(orderInput)

  const isDateValid = useMemo(() => isValidCalendarDate(date), [date])

  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<UseCalendarDayState>({ status: 'idle' })

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortControllerRef.current?.abort(), [])

  useEffect(() => {
    abortControllerRef.current?.abort()

    if (!isDateValid) {
      setState({
        status: 'error',
        error: buildCalendarDayValidationErrorVm(date),
      })
      return
    }

    const cacheKey = buildCacheKey(date, status, sort, order)
    const cached = cache.get(cacheKey)

    if (cached && reloadToken === 0) {
      setState({ status: 'success', data: cached })
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    let isActive = true

    setState((prev) => ({
      status: 'loading',
      data: prev.status === 'success' ? prev.data : undefined,
      requestId: prev.requestId,
    }))

    const fetchDay = async () => {
      try {
        const { data, requestId } = await getCalendarDay(
          { date, status, sort, order },
          { signal: controller.signal },
        )

        if (!isActive) return

        const vm = buildCalendarDayVm(data, status, sort, order)
        cache.set(cacheKey, vm)

        setState({
          status: 'success',
          data: vm,
          requestId,
        })
      } catch (error) {
        if (!isActive || controller.signal.aborted) return

        if (error instanceof CalendarDayApiError) {
          setState({
            status: 'error',
            error: buildCalendarDayErrorVm(error),
            requestId: error.requestId,
          })
          return
        }

        console.error('Unexpected error in useCalendarDay', error)
        setState({
          status: 'error',
          error: {
            kind: 'unknown',
            message: 'Nie udało się wczytać listy zadań',
          },
        })
      }
    }

    void fetchDay()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [date, isDateValid, order, reloadToken, sort, status])

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return {
    ...state,
    reload,
  }
}

useCalendarDay.displayName = 'useCalendarDay'
