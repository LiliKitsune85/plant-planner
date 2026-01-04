import type { Tables } from '../../../db/database.types'
import type { SupabaseClient } from '../../../db/supabase.client'
import type {
  SetWateringPlanCommand,
  SetWateringPlanResultDto,
  TasksRegeneratedSummary,
  WateringPlanSummaryDto,
} from '../../../types'
import { HttpError } from '../../http/errors'

type WateringPlanRow = Tables<'watering_plans'>

type SetPlanRpcArgs = {
  p_user_id: string
  p_plant_id: string
  p_interval_days: number
  p_horizon_days: number
  p_schedule_basis: WateringPlanRow['schedule_basis']
  p_start_from: WateringPlanRow['start_from']
  p_custom_start_on: WateringPlanRow['custom_start_on']
  p_overdue_policy: WateringPlanRow['overdue_policy']
  p_was_ai_suggested: boolean
  p_was_ai_accepted_without_changes: boolean | null
  p_ai_request_id: string | null
}

type RegenerateTasksRpcArgs = {
  p_user_id: string
  p_plant_id: string
  p_plan_id: string
  p_interval_days: number
  p_horizon_days: number
  p_schedule_basis: WateringPlanRow['schedule_basis']
  p_start_from: WateringPlanRow['start_from']
  p_custom_start_on: WateringPlanRow['custom_start_on']
}

type RegenerateTasksRpcRow = {
  from_date: string | null
  to_date: string | null
  task_count: number
}

const DEFAULT_HORIZON_DAYS = 90

const mapPlanToSummary = (plan: WateringPlanRow): WateringPlanSummaryDto => ({
  id: plan.id,
  is_active: plan.is_active,
  valid_from: plan.valid_from,
  valid_to: plan.valid_to,
  interval_days: plan.interval_days,
  horizon_days: plan.horizon_days,
  schedule_basis: plan.schedule_basis,
  start_from: plan.start_from,
  custom_start_on: plan.custom_start_on,
  overdue_policy: plan.overdue_policy,
  was_ai_suggested: plan.was_ai_suggested,
  was_ai_accepted_without_changes: plan.was_ai_accepted_without_changes,
  ai_request_id: plan.ai_request_id,
})

const mapRegenerateResult = (row: RegenerateTasksRpcRow): TasksRegeneratedSummary => {
  if (!row.from_date || !row.to_date) {
    throw new HttpError(500, 'Task regeneration returned invalid range', 'TASK_REGENERATION_INVALID')
  }

  return {
    from: row.from_date,
    to: row.to_date,
    count: row.task_count,
  }
}

const isUniqueViolation = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === '23505',
  )

const ensurePlantOwnership = async (
  supabase: SupabaseClient,
  userId: string,
  plantId: string,
): Promise<void> => {
  const { data, error } = await supabase
    .from('plants')
    .select('id')
    .eq('id', plantId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('setPlantWateringPlan: plant lookup failed', { error, userId, plantId })
    throw new HttpError(500, 'Failed to verify plant ownership', 'PLANT_LOOKUP_FAILED')
  }

  if (!data) {
    throw new HttpError(404, 'Plant not found', 'PLANT_NOT_FOUND')
  }
}

const ensureAiRequestOwnership = async (
  supabase: SupabaseClient,
  userId: string,
  aiRequestId: string,
): Promise<void> => {
  const { data, error } = await supabase
    .from('ai_requests')
    .select('id')
    .eq('id', aiRequestId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('setPlantWateringPlan: ai request lookup failed', { error, userId, aiRequestId })
    throw new HttpError(500, 'Failed to verify AI suggestion ownership', 'AI_REQUEST_LOOKUP_FAILED')
  }

  if (!data) {
    throw new HttpError(404, 'AI suggestion not found', 'AI_REQUEST_NOT_FOUND')
  }
}

const buildSetPlanPayload = (
  plantId: string,
  userId: string,
  command: SetWateringPlanCommand,
): SetPlanRpcArgs => {
  const isAiSource = command.source.type === 'ai'

  return {
    p_user_id: userId,
    p_plant_id: plantId,
    p_interval_days: command.interval_days,
    p_horizon_days: command.horizon_days ?? DEFAULT_HORIZON_DAYS,
    p_schedule_basis: command.schedule_basis,
    p_start_from: command.start_from,
    p_custom_start_on: command.custom_start_on,
    p_overdue_policy: command.overdue_policy,
    p_was_ai_suggested: isAiSource,
    p_was_ai_accepted_without_changes: isAiSource
      ? command.source.accepted_without_changes
      : null,
    p_ai_request_id: isAiSource ? command.source.ai_request_id : null,
  }
}

const buildRegeneratePayload = (
  plan: WateringPlanRow,
  userId: string,
): RegenerateTasksRpcArgs => ({
  p_user_id: userId,
  p_plant_id: plan.plant_id,
  p_plan_id: plan.id,
  p_interval_days: plan.interval_days,
  p_horizon_days: plan.horizon_days,
  p_schedule_basis: plan.schedule_basis,
  p_start_from: plan.start_from,
  p_custom_start_on: plan.custom_start_on,
})

type SetPlantWateringPlanParams = {
  userId: string
  plantId: string
  command: SetWateringPlanCommand
}

export const setPlantWateringPlan = async (
  supabase: SupabaseClient,
  { userId, plantId, command }: SetPlantWateringPlanParams,
): Promise<SetWateringPlanResultDto> => {
  await ensurePlantOwnership(supabase, userId, plantId)

  if (command.source.type === 'ai') {
    await ensureAiRequestOwnership(supabase, userId, command.source.ai_request_id)
  }

  const rpcPayload = buildSetPlanPayload(plantId, userId, command)
  const {
    data: planRow,
    error: setPlanError,
  } = await supabase.rpc('set_watering_plan_version', rpcPayload).single()

  if (setPlanError || !planRow) {
    if (isUniqueViolation(setPlanError)) {
      throw new HttpError(409, 'Active plan was updated concurrently', 'PLAN_CONFLICT')
    }

    console.error('setPlantWateringPlan: plan RPC failed', {
      error: setPlanError,
      userId,
      plantId,
    })
    throw new HttpError(500, 'Failed to set watering plan', 'SET_WATERING_PLAN_FAILED')
  }

  const regeneratePayload = buildRegeneratePayload(planRow, userId)
  const {
    data: regenerateRow,
    error: regenerateError,
  } = await supabase.rpc('regenerate_watering_tasks', regeneratePayload).single()

  if (regenerateError || !regenerateRow) {
    console.error('setPlantWateringPlan: task regeneration failed', {
      error: regenerateError,
      userId,
      plantId,
      planId: planRow.id,
    })
    throw new HttpError(500, 'Failed to regenerate watering tasks', 'TASK_REGENERATION_FAILED')
  }

  return {
    plan: mapPlanToSummary(planRow),
    tasks_regenerated: mapRegenerateResult(regenerateRow),
  }
}
