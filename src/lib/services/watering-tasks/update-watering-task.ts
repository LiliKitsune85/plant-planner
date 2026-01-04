import type { Tables } from '../../../db/database.types'
import type { SupabaseClient } from '../../../db/supabase.client'
import type {
  ScheduleEffectDto,
  UpdateWateringTaskCommand,
  UpdateWateringTaskResultDto,
  WateringTaskSummaryFields,
} from '../../../types'
import { HttpError } from '../../http/errors'

type WateringTaskRow = Tables<'watering_tasks'>
type WateringPlanRow = Tables<'watering_plans'>

type ServiceContext = {
  requestId?: string
}

type UpdateWateringTaskParams = {
  userId: string
  taskId: string
  command: UpdateWateringTaskCommand
  context?: ServiceContext
}

type RegenerationReason = 'TASK_COMPLETED' | 'TASK_UNDONE' | 'COMPLETION_DATE_CHANGED'

const WATERING_TASK_COLUMNS = [
  'id',
  'plant_id',
  'plan_id',
  'due_on',
  'status',
  'source',
  'note',
  'completed_at',
  'completed_on',
].join(',')

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

const isPostgresError = (error: unknown, code: string): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === code,
  )

const mapTaskToSummary = (row: WateringTaskRow): WateringTaskSummaryFields => ({
  id: row.id,
  due_on: row.due_on,
  status: row.status,
  source: row.source,
  note: row.note,
  completed_at: row.completed_at,
  completed_on: row.completed_on,
})

const loadTask = async (
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  context?: ServiceContext,
): Promise<WateringTaskRow> => {
  const { data, error } = await supabase
    .from('watering_tasks')
    .select<WateringTaskRow>(WATERING_TASK_COLUMNS)
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('updateWateringTask: task lookup failed', { error, userId, taskId, context })
    throw new HttpError(500, 'Failed to load watering task', 'TASK_LOOKUP_FAILED')
  }

  if (!data) {
    throw new HttpError(404, 'Watering task not found', 'WATERING_TASK_NOT_FOUND')
  }

  return data
}

const loadActivePlan = async (
  supabase: SupabaseClient,
  userId: string,
  plantId: string,
  context: ServiceContext | undefined,
): Promise<WateringPlanRow | null> => {
  const { data, error } = await supabase
    .from('watering_plans')
    .select<WateringPlanRow>(ACTIVE_PLAN_COLUMNS)
    .eq('user_id', userId)
    .eq('plant_id', plantId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('updateWateringTask: active plan lookup failed', {
      error,
      userId,
      plantId,
      context,
    })
    throw new HttpError(500, 'Failed to load watering plan', 'ACTIVE_PLAN_LOOKUP_FAILED')
  }

  return data
}

const triggerTaskRegeneration = async (
  supabase: SupabaseClient,
  userId: string,
  plan: WateringPlanRow,
  context: ServiceContext | undefined,
  taskId: string,
): Promise<void> => {
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

  if (
    payload.p_interval_days === null ||
    payload.p_interval_days === undefined ||
    payload.p_schedule_basis === null
  ) {
    console.error('updateWateringTask: plan missing required scheduling fields', {
      planId: plan.id,
      userId,
      taskId,
      context,
    })
    throw new HttpError(500, 'Plan is missing scheduling configuration', 'PLAN_INVALID')
  }

  const { data, error } = await supabase.rpc('regenerate_watering_tasks', payload).single()

  if (error || !data) {
    console.error('updateWateringTask: task regeneration failed', {
      error,
      userId,
      taskId,
      planId: plan.id,
      context,
    })
    throw new HttpError(500, 'Failed to regenerate watering tasks', 'TASK_REGENERATION_FAILED')
  }
}

export const updateWateringTask = async (
  supabase: SupabaseClient,
  { userId, taskId, command, context }: UpdateWateringTaskParams,
): Promise<UpdateWateringTaskResultDto> => {
  const task = await loadTask(supabase, userId, taskId, context)

  const nextStatus = command.status ?? task.status
  const completedOnInput = command.completed_on
  let nextCompletedOn =
    completedOnInput !== undefined ? completedOnInput : task.completed_on

  if (task.source === 'adhoc' && nextStatus !== 'completed') {
    throw new HttpError(
      409,
      'Adhoc tasks must remain completed',
      'CONSTRAINT_VIOLATION',
    )
  }

  if (completedOnInput !== undefined && nextStatus !== 'completed') {
    throw new HttpError(
      422,
      'completed_on can only be provided for completed tasks',
      'VALIDATION_ERROR',
    )
  }

  if (nextStatus === 'pending') {
    nextCompletedOn = null
  }

  if (nextStatus === 'completed' && !nextCompletedOn) {
    throw new HttpError(
      422,
      'completed_on is required when status is completed',
      'VALIDATION_ERROR',
    )
  }

  if (task.source === 'scheduled' && !task.plan_id) {
    throw new HttpError(
      409,
      'Scheduled task is missing an associated plan',
      'CONSTRAINT_VIOLATION',
    )
  }

  const statusChanged = task.status !== nextStatus
  const completedOnChanged =
    nextStatus === 'completed' &&
    completedOnInput !== undefined &&
    nextCompletedOn !== task.completed_on

  let regenerationReason: RegenerationReason | null = null
  if (task.source === 'scheduled') {
    if (statusChanged && nextStatus === 'completed') {
      regenerationReason = 'TASK_COMPLETED'
    } else if (statusChanged && nextStatus === 'pending') {
      regenerationReason = 'TASK_UNDONE'
    } else if (completedOnChanged) {
      regenerationReason = 'COMPLETION_DATE_CHANGED'
    }
  }

  const updatePayload: Partial<WateringTaskRow> = {}
  const nowIso = new Date().toISOString()

  if (statusChanged) {
    updatePayload.status = nextStatus
  }

  if (command.note !== undefined) {
    updatePayload.note = command.note
  }

  if (nextStatus === 'pending') {
    updatePayload.completed_on = null
    updatePayload.completed_at = null
  } else if (statusChanged && nextStatus === 'completed') {
    updatePayload.completed_on = nextCompletedOn
    updatePayload.completed_at = nowIso
  } else if (completedOnChanged) {
    updatePayload.completed_on = nextCompletedOn
  }

  if (task.source === 'adhoc' && updatePayload.completed_on !== undefined) {
    updatePayload.due_on = nextCompletedOn
  }

  updatePayload.updated_at = nowIso

  const {
    data: updatedTask,
    error: updateError,
  } = await supabase
    .from('watering_tasks')
    .update(updatePayload)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select<WateringTaskRow>(WATERING_TASK_COLUMNS)
    .single()

  if (updateError || !updatedTask) {
    if (isPostgresError(updateError, '23505') || isPostgresError(updateError, '23514')) {
      throw new HttpError(
        409,
        'Update violates task constraints',
        'CONSTRAINT_VIOLATION',
      )
    }

    console.error('updateWateringTask: update failed', {
      error: updateError,
      userId,
      taskId,
      requestId: context?.requestId,
    })
    throw new HttpError(500, 'Failed to update watering task', 'UPDATE_WATERING_TASK_FAILED')
  }

  let scheduleEffect: ScheduleEffectDto = {
    tasks_regenerated: false,
    reason: null,
  }

  if (regenerationReason) {
    const plan = await loadActivePlan(supabase, userId, task.plant_id, context)

    if (!plan) {
      throw new HttpError(409, 'Active watering plan not found for plant', 'WATERING_PLAN_NOT_FOUND')
    }

    if (plan.schedule_basis === 'completed_on') {
      await triggerTaskRegeneration(supabase, userId, plan, context, taskId)
      scheduleEffect = {
        tasks_regenerated: true,
        reason: regenerationReason,
      }
    }
  }

  return {
    task: mapTaskToSummary(updatedTask),
    schedule_effect: scheduleEffect,
  }
}

