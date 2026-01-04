import type { Tables } from '../../../db/database.types'
import type { SupabaseClient } from '../../../db/supabase.client'
import type { DeleteWateringTaskResultDto } from '../../../types'
import { HttpError } from '../../http/errors'

type WateringTaskRow = Tables<'watering_tasks'>

type WateringTaskDeletionTarget = Pick<
  WateringTaskRow,
  'id' | 'plant_id' | 'plan_id' | 'source' | 'status'
>

export type DeleteWateringTaskCommand = {
  userId: string
  taskId: string
}

const WATERING_TASK_LOOKUP_COLUMNS = ['id', 'plant_id', 'plan_id', 'source', 'status'].join(',')

const loadTask = async (
  supabase: SupabaseClient,
  { userId, taskId }: DeleteWateringTaskCommand,
): Promise<WateringTaskDeletionTarget> => {
  const { data, error } = await supabase
    .from('watering_tasks')
    .select<WateringTaskDeletionTarget>(WATERING_TASK_LOOKUP_COLUMNS)
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('deleteWateringTask: failed to load task', { error, userId, taskId })
    throw new HttpError(500, 'Failed to load watering task', 'TASK_LOOKUP_FAILED')
  }

  if (!data) {
    throw new HttpError(404, 'Watering task not found', 'TASK_NOT_FOUND')
  }

  return data
}

const deleteAdhocTask = async (
  supabase: SupabaseClient,
  { userId, taskId }: DeleteWateringTaskCommand,
): Promise<void> => {
  const { data, error } = await supabase
    .from('watering_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('deleteWateringTask: failed to delete adhoc task', { error, userId, taskId })
    throw new HttpError(500, 'Failed to delete watering task', 'TASK_DELETE_FAILED')
  }

  if (!data) {
    throw new HttpError(404, 'Watering task not found', 'TASK_NOT_FOUND')
  }
}

const resetScheduledTask = async (
  supabase: SupabaseClient,
  { userId, taskId }: DeleteWateringTaskCommand,
): Promise<void> => {
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('watering_tasks')
    .update({
      status: 'pending',
      completed_at: null,
      completed_on: null,
      note: null,
      updated_at: nowIso,
    })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('deleteWateringTask: failed to reset scheduled task', { error, userId, taskId })
    throw new HttpError(500, 'Failed to reset scheduled watering task', 'TASK_RESET_FAILED')
  }

  if (!data) {
    throw new HttpError(404, 'Watering task not found', 'TASK_NOT_FOUND')
  }
}

export const deleteWateringTask = async (
  supabase: SupabaseClient,
  command: DeleteWateringTaskCommand,
): Promise<DeleteWateringTaskResultDto> => {
  const task = await loadTask(supabase, command)

  if (task.source === 'adhoc') {
    await deleteAdhocTask(supabase, command)
  } else if (task.source === 'scheduled') {
    if (task.status !== 'completed') {
      throw new HttpError(
        409,
        'Only completed scheduled tasks can be undone',
        'NOT_ALLOWED',
      )
    }

    if (!task.plan_id) {
      console.error('deleteWateringTask: scheduled task missing plan reference', {
        taskId: task.id,
        userId: command.userId,
      })
      throw new HttpError(500, 'Scheduled task is missing plan reference', 'TASK_INVALID_STATE')
    }

    await resetScheduledTask(supabase, command)
  } else {
    console.error('deleteWateringTask: unsupported task source', {
      source: task.source,
      taskId: task.id,
      userId: command.userId,
    })
    throw new HttpError(500, 'Watering task has unsupported source', 'TASK_INVALID_STATE')
  }

  return {
    deleted: true,
    task_id: command.taskId,
  }
}

