import { z } from 'zod'

import { HttpError } from '../../http/errors'

const deletePlantParamsSchema = z.object({
  plantId: z.string().uuid(),
})

const deletePlantQuerySchema = z.object({
  // Safety confirmation against accidental deletes.
  confirm: z.literal('true'),
})

export type DeletePlantParams = z.infer<typeof deletePlantParamsSchema>
export type DeletePlantQuery = z.infer<typeof deletePlantQuerySchema>

export type DeletePlantRequest = DeletePlantParams & DeletePlantQuery

export const parseDeletePlantRequest = (
  params: Record<string, string | undefined>,
  searchParams: URLSearchParams,
): DeletePlantRequest => {
  const parsedParams = deletePlantParamsSchema.safeParse({
    plantId: params.plantId,
  })

  if (!parsedParams.success) {
    throw new HttpError(400, 'Invalid plantId', 'INVALID_PLANT_ID')
  }

  const parsedQuery = deletePlantQuerySchema.safeParse({
    confirm: searchParams.get('confirm'),
  })

  if (!parsedQuery.success) {
    throw new HttpError(
      400,
      'Confirmation required (confirm=true)',
      'CONFIRMATION_REQUIRED',
    )
  }

  return {
    ...parsedParams.data,
    ...parsedQuery.data,
  }
}
