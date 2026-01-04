import { randomUUID } from 'node:crypto'

import type { APIRoute } from 'astro'

import type { DeleteWateringTaskResultDto, UpdateWateringTaskResultDto } from '../../../types'
import { requireUserId } from '../../../lib/api/auth/require-user-id'
import { parseDeleteWateringTaskRequest } from '../../../lib/api/watering-tasks/delete-watering-task-request'
import {
  parseUpdateWateringTaskParams,
  parseUpdateWateringTaskRequest,
} from '../../../lib/api/watering-tasks/update-watering-task-request'
import { HttpError, isHttpError } from '../../../lib/http/errors'
import { deleteWateringTask } from '../../../lib/services/watering-tasks/delete-watering-task'
import { updateWateringTask } from '../../../lib/services/watering-tasks/update-watering-task'

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

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const requestId = randomUUID()

  try {
    const { taskId } = parseUpdateWateringTaskParams(params)
    const userId = await requireUserId(locals, request)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'Invalid JSON body', 'INVALID_JSON')
    }

    const command = parseUpdateWateringTaskRequest(body)

    const data: UpdateWateringTaskResultDto = await updateWateringTask(locals.supabase, {
      userId,
      taskId,
      command,
      context: { requestId },
    })

    return json(200, { data, error: null, meta: { request_id: requestId } })
  } catch (error) {
    if (isHttpError(error)) {
      console.error('Handled error in PATCH /api/watering-tasks/[taskId]', {
        error,
        requestId,
        taskId: params?.taskId,
      })
      return handleHttpError(error, requestId)
    }

    console.error('Unhandled error in PATCH /api/watering-tasks/[taskId]', {
      error,
      requestId,
      taskId: params?.taskId,
    })
    return handleUnexpectedError(requestId)
  }
}

export const DELETE: APIRoute = async ({ locals, params, request, url }) => {
  const requestId = randomUUID()

  try {
    const { taskId } = parseDeleteWateringTaskRequest(params, url.searchParams)
    const userId = await requireUserId(locals, request)

    const data: DeleteWateringTaskResultDto = await deleteWateringTask(locals.supabase, {
      userId,
      taskId,
    })

    return json(200, { data, error: null, meta: { request_id: requestId } })
  } catch (error) {
    if (isHttpError(error)) {
      console.error('Handled error in DELETE /api/watering-tasks/[taskId]', {
        error,
        requestId,
        taskId: params?.taskId,
      })
      return handleHttpError(error, requestId)
    }

    console.error('Unhandled error in DELETE /api/watering-tasks/[taskId]', {
      error,
      requestId,
      taskId: params?.taskId,
    })
    return handleUnexpectedError(requestId)
  }
}
