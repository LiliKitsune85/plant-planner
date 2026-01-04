import { randomUUID } from 'node:crypto'

import type { APIRoute } from 'astro'

import type { WateringTaskListDto } from '../../../types'
import { requireUserId } from '../../../lib/api/auth/require-user-id'
import { parseGetWateringTasksQuery } from '../../../lib/api/watering-tasks/get-watering-tasks-request'
import { HttpError, isHttpError } from '../../../lib/http/errors'
import { listWateringTasks } from '../../../lib/services/watering-tasks/list-watering-tasks'

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
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
    meta: { request_id: requestId },
  })

export const GET: APIRoute = async ({ locals, request, url }) => {
  const requestId = randomUUID()

  try {
    const filters = parseGetWateringTasksQuery(url.searchParams)
    const userId = await requireUserId(locals, request)
    const result = await listWateringTasks(
      locals.supabase,
      {
        userId,
        ...filters,
      },
      { requestId },
    )

    const data: WateringTaskListDto = {
      items: result.items,
    }

    return json(200, {
      data,
      error: null,
      meta: {
        request_id: requestId,
        next_cursor: result.nextCursor,
      },
    })
  } catch (error) {
    if (isHttpError(error)) {
      console.error('Handled error in GET /api/watering-tasks', {
        error,
        requestId,
      })
      return handleHttpError(error, requestId)
    }

    console.error('Unhandled error in GET /api/watering-tasks', {
      error,
      requestId,
    })
    return handleUnexpectedError(requestId)
  }
}

