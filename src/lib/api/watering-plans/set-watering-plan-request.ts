import { z } from 'zod'

import type { SetWateringPlanCommand } from '../../../types'
import { HttpError } from '../../http/errors'

const isValidIsoDate = (value: string): boolean => {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.toISOString().slice(0, 10) === value
}

const isoDateStringSchema = z
  .string()
  .trim()
  .refine(isValidIsoDate, { message: 'Invalid ISO date (expected YYYY-MM-DD)' })

const manualSourceSchema = z
  .object({
    type: z.literal('manual'),
    ai_request_id: z.null().optional().default(null),
  })
  .strict()

const aiSourceSchema = z
  .object({
    type: z.literal('ai'),
    ai_request_id: z.string().uuid(),
    accepted_without_changes: z.boolean(),
  })
  .strict()

const wateringPlanSourceSchema = z.discriminatedUnion('type', [aiSourceSchema, manualSourceSchema])

const ensureManualSourceFallback = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  const record = payload as Record<string, unknown>
  if ('source' in record && record.source !== undefined && record.source !== null) {
    return payload
  }

  return {
    ...record,
    source: { type: 'manual' as const },
  }
}

const customStartOnSchema = z
  .union([isoDateStringSchema, z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return null
    return value
  })

export const SetWateringPlanPayloadSchema: z.ZodType<SetWateringPlanCommand> = z
  .object({
    interval_days: z.number().int().min(1).max(365),
    horizon_days: z.number().int().min(1).max(365).optional().default(90),
    schedule_basis: z.enum(['due_on', 'completed_on']),
    start_from: z.enum(['today', 'purchase_date', 'custom_date']),
    custom_start_on: customStartOnSchema,
    overdue_policy: z.enum(['carry_forward', 'reschedule']),
    source: wateringPlanSourceSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.start_from === 'custom_date' && !value.custom_start_on) {
      ctx.addIssue({
        path: ['custom_start_on'],
        code: z.ZodIssueCode.custom,
        message: 'custom_start_on is required when start_from is custom_date',
      })
    }

    if (value.start_from !== 'custom_date' && value.custom_start_on !== null) {
      ctx.addIssue({
        path: ['custom_start_on'],
        code: z.ZodIssueCode.custom,
        message: 'custom_start_on must be null unless start_from is custom_date',
      })
    }
  })

const setWateringPlanParamsSchema = z.object({
  plantId: z.string().uuid(),
})

export type SetWateringPlanParams = z.infer<typeof setWateringPlanParamsSchema>

type ValidationIssue = {
  path: string
  message: string
  code: string
}

const formatZodIssues = (issues: z.ZodIssue[]): ValidationIssue[] =>
  issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(body)',
    message: issue.message,
    code: issue.code,
  }))

const toValidationError = (message: string, error: z.ZodError) =>
  new HttpError(422, message, 'VALIDATION_ERROR', { issues: formatZodIssues(error.issues) })

export const parseSetWateringPlanParams = (
  params: Record<string, string | undefined>,
): SetWateringPlanParams => {
  const parsed = setWateringPlanParamsSchema.safeParse({
    plantId: params.plantId,
  })

  if (!parsed.success) {
    throw toValidationError('Invalid plantId', parsed.error)
  }

  return parsed.data
}

export const parseSetWateringPlanRequest = (body: unknown): SetWateringPlanCommand => {
  const normalizedBody = ensureManualSourceFallback(body)
  const parsed = SetWateringPlanPayloadSchema.safeParse(normalizedBody)

  if (!parsed.success) {
    throw toValidationError('Invalid request body', parsed.error)
  }

  return parsed.data
}
