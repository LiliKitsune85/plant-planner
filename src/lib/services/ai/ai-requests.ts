import type { Tables, TablesInsert } from '../../../db/database.types'
import type { SupabaseClient } from '../../../db/supabase.client'
import { HttpError } from '../../http/errors'

type AiRequestRow = Tables<'ai_requests'>

type AiRequestMetrics = {
  latencyMs?: number | null
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
}

const sanitizeMetric = (value: number | null | undefined, field: string): number | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new HttpError(500, `Invalid ${field} metric for AI request`, 'AI_REQUEST_INVALID_METRIC', {
      field,
      value,
    })
  }

  return Math.round(value)
}

const sanitizeMetrics = (
  metrics: AiRequestMetrics,
): Partial<
  Pick<
    AiRequestRow,
    'latency_ms' | 'prompt_tokens' | 'completion_tokens' | 'total_tokens'
  >
> => {
  const patch: Partial<
    Pick<
      AiRequestRow,
      'latency_ms' | 'prompt_tokens' | 'completion_tokens' | 'total_tokens'
    >
  > = {}

  if ('latencyMs' in metrics) {
    patch.latency_ms = sanitizeMetric(metrics.latencyMs, 'latency_ms')
  }

  if ('promptTokens' in metrics) {
    patch.prompt_tokens = sanitizeMetric(metrics.promptTokens, 'prompt_tokens')
  }

  if ('completionTokens' in metrics) {
    patch.completion_tokens = sanitizeMetric(metrics.completionTokens, 'completion_tokens')
  }

  if ('totalTokens' in metrics) {
    patch.total_tokens = sanitizeMetric(metrics.totalTokens, 'total_tokens')
  }

  return patch
}

const updateAiRequest = async (
  supabase: SupabaseClient,
  id: AiRequestRow['id'],
  patch: Partial<AiRequestRow>,
): Promise<void> => {
  const { error } = await supabase.from('ai_requests').update(patch).eq('id', id)

  if (error) {
    console.error('ai_requests update failed', { error, id, patch })
    throw new HttpError(500, 'Failed to update AI request', 'AI_REQUEST_UPDATE_FAILED')
  }
}

type CreateAiRequestParams = {
  userId: AiRequestRow['user_id']
  plantId?: AiRequestRow['plant_id']
  provider?: AiRequestRow['provider']
  status?: AiRequestRow['status']
}

export const createAiRequest = async (
  supabase: SupabaseClient,
  { userId, plantId, provider = 'openrouter', status = 'skipped' }: CreateAiRequestParams,
): Promise<AiRequestRow['id']> => {
  const insert: TablesInsert<'ai_requests'> = {
    user_id: userId,
    plant_id: plantId ?? null,
    provider,
    status,
  }

  const { data, error } = await supabase.from('ai_requests').insert(insert).select('id').single()

  if (error || !data) {
    console.error('ai_requests insert failed', { error, userId, plantId })
    throw new HttpError(500, 'Failed to create AI request', 'AI_REQUEST_CREATE_FAILED')
  }

  return data.id
}

type MarkAiRequestSuccessParams = {
  id: AiRequestRow['id']
  model: AiRequestRow['model']
  metrics?: AiRequestMetrics
}

export const markAiRequestSuccess = async (
  supabase: SupabaseClient,
  { id, model, metrics = {} }: MarkAiRequestSuccessParams,
): Promise<void> => {
  await updateAiRequest(supabase, id, {
    status: 'success',
    model,
    ...sanitizeMetrics(metrics),
    error_code: null,
    error_message: null,
  })
}

type MarkAiRequestErrorParams = {
  id: AiRequestRow['id']
  code: string
  message: string
  model?: AiRequestRow['model']
  metrics?: AiRequestMetrics
}

export const markAiRequestError = async (
  supabase: SupabaseClient,
  { id, code, message, model, metrics = {} }: MarkAiRequestErrorParams,
): Promise<void> => {
  await updateAiRequest(supabase, id, {
    status: 'error',
    model: model ?? null,
    ...sanitizeMetrics(metrics),
    error_code: code,
    error_message: message,
  })
}

type MarkAiRequestRateLimitedParams = {
  id: AiRequestRow['id']
  message?: string
}

export const markAiRequestRateLimited = async (
  supabase: SupabaseClient,
  { id, message }: MarkAiRequestRateLimitedParams,
): Promise<void> => {
  await updateAiRequest(supabase, id, {
    status: 'rate_limited',
    error_code: 'AI_RATE_LIMITED',
    error_message: message ?? 'AI rate limit exceeded',
  })
}

