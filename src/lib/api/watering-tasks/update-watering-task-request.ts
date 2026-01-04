import { z } from 'zod'

import type { UpdateWateringTaskCommand } from '../../../types'
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

const noteInputSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  })
  .refine((value) => value === undefined || value === null || value.length <= 500, {
    message: 'Note must be at most 500 characters',
  })

const UpdateWateringTaskParamsSchema = z.object({
  taskId: z.string().uuid(),
})

const UpdateWateringTaskPayloadSchema = z
  .object({
    status: z.enum(['pending', 'completed']).optional(),
    completed_on: isoDateStringSchema.optional(),
    note: noteInputSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasAnyField =
      value.status !== undefined || value.completed_on !== undefined || value.note !== undefined

    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
      })
    }

    if (value.status === 'completed' && value.completed_on === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completed_on'],
        message: 'completed_on is required when status is completed',
      })
    }

    if (value.status === 'pending' && value.completed_on !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completed_on'],
        message: 'completed_on cannot be provided when status is pending',
      })
    }
  })

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

export type UpdateWateringTaskParams = z.infer<typeof UpdateWateringTaskParamsSchema>

export const parseUpdateWateringTaskParams = (
  params: Record<string, string | undefined>,
): UpdateWateringTaskParams => {
  const parsed = UpdateWateringTaskParamsSchema.safeParse({
    taskId: params.taskId,
  })

  if (!parsed.success) {
    throw new HttpError(400, 'Invalid taskId', 'INVALID_TASK_ID')
  }

  return parsed.data
}

export const parseUpdateWateringTaskRequest = (
  body: unknown,
): UpdateWateringTaskCommand => {
  const parsed = UpdateWateringTaskPayloadSchema.safeParse(body)

  if (!parsed.success) {
    throw toValidationError('Invalid request body', parsed.error)
  }

  const sanitizedEntries = Object.entries(parsed.data).filter(
    ([, value]) => value !== undefined,
  ) as [keyof UpdateWateringTaskCommand, UpdateWateringTaskCommand[keyof UpdateWateringTaskCommand]][]

  if (sanitizedEntries.length === 0) {
    throw new HttpError(422, 'No fields to update', 'NO_FIELDS_TO_UPDATE')
  }

  return sanitizedEntries.reduce<UpdateWateringTaskCommand>((acc, [key, value]) => {
    acc[key] = value
    return acc
  }, {})
}

