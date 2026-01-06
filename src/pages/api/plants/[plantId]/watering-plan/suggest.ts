import { randomUUID } from 'node:crypto'

import type { APIRoute } from 'astro'

import type { WateringPlanSuggestionDto } from '../../../../../types'
import { requireUserId } from '../../../../../lib/api/auth/require-user-id'
import {
  parseSuggestWateringPlanParams,
  parseSuggestWateringPlanRequest,
} from '../../../../../lib/api/watering-plans/suggest-watering-plan-request'
import { HttpError, isHttpError } from '../../../../../lib/http/errors'
import { suggestWateringPlan } from '../../../../../lib/services/watering-plans/suggest-watering-plan'

export const prerender = false

type ApiError = {
  code: string
  message: string
  details?: unknown
}

type ApiEnvelope<TData> = {
  data: TData | null
  error: ApiError | null
  meta: Record<string, unknown>
}

const json = <TData>(
  status: number,
  envelope: ApiEnvelope<TData>,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })

const handleHttpError = (error: HttpError, requestId: string): Response =>
  json<WateringPlanSuggestionDto>(error.status, {
    data: null,
    error: { code: error.code, message: error.message, details: error.details ?? null },
    meta: { request_id: requestId },
  })

const handleUnexpectedError = (requestId: string): Response =>
  json<WateringPlanSuggestionDto>(500, {
    data: null,
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
    meta: { request_id: requestId },
  })

export const POST: APIRoute = async ({ locals, params, request }) => {
  const requestId = randomUUID()

  try {
    const { plantId } = parseSuggestWateringPlanParams(params)
    const userId = await requireUserId(locals, request)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'Invalid JSON body', 'INVALID_JSON')
    }

    const command = parseSuggestWateringPlanRequest(body)
    const result = await suggestWateringPlan(locals.supabase, { userId, plantId, command })

    if (result.status === 'rate_limited') {
      return json<WateringPlanSuggestionDto>(429, {
        data: result.suggestion,
        error: {
          code: 'AI_RATE_LIMITED',
          message: 'AI rate limit exceeded',
          details: { unlock_at: result.quota.unlock_at },
        },
        meta: {
          request_id: requestId,
          limit_per_hour: result.quota.limit_per_hour,
        },
      })
    }

    return json<WateringPlanSuggestionDto>(200, {
      data: result.suggestion,
      error: null,
      meta: {
        request_id: requestId,
        response_time_budget_ms: 5000,
      },
    })
  } catch (error) {
    if (isHttpError(error)) {
      console.error('Handled error in POST /api/plants/[plantId]/watering-plan/suggest', {
        error,
        requestId,
        plantId: params?.plantId,
      })
      return handleHttpError(error, requestId)
    }

    console.error('Unhandled error in POST /api/plants/[plantId]/watering-plan/suggest', {
      error,
      requestId,
      plantId: params?.plantId,
    })
    return handleUnexpectedError(requestId)
  }
}

