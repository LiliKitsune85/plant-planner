import type {
  CreatePlantCommand,
  CreatePlantResultDto,
  DeletePlantResultDto,
  PlantDetailDto,
  PlantListDto,
  UpdatePlantCommand,
} from '@/types'

import type { PlantSortField, SortOrder } from './types'

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

export type PlantsApiErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'conflict'
  | 'notFound'
  | 'http'
  | 'network'
  | 'parse'
  | 'unknown'

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
  if (code === 'INVALID_QUERY_PARAMS' || code === 'VALIDATION_ERROR') return 'validation'
  if (code === 'UNAUTHENTICATED' || status === 401) return 'unauthenticated'
  if (code === 'DUPLICATE_INDEX_CONFLICT' || status === 409) return 'conflict'
  if (code === 'PLANT_NOT_FOUND' || status === 404) return 'notFound'
  if (status && status >= 400) return 'http'
  return 'unknown'
}

const detectNextCursor = (meta?: Record<string, unknown> | null): string | null => {
  if (!meta) return null
  const value = (meta as { next_cursor?: unknown }).next_cursor
  return typeof value === 'string' ? value : null
}

type RequestPlantsApiResult<TData> = {
  response: Response
  envelope: ApiEnvelope<TData>
}

const requestPlantsApi = async <TData>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<RequestPlantsApiResult<TData>> => {
  let response: Response
  try {
    response = await fetch(input, init)
  } catch (error) {
    throw new PlantsApiError('NETWORK_ERROR', 'Nie udało się połączyć z API roślin', {
      kind: 'network',
      cause: error,
    })
  }

  let envelope: ApiEnvelope<TData>
  try {
    envelope = (await response.json()) as ApiEnvelope<TData>
  } catch (error) {
    throw new PlantsApiError('PARSE_ERROR', 'Nie udało się przetworzyć odpowiedzi API', {
      status: response.status,
      kind: 'parse',
      cause: error,
    })
  }

  return { response, envelope }
}

type ListPlantsParams = {
  q?: string
  species?: string
  sort?: PlantSortField
  order?: SortOrder
  limit?: number
  cursor?: string
}

type ListPlantsOptions = {
  signal?: AbortSignal
}

export const listPlants = async (
  params: ListPlantsParams,
  options: ListPlantsOptions = {},
): Promise<{ data: PlantListDto; nextCursor: string | null; requestId?: string }> => {
  const query = buildQueryString({
    q: params.q,
    species: params.species,
    sort: params.sort,
    order: params.order,
    limit: params.limit ? String(params.limit) : undefined,
    cursor: params.cursor,
  })

  const { response, envelope } = await requestPlantsApi<PlantListDto>(`/api/plants${query}`, {
    signal: options.signal,
  })
  const requestId = detectRequestId(envelope.meta ?? null)
  const nextCursor = detectNextCursor(envelope.meta ?? null)

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

  return { data: envelope.data, nextCursor, requestId }
}

type CreatePlantOptions = {
  signal?: AbortSignal
}

export const createPlant = async (
  command: CreatePlantCommand,
  options: CreatePlantOptions = {},
): Promise<{ data: CreatePlantResultDto; requestId?: string }> => {
  const { response, envelope } = await requestPlantsApi<CreatePlantResultDto>('/api/plants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: options.signal,
  })
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

type GetPlantDetailParams = {
  plantId: string
}

type GetPlantDetailOptions = {
  signal?: AbortSignal
}

export const getPlantDetail = async (
  params: GetPlantDetailParams,
  options: GetPlantDetailOptions = {},
): Promise<{ data: PlantDetailDto; requestId?: string }> => {
  const { response, envelope } = await requestPlantsApi<PlantDetailDto>(
    `/api/plants/${params.plantId}`,
    {
      method: 'GET',
      signal: options.signal,
    },
  )
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

type UpdatePlantParams = {
  plantId: string
  payload: UpdatePlantCommand
}

type UpdatePlantOptions = {
  signal?: AbortSignal
}

export const updatePlant = async (
  params: UpdatePlantParams,
  options: UpdatePlantOptions = {},
): Promise<{ data: PlantDetailDto; requestId?: string }> => {
  const { response, envelope } = await requestPlantsApi<PlantDetailDto>(
    `/api/plants/${params.plantId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.payload),
      signal: options.signal,
    },
  )
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

type DeletePlantOptions = {
  signal?: AbortSignal
}

export const deletePlant = async (
  plantId: string,
  options: DeletePlantOptions = {},
): Promise<{ data: DeletePlantResultDto; requestId?: string }> => {
  const { response, envelope } = await requestPlantsApi<DeletePlantResultDto>(
    `/api/plants/${plantId}?confirm=true`,
    {
      method: 'DELETE',
      signal: options.signal,
    },
  )
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
