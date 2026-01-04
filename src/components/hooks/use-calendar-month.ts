import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  CalendarMonthApiError,
  getCalendarMonth,
} from '@/lib/services/calendar/month-client'
import type { CalendarTaskStatusFilter } from '@/lib/services/calendar/types'
import type {
  CalendarMonthErrorVm,
  CalendarMonthVm,
} from '@/lib/services/calendar/month-view-model'
import {
  buildCalendarMonthErrorVm,
  buildCalendarMonthVm,
  buildClientValidationErrorVm,
  getCalendarMonthCacheKey,
  isValidCalendarMonthString,
  normalizeCalendarStatusFilter,
} from '@/lib/services/calendar/month-view-model'

type UseCalendarMonthParams = {
  month: string
  status?: CalendarTaskStatusFilter
}

type UseCalendarMonthState =
  | {
      status: 'idle'
      data?: undefined
      error?: undefined
      requestId?: undefined
    }
  | {
      status: 'loading'
      data?: CalendarMonthVm
      error?: undefined
      requestId?: string
    }
  | {
      status: 'success'
      data: CalendarMonthVm
      error?: undefined
      requestId?: string
    }
  | {
      status: 'error'
      data?: CalendarMonthVm
      error: CalendarMonthErrorVm
      requestId?: string
    }

type UseCalendarMonthResult = UseCalendarMonthState & {
  reload: () => void
}

const cache = new Map<string, CalendarMonthVm>()

export const invalidateCalendarMonthCache = (
  predicate?: (key: string, value: CalendarMonthVm) => boolean,
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

export const invalidateCalendarMonthCacheByMonth = (month: string): void => {
  invalidateCalendarMonthCache((key) => key.startsWith(`${month}:`))
}

export const useCalendarMonth = ({
  month,
  status: statusInput = 'pending',
}: UseCalendarMonthParams): UseCalendarMonthResult => {
  const status = normalizeCalendarStatusFilter(statusInput)
  const isMonthValid = useMemo(() => isValidCalendarMonthString(month), [month])

  const [reloadToken, setReloadToken] = useState(0)
  const [state, setState] = useState<UseCalendarMonthState>({ status: 'idle' })

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    abortControllerRef.current?.abort()

    if (!isMonthValid) {
      setState({
        status: 'error',
        error: buildClientValidationErrorVm(month),
      })
      return
    }

    const cacheKey = getCalendarMonthCacheKey(month, status)
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

    const fetchMonth = async () => {
      try {
        const { data, requestId } = await getCalendarMonth(
          { month, status },
          { signal: controller.signal },
        )

        if (!isActive) return

        const vm = buildCalendarMonthVm(data, status)
        cache.set(cacheKey, vm)

        setState({
          status: 'success',
          data: vm,
          requestId,
        })
      } catch (error) {
        if (!isActive) return
        if (controller.signal.aborted) return

        if (error instanceof CalendarMonthApiError) {
          setState({
            status: 'error',
            error: buildCalendarMonthErrorVm(error),
            requestId: error.requestId,
          })
          return
        }

        console.error('Unexpected error in useCalendarMonth', error)
        setState({
          status: 'error',
          error: {
            kind: 'unknown',
            message: 'Nie udało się wczytać kalendarza',
          },
        })
      }
    }

    void fetchMonth()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [isMonthValid, month, reloadToken, status])

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return {
    ...state,
    reload,
  }
}

useCalendarMonth.displayName = 'useCalendarMonth'
