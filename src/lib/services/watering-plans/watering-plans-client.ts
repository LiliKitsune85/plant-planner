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

export type WateringPlanApiErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'not_found'
  | 'conflict'
  | 'http'
  | 'network'
  | 'parse'
  | 'unknown'

type WateringPlanApiErrorOptions = {
  status?: number
  requestId?: string
  details?: unknown
  kind?: WateringPlanApiErrorKind
  cause?: unknown
}

export class WateringPlanApiError extends Error {
  readonly code: string
  readonly status?: number
  readonly requestId?: string
  readonly details?: unknown
  readonly kind: WateringPlanApiErrorKind

  constructor(code: string, message: string, options: WateringPlanApiErrorOptions = {}) {
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

const determineErrorKind = (status?: number, code?: string): WateringPlanApiErrorKind => {
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
      if (typeof status === 'number' && status >= 400) return 'http'
      return 'unknown'
  }
}

export type SetWateringPlanOptions = {
  signal?: AbortSignal
}

export type SetWateringPlanResult = {
  data: SetWateringPlanResultDto
  requestId?: string
}

const isValidSource = (
  source: unknown,
): source is SetWateringPlanCommand['source'] => {
  if (!source || typeof source !== 'object') return false
  const value = source as { type?: unknown }
  return value.type === 'manual' || value.type === 'ai'
}

const ensureManualSource = (
  command: SetWateringPlanCommand,
): SetWateringPlanCommand => ({
  ...command,
  source: { type: 'manual' },
})

const ensureCommandHasSource = (
  command: SetWateringPlanCommand,
): SetWateringPlanCommand => {
  const candidate = (command as { source?: unknown }).source
  if (isValidSource(candidate)) {
    return command
  }

  console.warn(
    'setWateringPlan: payload missing source, defaulting to manual source.',
    { command },
  )

  return ensureManualSource(command)
}

export const setWateringPlan = async (
  plantId: string,
  command: SetWateringPlanCommand,
  options: SetWateringPlanOptions = {},
): Promise<SetWateringPlanResult> => {
  const payload = ensureCommandHasSource(command)

  let response: Response
  try {
    response = await fetch(`/api/plants/${plantId}/watering-plan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    })
  } catch (error) {
    throw new WateringPlanApiError('NETWORK_ERROR', 'Nie udało się zapisać planu podlewania.', {
      kind: 'network',
      cause: error,
    })
  }

  let envelope: ApiEnvelope<SetWateringPlanResultDto>
  try {
    envelope = (await response.json()) as ApiEnvelope<SetWateringPlanResultDto>
  } catch (error) {
    throw new WateringPlanApiError(
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
    throw new WateringPlanApiError(code, message, {
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

