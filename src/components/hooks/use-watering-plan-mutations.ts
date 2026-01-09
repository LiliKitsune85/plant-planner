import { useCallback, useState } from 'react'

import type {
  WateringPlanFormErrors,
  WateringPlanMutationError,
  WateringPlanMutationErrorKind,
} from '@/components/watering-plan/editor/types'
import type { SetWateringPlanCommand, SetWateringPlanResultDto } from '@/types'
import {
  setWateringPlan,
  type SetWateringPlanOptions,
  type WateringPlanApiErrorKind,
  WateringPlanApiError,
} from '@/lib/services/watering-plans/watering-plans-client'
import { invalidateCalendarDayCacheByDate } from './use-calendar-day'
import { invalidateCalendarMonthCacheByMonth } from './use-calendar-month'

type SubmitPlanOptions = SetWateringPlanOptions

const KNOWN_FORM_FIELDS: Array<keyof WateringPlanFormErrors> = [
  'form',
  'interval_days',
  'start_from',
  'custom_start_on',
  'horizon_days',
  'schedule_basis',
  'overdue_policy',
]

const isKnownField = (field: unknown): field is keyof WateringPlanFormErrors => {
  if (typeof field !== 'string') return false
  return KNOWN_FORM_FIELDS.includes(field as keyof WateringPlanFormErrors)
}

const ensureErrorArray = (
  target: WateringPlanFormErrors,
  field: keyof WateringPlanFormErrors,
): string[] => {
  if (!target[field]) {
    target[field] = []
  }
  return target[field] as string[]
}

const appendFieldError = (
  target: WateringPlanFormErrors,
  field: keyof WateringPlanFormErrors,
  message: string,
) => {
  ensureErrorArray(target, field).push(message)
}

const pickFieldFromPath = (path: unknown): keyof WateringPlanFormErrors => {
  if (Array.isArray(path) && path.length > 0) {
    const last = path[path.length - 1]
    if (isKnownField(last)) {
      return last
    }
  }

  if (typeof path === 'string' && isKnownField(path)) {
    return path
  }

  return 'form'
}

const extractFieldErrors = (details: unknown): WateringPlanFormErrors | undefined => {
  if (!details || typeof details !== 'object') return undefined

  const result: WateringPlanFormErrors = {}
  let hasErrors = false

  const fields = (details as { fields?: unknown }).fields
  if (fields && typeof fields === 'object') {
    for (const [fieldKey, messages] of Object.entries(fields as Record<string, unknown>)) {
      if (!Array.isArray(messages) || messages.length === 0) continue
      const validMessages = messages.filter(
        (message): message is string => typeof message === 'string' && message.length > 0,
      )
      if (validMessages.length === 0) continue

      const field = isKnownField(fieldKey) ? (fieldKey as keyof WateringPlanFormErrors) : 'form'
      const bucket = ensureErrorArray(result, field)
      bucket.push(...validMessages)
      hasErrors = true
    }
  }

  if (hasErrors) {
    return result
  }

  const issues = (details as { issues?: unknown }).issues
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (!issue || typeof issue !== 'object') continue
      const message = (issue as { message?: unknown }).message
      if (typeof message !== 'string' || !message) continue
      const path = (issue as { path?: unknown }).path
      const field = pickFieldFromPath(path)
      appendFieldError(result, field, message)
      hasErrors = true
    }
  }

  return hasErrors ? result : undefined
}

const parseIsoDate = (value: string): Date | null => {
  if (!value) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatMonthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

const enumerateMonthsBetween = (start: string, end: string): string[] => {
  const startDate = parseIsoDate(start)
  const endDate = parseIsoDate(end)
  if (!startDate || !endDate) return []

  const normalizedStart = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
  )
  const normalizedEnd = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1))

  const months: string[] = []
  if (normalizedStart > normalizedEnd) {
    return enumerateMonthsBetween(end, start)
  }

  const cursor = new Date(normalizedStart)
  while (cursor <= normalizedEnd) {
    months.push(formatMonthKey(cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return months
}

const invalidateCachesFromResult = (result: SetWateringPlanResultDto | null) => {
  const summary = result?.tasks_regenerated
  if (!summary) return

  const months = enumerateMonthsBetween(summary.from, summary.to)
  for (const month of months) {
    invalidateCalendarMonthCacheByMonth(month)
  }

  invalidateCalendarDayCacheByDate(summary.from)
  if (summary.to !== summary.from) {
    invalidateCalendarDayCacheByDate(summary.to)
  }
}

const mapErrorKind = (kind: WateringPlanApiErrorKind): WateringPlanMutationErrorKind => {
  switch (kind) {
    case 'validation':
      return 'validation'
    case 'conflict':
      return 'conflict'
    case 'not_found':
      return 'notFound'
    case 'unauthenticated':
      return 'unauthenticated'
    case 'network':
      return 'network'
    case 'parse':
      return 'parse'
    case 'http':
      return 'http'
    default:
      return 'unknown'
  }
}

const mapApiError = (error: unknown): WateringPlanMutationError => {
  if (error instanceof WateringPlanApiError) {
    return {
      kind: mapErrorKind(error.kind),
      code: error.code,
      message: error.message ?? 'Nie udało się zapisać planu podlewania.',
      requestId: error.requestId,
      details: error.details,
      fieldErrors:
        error.kind === 'validation' ? extractFieldErrors(error.details) : undefined,
    }
  }

  return {
    kind: 'unknown',
    message: error instanceof Error ? error.message : 'Nieznany błąd zapisu planu podlewania.',
  }
}

export const useWateringPlanMutations = () => {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<WateringPlanMutationError | null>(null)
  const [requestId, setRequestId] = useState<string | undefined>(undefined)
  const [lastResult, setLastResult] = useState<SetWateringPlanResultDto | null>(null)

  const submitSetPlan = useCallback(
    async (
      plantId: string,
      command: SetWateringPlanCommand,
      options?: SubmitPlanOptions,
    ): Promise<SetWateringPlanResultDto | null> => {
      setPending(true)
      setError(null)
      setRequestId(undefined)

      try {
        const { data, requestId: responseRequestId } = await setWateringPlan(
          plantId,
          command,
          options,
        )
        setLastResult(data)
        setRequestId(responseRequestId)
        invalidateCachesFromResult(data)
        return data
      } catch (err) {
        const mapped = mapApiError(err)
        setError(mapped)
        if (err instanceof WateringPlanApiError) {
          setRequestId(err.requestId)
        }
        return null
      } finally {
        setPending(false)
      }
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    pending,
    error,
    requestId,
    lastResult,
    submitSetPlan,
    clearError,
  }
}

useWateringPlanMutations.displayName = 'useWateringPlanMutations'

