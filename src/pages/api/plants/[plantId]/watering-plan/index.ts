import { randomUUID } from 'node:crypto'

import type { APIRoute } from 'astro'

import type { SetWateringPlanResultDto } from '../../../../../types'
import { requireUserId } from '../../../../../lib/api/auth/require-user-id'
import {
  parseSetWateringPlanParams,
  parseSetWateringPlanRequest,
} from '../../../../../lib/api/watering-plans/set-watering-plan-request'
import { HttpError, isHttpError } from '../../../../../lib/http/errors'
import { setPlantWateringPlan } from '../../../../../lib/services/watering-plans/set-watering-plan'

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
  json<SetWateringPlanResultDto>(error.status, {
    data: null,
    error: { code: error.code, message: error.message, details: error.details ?? null },
    meta: { request_id: requestId },
  })

const handleUnexpectedError = (requestId: string): Response =>
  json<SetWateringPlanResultDto>(500, {
    data: null,
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
    meta: { request_id: requestId },
  })

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const requestId = randomUUID()

  try {
    const { plantId } = parseSetWateringPlanParams(params)
    const userId = await requireUserId(locals, request)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'Invalid JSON body', 'INVALID_JSON')
    }

    const command = parseSetWateringPlanRequest(body)
    const result = await setPlantWateringPlan(locals.supabase, {
      userId,
      plantId,
      command,
    })

    return json<SetWateringPlanResultDto>(200, {
      data: result,
      error: null,
      meta: { request_id: requestId },
    })
  } catch (error) {
    if (isHttpError(error)) {
      console.error('Handled error in PUT /api/plants/[plantId]/watering-plan', {
        error,
        requestId,
        plantId: params?.plantId,
      })
      return handleHttpError(error, requestId)
    }

    console.error('Unhandled error in PUT /api/plants/[plantId]/watering-plan', {
      error,
      requestId,
      plantId: params?.plantId,
    })
    return handleUnexpectedError(requestId)
  }
}

