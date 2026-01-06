import type { SupabaseClient } from '../../../db/supabase.client'
import type { PlantDetailDto, UpdatePlantCommand } from '../../../types'
import { HttpError } from '../../http/errors'
import type { PlantDetailRecord } from './get-plant-detail'
import { getPlantDetail, mapPlantDetailRecordToDto } from './get-plant-detail'

export type UpdatePlantServiceCommand = {
  plantId: string
  userId: string
  payload: UpdatePlantCommand
}

const sanitizePayload = (payload: UpdatePlantCommand): UpdatePlantCommand =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as UpdatePlantCommand

export const updatePlant = async (
  supabase: SupabaseClient,
  { plantId, userId, payload }: UpdatePlantServiceCommand,
): Promise<PlantDetailDto> => {
  const updatePayload = sanitizePayload(payload)

  if (Object.keys(updatePayload).length === 0) {
    throw new HttpError(422, 'No fields to update', 'NO_FIELDS_TO_UPDATE')
  }

  const { data, error } = await supabase
    .from('plants')
    .update(updatePayload)
    .eq('id', plantId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('updatePlant update failed', { error, plantId, userId })
    throw new HttpError(500, 'Failed to update plant', 'PLANT_UPDATE_FAILED')
  }

  if (!data) {
    throw new HttpError(404, 'Plant not found', 'PLANT_NOT_FOUND')
  }

  const detail = await getPlantDetail(supabase, { plantId, userId })

  if (!detail) {
    throw new HttpError(404, 'Plant not found', 'PLANT_NOT_FOUND')
  }

  return mapPlantDetailRecordToDto(detail)
}
