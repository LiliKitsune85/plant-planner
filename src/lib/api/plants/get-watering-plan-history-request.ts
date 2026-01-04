import { z } from 'zod'

import { HttpError } from '../../http/errors'
import { decodeWateringPlanHistoryCursor } from '../../services/watering-plans/cursor'
import type { WateringPlanHistoryFilters } from '../../services/watering-plans/types'

const MAX_CURSOR_LENGTH = 256
const DEFAULT_LIMIT = 20
const MIN_LIMIT = 1
const MAX_LIMIT = 50

const querySchema = z.object({
  active_only: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value === 'true' || value === 'false', {
      message: 'active_only must be true or false',
    })
    .optional(),
  sort: z.literal('valid_from').optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(MIN_LIMIT).max(MAX_LIMIT).optional(),
  cursor: z
    .string()
    .trim()
    .min(1)
    .max(MAX_CURSOR_LENGTH)
    .optional(),
})

export const parseWateringPlanHistoryQuery = (
  searchParams: URLSearchParams,
): WateringPlanHistoryFilters => {
  const parsed = querySchema.safeParse({
    active_only: searchParams.get('active_only') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    order: searchParams.get('order') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
  })

  if (!parsed.success) {
    throw new HttpError(400, 'Invalid query parameters', 'INVALID_QUERY_PARAMS')
  }

  const { active_only, sort, order, limit, cursor } = parsed.data

  return {
    activeOnly: active_only === 'true',
    sort: sort ?? 'valid_from',
    order: order ?? 'desc',
    limit: limit ?? DEFAULT_LIMIT,
    cursor: cursor ? decodeWateringPlanHistoryCursor(cursor) : null,
  }
}
