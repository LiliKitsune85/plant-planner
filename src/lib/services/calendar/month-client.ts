import type { CalendarMonthResponseDto } from '@/types'

import type { CalendarTaskStatusFilter } from './types'

type ApiErrorPayload = {
  code: string
  message: string
  details?: unknown
}

type ApiEnvelope<TData> = {
  data: TData | null
  error: ApiErrorPayload | null
  meta?: Record<string, unknown> | null
}

export type CalendarMonthApiErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'http'
  | 'network'
  | 'parse'
  | 'unknown'

type CalendarMonthApiErrorOptions = {
  status?: number
  requestId?: string
  details?: unknown
  kind?: CalendarMonthApiErrorKind
  cause?: unknown
}

export class CalendarMonthApiError extends Error {
  readonly code: string
  readonly status?: number
  readonly requestId?: string
  readonly details?: unknown
  readonly kind: CalendarMonthApiErrorKind

  constructor(code: string, message: string, options: CalendarMonthApiErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.code = code
    this.status = options.status
    this.requestId = options.requestId
    this.details = options.details
    this.kind = options.kind ?? 'unknown'
  }
}

const buildQueryString = (params: Record<string, string | undefined>): string => {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue
    searchParams.set(key, value)
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

const detectRequestId = (meta?: Record<string, unknown> | null): string | undefined => {
  if (!meta) return undefined
  const value = (meta as { request_id?: unknown }).request_id
  return typeof value === 'string' ? value : undefined
}

const determineErrorKind = (
  status?: number,
  code?: string,
): CalendarMonthApiErrorKind => {
  if (code === 'VALIDATION_ERROR') return 'validation'
  if (code === 'UNAUTHENTICATED' || status === 401) return 'unauthenticated'
  if (status && status >= 400) return 'http'
  return 'unknown'
}

type GetCalendarMonthParams = {
  month: string
  status?: CalendarTaskStatusFilter
}

type GetCalendarMonthOptions = {
  signal?: AbortSignal
}

export type GetCalendarMonthResult = {
  data: CalendarMonthResponseDto
  requestId?: string
}

export const getCalendarMonth = async (
  params: GetCalendarMonthParams,
  options: GetCalendarMonthOptions = {},
): Promise<GetCalendarMonthResult> => {
  const query = buildQueryString({
    month: params.month,
    status: params.status,
  })

  let response: Response
  try {
    response = await fetch(`/api/calendar/month${query}`, { signal: options.signal })
  } catch (error) {
    throw new CalendarMonthApiError('NETWORK_ERROR', 'Failed to reach calendar API', {
      kind: 'network',
      cause: error,
    })
  }

  let envelope: ApiEnvelope<CalendarMonthResponseDto>
  try {
    envelope = (await response.json()) as ApiEnvelope<CalendarMonthResponseDto>
  } catch (error) {
    throw new CalendarMonthApiError('PARSE_ERROR', 'Failed to parse calendar payload', {
      status: response.status,
      kind: 'parse',
      cause: error,
    })
  }

  const requestId = detectRequestId(envelope.meta ?? null)

  if (!response.ok || envelope.error || !envelope.data) {
    const errorPayload = envelope.error
    const code = errorPayload?.code ?? 'HTTP_ERROR'
    const message =
      errorPayload?.message ?? `Request failed with status ${response.status}`
    throw new CalendarMonthApiError(code, message, {
      status: response.status,
      requestId,
      details: errorPayload?.details,
      kind: determineErrorKind(response.status, code),
    })
  }

  return {
    data: envelope.data,
    requestId,
  }
}
