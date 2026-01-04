import type { APIRoute } from 'astro'

import type {
  PaginatedListDto,
  WateringPlanHistoryItemDto,
} from '../../../../types'
import {
  parsePlantIdParams,
  requireAuthUser,
} from '../../../../lib/api/plants/get-plant-detail-request'
import { parseWateringPlanHistoryQuery } from '../../../../lib/api/plants/get-watering-plan-history-request'
import { listWateringPlans } from '../../../../lib/services/watering-plans/list-watering-plans'
import { HttpError, isHttpError } from '../../../../lib/http/errors'

export const prerender = false

type WateringPlanHistoryListDto = PaginatedListDto<WateringPlanHistoryItemDto>

type MetaDto = {
  next_cursor: string | null
}

type ApiEnvelope<TData> = {
  data: TData | null
  error: { code: string; message: string; details?: unknown } | null
  meta: MetaDto
}

const json = <TData>(status: number, envelope: ApiEnvelope<TData>): Response =>
  new Response(JSON.stringify(envelope), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

export const GET: APIRoute = async ({ locals, params, url }) => {
  try {
    const user = await requireAuthUser(locals)
    const { plantId } = parsePlantIdParams(params)
    const filters = parseWateringPlanHistoryQuery(url.searchParams)

    const result = await listWateringPlans(locals.supabase, {
      userId: user.id,
      plantId,
      ...filters,
    })

    const data: WateringPlanHistoryListDto = { items: result.items }

    return json(200, {
      data,
      error: null,
      meta: { next_cursor: result.nextCursor },
    })
  } catch (error) {
    if (isHttpError(error)) {
      return json(error.status, {
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
        meta: { next_cursor: null },
      })
    }

    console.error('Unhandled error in GET /api/plants/[plantId]/watering-plans', {
      error,
      plantId: params?.plantId,
    })

    return json(500, {
      data: null,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
      meta: { next_cursor: null },
    })
  }
}
