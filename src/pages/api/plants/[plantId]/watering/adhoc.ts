import { randomUUID } from 'node:crypto'

import type { APIRoute } from 'astro'

import type { AdhocWateringResultDto } from '../../../../../types'
import {
  parseAdhocWateringParams,
  parseAdhocWateringRequest,
} from '../../../../../lib/api/watering-tasks/create-adhoc-watering-request'
import { HttpError, isHttpError } from '../../../../../lib/http/errors'
import { createAdhocWateringTask } from '../../../../../lib/services/watering-tasks/create-adhoc-watering-task'
import { requireUserId } from '../../../../../lib/api/auth/require-user-id'
import { createAdminClient } from '../../../../../db/supabase.admin'

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
  extraHeaders: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })

const handleHttpError = (error: HttpError, requestId: string): Response =>
  json(error.status, {
    data: null,
    error: {
      code: error.code,
      message: error.message,
      details: error.details ?? null,
    },
    meta: { request_id: requestId },
  })

const handleUnexpectedError = (requestId: string): Response =>
  json(500, {
    data: null,
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
    meta: { request_id: requestId },
  })

export const POST: APIRoute = async ({ locals, params, request }) => {
  const requestId = randomUUID()

  try {
    const { plantId } = parseAdhocWateringParams(params)
    const userId = await requireUserId(locals, request)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'Invalid JSON body', 'INVALID_JSON')
    }

    const command = parseAdhocWateringRequest(body)
    const supabaseAdmin = createAdminClient()

    const data: AdhocWateringResultDto = await createAdhocWateringTask(
      { supabaseUser: locals.supabase, supabaseAdmin },
      {
        userId,
        plantId,
        command,
        context: { requestId },
      },
    )

    const location = new URL(`/api/watering-tasks/${data.task.id}`, request.url).toString()

    return json(
      201,
      { data, error: null, meta: { request_id: requestId } },
      { Location: location },
    )
  } catch (error) {
    if (isHttpError(error)) {
      console.error('Handled error in POST /api/plants/[plantId]/watering/adhoc', {
        error,
        requestId,
        plantId: params?.plantId,
      })
      return handleHttpError(error, requestId)
    }

    console.error('Unhandled error in POST /api/plants/[plantId]/watering/adhoc', {
      error,
      requestId,
      plantId: params?.plantId,
    })
    return handleUnexpectedError(requestId)
  }
}

