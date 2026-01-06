import type { SupabaseClient } from '../../../db/supabase.client'
import type {
  AiQuotaDto,
  SuggestWateringPlanCommand,
  WateringPlanSuggestionDto,
} from '../../../types'
import { HttpError, isHttpError } from '../../http/errors'
import { getAiQuota } from '../ai/ai-quota'
import {
  createAiRequest,
  markAiRequestError,
  markAiRequestRateLimited,
  markAiRequestSuccess,
} from '../ai/ai-requests'
import { requestWateringPlanSuggestion } from '../ai/openrouter-client'

type ServiceParams = {
  userId: string
  plantId: string
  command: SuggestWateringPlanCommand
  now?: Date
}

type SuggestWateringPlanSuccess = {
  status: 'success'
  suggestion: WateringPlanSuggestionDto
  quota: AiQuotaDto
}

type SuggestWateringPlanRateLimited = {
  status: 'rate_limited'
  suggestion: WateringPlanSuggestionDto
  quota: AiQuotaDto
}

export type SuggestWateringPlanServiceResult =
  | SuggestWateringPlanSuccess
  | SuggestWateringPlanRateLimited

const ensurePlantOwnership = async (
  supabase: SupabaseClient,
  userId: string,
  plantId: string,
): Promise<void> => {
  const { data, error } = await supabase
    .from('plants')
    .select('id')
    .eq('id', plantId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('suggestWateringPlan: plant lookup failed', { error, userId, plantId })
    throw new HttpError(500, 'Failed to verify plant ownership', 'PLANT_LOOKUP_FAILED')
  }

  if (!data) {
    throw new HttpError(404, 'Plant not found', 'PLANT_NOT_FOUND')
  }
}

const resolveOpenRouterConfig = () => ({
  apiKey: import.meta.env.OPENROUTER_API_KEY ?? '',
  model: import.meta.env.OPENROUTER_MODEL ?? undefined,
})

const buildRateLimitedSuggestion = (
  aiRequestId: string,
): WateringPlanSuggestionDto => ({
  ai_request_id: aiRequestId,
  suggestion: null,
  explanation: null,
})

export const suggestWateringPlan = async (
  supabase: SupabaseClient,
  { userId, plantId, command, now }: ServiceParams,
): Promise<SuggestWateringPlanServiceResult> => {
  await ensurePlantOwnership(supabase, userId, plantId)

  const quota = await getAiQuota(supabase, { userId, now })
  const aiRequestId = await createAiRequest(supabase, { userId, plantId })

  if (quota.is_rate_limited) {
    await markAiRequestRateLimited(supabase, {
      id: aiRequestId,
      message: 'Hourly AI quota exceeded',
    })

    return {
      status: 'rate_limited',
      suggestion: buildRateLimitedSuggestion(aiRequestId),
      quota,
    }
  }

  const { apiKey, model } = resolveOpenRouterConfig()

  try {
    const aiResult = await requestWateringPlanSuggestion({
      apiKey,
      model,
      speciesName: command.context.species_name,
    })

    await markAiRequestSuccess(supabase, {
      id: aiRequestId,
      model: aiResult.model,
      metrics: {
        latencyMs: aiResult.latencyMs,
        promptTokens: aiResult.usage.promptTokens ?? undefined,
        completionTokens: aiResult.usage.completionTokens ?? undefined,
        totalTokens: aiResult.usage.totalTokens ?? undefined,
      },
    })

    return {
      status: 'success',
      suggestion: {
        ai_request_id: aiRequestId,
        suggestion: aiResult.suggestion,
        explanation: aiResult.explanation,
      },
      quota,
    }
  } catch (error) {
    if (isHttpError(error)) {
      await markAiRequestError(supabase, {
        id: aiRequestId,
        code: error.code,
        message: error.message,
      })
      throw error
    }

    await markAiRequestError(supabase, {
      id: aiRequestId,
      code: 'AI_PROVIDER_ERROR',
      message: 'AI provider failed unexpectedly',
    })

    console.error('Unhandled error while suggesting watering plan', { error, aiRequestId })
    throw error
  }
}

