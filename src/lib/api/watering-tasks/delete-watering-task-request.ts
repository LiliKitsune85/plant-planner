import { z } from 'zod'

import { HttpError } from '../../http/errors'

const DeleteWateringTaskParamsSchema = z.object({
  taskId: z.string().uuid(),
})

const DeleteWateringTaskQuerySchema = z.object({
  confirm: z.literal('true'),
})

export type DeleteWateringTaskParams = z.infer<typeof DeleteWateringTaskParamsSchema>
export type DeleteWateringTaskQuery = z.infer<typeof DeleteWateringTaskQuerySchema>
export type DeleteWateringTaskRequest = DeleteWateringTaskParams & DeleteWateringTaskQuery

export const parseDeleteWateringTaskRequest = (
  params: Record<string, string | undefined>,
  searchParams: URLSearchParams,
): DeleteWateringTaskRequest => {
  const parsedParams = DeleteWateringTaskParamsSchema.safeParse({
    taskId: params.taskId,
  })

  if (!parsedParams.success) {
    throw new HttpError(400, 'Invalid taskId', 'INVALID_TASK_ID')
  }

  const parsedQuery = DeleteWateringTaskQuerySchema.safeParse({
    confirm: searchParams.get('confirm'),
  })

  if (!parsedQuery.success) {
    throw new HttpError(400, 'Confirmation is required (confirm=true)', 'CONFIRMATION_REQUIRED')
  }

  return {
    ...parsedParams.data,
    ...parsedQuery.data,
  }
}

