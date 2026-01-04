import type { Tables, TablesInsert } from '../../../db/database.types'
import type { SupabaseClient } from '../../../db/supabase.client'
import type {
  AdhocWateringCommand,
  AdhocWateringResultDto,
  WateringTaskSummaryFields,
} from '../../../types'
import { HttpError } from '../../http/errors'

type WateringTaskRow = Tables<'watering_tasks'>
type PlantRow = Tables<'plants'>

type ServiceContext = {
  requestId?: string
}

const WATERING_TASK_COLUMNS = [
  'id',
  'plant_id',
  'due_on',
  'status',
  'source',
  'note',
  'completed_at',
  'completed_on',
].join(',')

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
  context?: ServiceContext,
): Promise<void> => {
  const { data, error } = await supabase
    .from('plants')
    .select<Pick<PlantRow, 'id'>>('id')
    .eq('id', plantId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('createAdhocWateringTask: plant lookup failed', {
      error,
      userId,
      plantId,
      requestId: context?.requestId,
    })
    throw new HttpError(500, 'Failed to verify plant ownership', 'PLANT_LOOKUP_FAILED')
  }

  if (!data) {
    throw new HttpError(404, 'Plant not found', 'PLANT_NOT_FOUND')
  }
}

const mapRowToSummary = (row: WateringTaskRow): WateringTaskSummaryFields & Pick<WateringTaskRow, 'plant_id'> => ({
  id: row.id,
  plant_id: row.plant_id,
  due_on: row.due_on,
  status: row.status,
  source: row.source,
  note: row.note,
  completed_at: row.completed_at,
  completed_on: row.completed_on,
})

const buildInsertPayload = (
  userId: string,
  plantId: string,
  command: AdhocWateringCommand,
): TablesInsert<'watering_tasks'> => ({
  user_id: userId,
  plant_id: plantId,
  plan_id: null,
  due_on: command.completed_on,
  status: 'completed',
  source: 'adhoc',
  note: command.note ?? null,
  completed_at: new Date().toISOString(),
  completed_on: command.completed_on,
})

type CreateAdhocWateringTaskParams = {
  userId: string
  plantId: string
  command: AdhocWateringCommand
  context?: ServiceContext
}

export const createAdhocWateringTask = async (
  supabase: SupabaseClient,
  { userId, plantId, command, context }: CreateAdhocWateringTaskParams,
): Promise<AdhocWateringResultDto> => {
  await ensurePlantOwnership(supabase, userId, plantId, context)

  const payload = buildInsertPayload(userId, plantId, command)
  const {
    data,
    error,
  } = await supabase
    .from('watering_tasks')
    .insert(payload)
    .select<WateringTaskRow>(WATERING_TASK_COLUMNS)
    .single()

  if (error || !data) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, 'Watering task already exists for this day', 'TASK_ALREADY_EXISTS')
    }

    console.error('createAdhocWateringTask: insert failed', {
      error,
      userId,
      plantId,
      completed_on: command.completed_on,
      requestId: context?.requestId,
    })
    throw new HttpError(500, 'Failed to create watering task', 'TASK_INSERT_FAILED')
  }

  return {
    task: mapRowToSummary(data),
  }
}

