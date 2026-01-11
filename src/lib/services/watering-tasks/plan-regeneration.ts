import type { Tables } from '../../../db/database.types'
import type { SupabaseClient } from '../../../db/supabase.client'
import { HttpError } from '../../http/errors'

type WateringPlanRow = Tables<'watering_plans'>

export type WateringPlanScheduleRow = Pick<
  WateringPlanRow,
  'id' | 'plant_id' | 'interval_days' | 'horizon_days' | 'schedule_basis' | 'start_from' | 'custom_start_on'
>

type ServiceContext = {
  requestId?: string
}

const ACTIVE_PLAN_COLUMNS = [
  'id',
  'plant_id',
  'interval_days',
  'horizon_days',
  'schedule_basis',
  'start_from',
  'custom_start_on',
].join(',')

const DEFAULT_HORIZON_DAYS = 90

export const loadActivePlanForPlant = async (
  supabase: SupabaseClient,
  userId: string,
  plantId: string,
  context?: ServiceContext,
): Promise<WateringPlanScheduleRow | null> => {
  const { data, error } = await supabase
    .from('watering_plans')
    .select<WateringPlanScheduleRow>(ACTIVE_PLAN_COLUMNS)
    .eq('user_id', userId)
    .eq('plant_id', plantId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('planRegeneration: failed to load active plan', { error, userId, plantId, requestId: context?.requestId })
    throw new HttpError(500, 'Failed to load watering plan', 'ACTIVE_PLAN_LOOKUP_FAILED')
  }

  return data
}

export const regenerateTasksForPlan = async (
  supabase: SupabaseClient,
  userId: string,
  plan: WateringPlanScheduleRow,
  context?: ServiceContext,
): Promise<void> => {
  if (plan.interval_days === null || plan.interval_days === undefined || plan.schedule_basis === null) {
    console.error('planRegeneration: plan missing scheduling fields', {
      planId: plan.id,
      userId,
      requestId: context?.requestId,
    })
    throw new HttpError(500, 'Plan is missing scheduling configuration', 'PLAN_INVALID')
  }

  const payload = {
    p_user_id: userId,
    p_plant_id: plan.plant_id,
    p_plan_id: plan.id,
    p_interval_days: plan.interval_days,
    p_horizon_days: plan.horizon_days ?? DEFAULT_HORIZON_DAYS,
    p_schedule_basis: plan.schedule_basis,
    p_start_from: plan.start_from,
    p_custom_start_on: plan.custom_start_on,
  }

  const { data, error } = await supabase.rpc('regenerate_watering_tasks', payload).single()

  if (error || !data) {
    console.error('planRegeneration: task regeneration failed', {
      error,
      userId,
      planId: plan.id,
      requestId: context?.requestId,
    })
    throw new HttpError(500, 'Failed to regenerate watering tasks', 'TASK_REGENERATION_FAILED')
  }
}

