import type { APIRoute } from 'astro'

import {
  parseUpdatePlantParams,
  parseUpdatePlantRequest,
} from '../../../../lib/api/plants/update-plant-request'
import { parseDeletePlantRequest } from '../../../../lib/api/plants/delete-plant-request'
import { deletePlant } from '../../../../lib/services/plants/delete-plant'
import { updatePlant } from '../../../../lib/services/plants/update-plant'
import { HttpError, isHttpError } from '../../../../lib/http/errors'
import type { PlantDetailDto } from '../../../../types'

export const prerender = false

type ApiEnvelope<TData> = {
  data: TData | null
  error: { code: string; message: string; details?: unknown } | null
  meta: Record<string, unknown>
}

const json = <TData>(status: number, envelope: ApiEnvelope<TData>): Response =>
  new Response(JSON.stringify(envelope), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get('authorization')
  if (!header) return null

  const match = /^Bearer\s+(.+)$/.exec(header)
  return match?.[1] ?? null
}

const requireUserId = async (locals: App.Locals, request: Request) => {
  const token = getBearerToken(request)
  const { data, error } = token
    ? await locals.supabase.auth.getUser(token)
    : await locals.supabase.auth.getUser()

  if (error || !data.user) {
    throw new HttpError(401, 'Unauthenticated', 'UNAUTHENTICATED')
  }

  return data.user.id
}

export const DELETE: APIRoute = async ({ locals, params, request, url }) => {
  try {
    const { plantId } = parseDeletePlantRequest(params, url.searchParams)
    const userId = await requireUserId(locals, request)

    const result = await deletePlant(locals.supabase, { plantId, userId })

    return json(200, { data: result, error: null, meta: {} })
  } catch (error) {
    if (isHttpError(error)) {
      return json(error.status, {
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
        meta: {},
      })
    }

    console.error('Unhandled error in DELETE /api/plants/[plantId]', {
      error,
      plantId: params?.plantId,
    })

    return json(500, {
      data: null,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
      meta: {},
    })
  }
}

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    const { plantId } = parseUpdatePlantParams(params)
    const userId = await requireUserId(locals, request)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'Invalid JSON body', 'INVALID_JSON')
    }

    const payload = parseUpdatePlantRequest(body)

    const result = await updatePlant(locals.supabase, {
      plantId,
      userId,
      payload,
    })

    return json<PlantDetailDto>(200, { data: result, error: null, meta: {} })
  } catch (error) {
    if (isHttpError(error)) {
      return json(error.status, {
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
        meta: {},
      })
    }

    console.error('Unhandled error in PATCH /api/plants/[plantId]', {
      error,
      plantId: params?.plantId,
    })

    return json(500, {
      data: null,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
      meta: {},
    })
  }
}
