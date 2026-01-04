import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  Database,
  Tables,
} from '../../../../db/database.types.ts'
import { HttpError } from '../../http/errors'

export type GetPlantDetailQuery = {
  plantId: string
  userId: string
}

type PlantDetailRow = Pick<
  Tables<'plants'>,
  'id' | 'species_name' | 'duplicate_index' | 'nickname' | 'description' | 'purchase_date' | 'photo_path'
>

type ActiveWateringPlanRow = Pick<
  Tables<'watering_plans'>,
  | 'id'
  | 'is_active'
  | 'valid_from'
  | 'valid_to'
  | 'interval_days'
  | 'horizon_days'
  | 'schedule_basis'
  | 'start_from'
  | 'custom_start_on'
  | 'overdue_policy'
  | 'was_ai_suggested'
  | 'was_ai_accepted_without_changes'
  | 'ai_request_id'
>

export type PlantDetailRecord = {
  plant: PlantDetailRow
  activePlan: ActiveWateringPlanRow | null
}

export const getPlantDetail = async (
  supabase: SupabaseClient<Database>,
  { plantId, userId }: GetPlantDetailQuery,
): Promise<PlantDetailRecord | null> => {
  const {
    data: plant,
    error: plantError,
  } = await supabase
    .from('plants')
    .select(
      [
        'id',
        'species_name',
        'duplicate_index',
        'nickname',
        'description',
        'purchase_date',
        'photo_path',
      ].join(','),
    )
    .eq('id', plantId)
    .eq('user_id', userId)
    .maybeSingle()

  if (plantError) {
    throw new HttpError(500, 'Failed to load plant', 'PLANT_QUERY_FAILED')
  }

  if (!plant) {
    return null
  }

  const {
    data: activePlan,
    error: planError,
  } = await supabase
    .from('watering_plans')
    .select(
      [
        'id',
        'is_active',
        'valid_from',
        'valid_to',
        'interval_days',
        'horizon_days',
        'schedule_basis',
        'start_from',
        'custom_start_on',
        'overdue_policy',
        'was_ai_suggested',
        'was_ai_accepted_without_changes',
        'ai_request_id',
      ].join(','),
    )
    .eq('plant_id', plantId)
    .eq('is_active', true)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (planError) {
    throw new HttpError(
      500,
      'Failed to load watering plan',
      'WATERING_PLAN_QUERY_FAILED',
    )
  }

  return {
    plant,
    activePlan: activePlan ?? null,
  }
}
