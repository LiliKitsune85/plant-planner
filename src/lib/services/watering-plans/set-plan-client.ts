import type { SetWateringPlanCommand, SetWateringPlanResultDto } from '@/types'

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

export type SetWateringPlanApiErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'not_found'
  | 'conflict'
  | 'http'
  | 'network'
  | 'parse'
  | 'unknown'

type SetWateringPlanApiErrorOptions = {
  status?: number
  requestId?: string
  details?: unknown
  kind?: SetWateringPlanApiErrorKind
  cause?: unknown
}

export class SetWateringPlanApiError extends Error {
  readonly code: string
  readonly status?: number
  readonly requestId?: string
  readonly details?: unknown
  readonly kind: SetWateringPlanApiErrorKind

  constructor(code: string, message: string, options: SetWateringPlanApiErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.code = code
    this.status = options.status
    this.requestId = options.requestId
    this.details = options.details
    this.kind = options.kind ?? 'unknown'
  }
}

const detectRequestId = (meta?: Record<string, unknown> | null): string | undefined => {
  if (!meta) return undefined
  const value = (meta as { request_id?: unknown }).request_id
  return typeof value === 'string' ? value : undefined
}

const determineErrorKind = (status?: number, code?: string): SetWateringPlanApiErrorKind => {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 'validation'
    case 'UNAUTHENTICATED':
      return 'unauthenticated'
    case 'PLANT_NOT_FOUND':
    case 'AI_REQUEST_NOT_FOUND':
      return 'not_found'
    case 'PLAN_CONFLICT':
    case 'CONFLICT':
      return 'conflict'
    default:
      if (status === 401) return 'unauthenticated'
      if (status === 404) return 'not_found'
      if (status === 409) return 'conflict'
      if (status && status >= 400) return 'http'
      return 'unknown'
  }
}

type SetWateringPlanOptions = {
  signal?: AbortSignal
}

type SetWateringPlanResult = {
  data: SetWateringPlanResultDto
  requestId?: string
}

export const setWateringPlan = async (
  plantId: string,
  command: SetWateringPlanCommand,
  options: SetWateringPlanOptions = {},
): Promise<SetWateringPlanResult> => {
  let response: Response
  try {
    response = await fetch(`/api/plants/${plantId}/watering-plan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(command),
      signal: options.signal,
    })
  } catch (error) {
    throw new SetWateringPlanApiError('NETWORK_ERROR', 'Nie udało się zapisać planu podlewania.', {
      kind: 'network',
      cause: error,
    })
  }

  let envelope: ApiEnvelope<SetWateringPlanResultDto>
  try {
    envelope = (await response.json()) as ApiEnvelope<SetWateringPlanResultDto>
  } catch (error) {
    throw new SetWateringPlanApiError(
      'PARSE_ERROR',
      'Nie udało się przetworzyć odpowiedzi serwera planu podlewania.',
      {
        status: response.status,
        kind: 'parse',
        cause: error,
      },
    )
  }

  const requestId = detectRequestId(envelope.meta ?? null)

  if (!response.ok || envelope.error || !envelope.data) {
    const code = envelope.error?.code ?? 'HTTP_ERROR'
    const message =
      envelope.error?.message ?? `Zapis planu nie powiódł się (status ${response.status}).`
    throw new SetWateringPlanApiError(code, message, {
      status: response.status,
      requestId,
      details: envelope.error?.details,
      kind: determineErrorKind(response.status, code),
    })
  }

  return {
    data: envelope.data,
    requestId,
  }
}

