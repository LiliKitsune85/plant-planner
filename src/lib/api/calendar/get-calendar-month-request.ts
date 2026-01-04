import { z } from 'zod'

import { HttpError } from '../../http/errors'
import type { GetCalendarMonthFilters } from '../../services/calendar/types'

const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/

const getCalendarMonthQuerySchema = z.object({
  month: z
    .string()
    .trim()
    .regex(monthRegex, { message: 'month must be in YYYY-MM format' }),
  status: z.enum(['pending', 'completed', 'all']).optional().default('pending'),
})

const buildValidationDetails = (error: z.ZodError): Record<string, string[]> => {
  const details: Record<string, string[]> = {}
  const flattened = error.flatten().fieldErrors
  for (const [field, messages] of Object.entries(flattened)) {
    if (!messages || messages.length === 0) continue
    details[field] = messages.filter((message): message is string => Boolean(message))
  }
  return details
}

export type CalendarMonthRequestParams = GetCalendarMonthFilters

export const parseGetCalendarMonthQuery = (
  searchParams: URLSearchParams,
): CalendarMonthRequestParams => {
  const parsed = getCalendarMonthQuerySchema.safeParse({
    month: searchParams.get('month'),
    status: searchParams.get('status') ?? undefined,
  })

  if (!parsed.success) {
    throw new HttpError(400, 'Invalid query parameters', 'VALIDATION_ERROR', {
      fields: buildValidationDetails(parsed.error),
    })
  }

  return parsed.data
}

