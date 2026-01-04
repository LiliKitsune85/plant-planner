import type { SupabaseClient } from '../../../db/supabase.client'
import type { PlantDetailDto, UpdatePlantCommand } from '../../../types'
import { HttpError } from '../../http/errors'
import type { PlantDetailRecord } from './get-plant-detail'
import { getPlantDetail } from './get-plant-detail'

export type UpdatePlantServiceCommand = {
  plantId: string
  userId: string
  payload: UpdatePlantCommand
}

const buildDisplayName = (speciesName: string, duplicateIndex: number): string =>
  `${speciesName} #${duplicateIndex + 1}`

const mapRecordToDto = (record: PlantDetailRecord): PlantDetailDto => ({
  plant: {
    id: record.plant.id,
    species_name: record.plant.species_name,
    duplicate_index: record.plant.duplicate_index,
    nickname: record.plant.nickname,
    description: record.plant.description,
    purchase_date: record.plant.purchase_date,
    photo_path: record.plant.photo_path,
    display_name: buildDisplayName(record.plant.species_name, record.plant.duplicate_index),
  },
  active_watering_plan: record.activePlan
    ? {
        id: record.activePlan.id,
        is_active: record.activePlan.is_active,
        valid_from: record.activePlan.valid_from,
        valid_to: record.activePlan.valid_to,
        interval_days: record.activePlan.interval_days,
        horizon_days: record.activePlan.horizon_days,
        schedule_basis: record.activePlan.schedule_basis,
        start_from: record.activePlan.start_from,
        custom_start_on: record.activePlan.custom_start_on,
        overdue_policy: record.activePlan.overdue_policy,
        was_ai_suggested: record.activePlan.was_ai_suggested,
        was_ai_accepted_without_changes: record.activePlan.was_ai_accepted_without_changes,
        ai_request_id: record.activePlan.ai_request_id,
      }
    : null,
})

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

  return mapRecordToDto(detail)
}
