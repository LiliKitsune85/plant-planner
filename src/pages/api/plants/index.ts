import type { APIRoute } from 'astro'

import type { PlantListDto } from '../../../types'
import { parseListPlantsRequest } from '../../../lib/api/plants/get-plants-request'
import { HttpError, isHttpError } from '../../../lib/http/errors'
import { listPlants } from '../../../lib/services/plants/list-plants'
import { decodeListPlantsCursor } from '../../../lib/services/plants/list-plants-cursor'

export const prerender = false

type ApiEnvelope<TData> = {
  data: TData | null
  error: { code: string; message: string } | null
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

export const GET: APIRoute = async ({ locals, request, url }) => {
  try {
    const query = parseListPlantsRequest(url.searchParams)
    const userId = await requireUserId(locals, request)

    if (query.cursor) {
      decodeListPlantsCursor(query.cursor, {
        userId,
        sort: query.sort,
        order: query.order,
      })
    }

    const result = await listPlants(locals.supabase, { userId, query })
    const data: PlantListDto = { items: result.items }

    return json(200, {
      data,
      error: null,
      meta: { next_cursor: result.nextCursor },
    })
  } catch (error) {
    if (isHttpError(error)) {
      return json(error.status, {
        data: null,
        error: { code: error.code, message: error.message },
        meta: {},
      })
    }

    console.error('Unhandled error in GET /api/plants', { error })

    return json(500, {
      data: null,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
      meta: {},
    })
  }
}
import type { APIRoute } from 'astro'

import { parseCreatePlantRequest } from '../../../lib/api/plants/create-plant-request'
import { HttpError, isHttpError } from '../../../lib/http/errors'
import { createPlant } from '../../../lib/services/plants/create-plant'
import type { CreatePlantResultDto, WateringSuggestionForCreationDto } from '../../../types'

export const prerender = false

type ApiEnvelope<TData> = {
  data: TData | null
  error: { code: string; message: string } | null
  meta: Record<string, unknown>
}

const json = <TData>(
  status: number,
  envelope: ApiEnvelope<TData>,
  headers?: HeadersInit,
): Response =>
  new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
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

export const POST: APIRoute = async ({ locals, request, url }) => {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'Invalid JSON body', 'INVALID_JSON')
    }

    const command = parseCreatePlantRequest(body)
    const userId = await requireUserId(locals, request)

    const plant = await createPlant(locals.supabase, { userId, plant: command })

    const watering_suggestion: WateringSuggestionForCreationDto = {
      status: 'skipped',
      ai_request_id: null,
      explanation: command.generate_watering_suggestion
        ? 'Watering suggestion is not implemented yet'
        : null,
    }

    const result: CreatePlantResultDto = { plant, watering_suggestion }

    return json(201, { data: result, error: null, meta: {} }, {
      'Cache-Control': 'no-store',
      Location: new URL(`/api/plants/${plant.id}`, url).toString(),
    })
  } catch (error) {
    if (isHttpError(error)) {
      return json(error.status, {
        data: null,
        error: { code: error.code, message: error.message },
        meta: {},
      }, { 'Cache-Control': 'no-store' })
    }

    console.error('Unhandled error in POST /api/plants', { error })

    return json(
      500,
      {
        data: null,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
        meta: {},
      },
      { 'Cache-Control': 'no-store' },
    )
  }
}

