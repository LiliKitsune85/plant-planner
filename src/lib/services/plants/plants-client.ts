import type { PlantListDto } from '@/types'

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

export type PlantsApiErrorKind = 'validation' | 'http' | 'network' | 'parse' | 'unknown'

type PlantsApiErrorOptions = {
  status?: number
  requestId?: string
  details?: unknown
  kind?: PlantsApiErrorKind
  cause?: unknown
}

export class PlantsApiError extends Error {
  readonly code: string
  readonly status?: number
  readonly requestId?: string
  readonly details?: unknown
  readonly kind: PlantsApiErrorKind

  constructor(code: string, message: string, options: PlantsApiErrorOptions = {}) {
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
    if (value === undefined || value === null || value === '') continue
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

const determineErrorKind = (status?: number, code?: string): PlantsApiErrorKind => {
  if (code === 'VALIDATION_ERROR') return 'validation'
  if (status && status >= 400) return 'http'
  return 'unknown'
}

type ListPlantsParams = {
  q?: string
  limit?: number
}

type ListPlantsOptions = {
  signal?: AbortSignal
}

export const listPlants = async (
  params: ListPlantsParams,
  options: ListPlantsOptions = {},
): Promise<{ data: PlantListDto; requestId?: string }> => {
  const query = buildQueryString({
    q: params.q,
    limit: params.limit ? String(params.limit) : undefined,
  })

  let response: Response
  try {
    response = await fetch(`/api/plants${query}`, { signal: options.signal })
  } catch (error) {
    throw new PlantsApiError('NETWORK_ERROR', 'Nie udało się połączyć z API roślin', {
      kind: 'network',
      cause: error,
    })
  }

  let envelope: ApiEnvelope<PlantListDto>
  try {
    envelope = (await response.json()) as ApiEnvelope<PlantListDto>
  } catch (error) {
    throw new PlantsApiError('PARSE_ERROR', 'Nie udało się przetworzyć odpowiedzi API', {
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
      errorPayload?.message ?? `Żądanie nie powiodło się (status ${response.status}).`
    throw new PlantsApiError(code, message, {
      status: response.status,
      requestId,
      details: errorPayload?.details,
      kind: determineErrorKind(response.status, code),
    })
  }

  return { data: envelope.data, requestId }
}
