import type { Tables } from '../../../db/database.types'
import type { SupabaseClient } from '../../../db/supabase.client'
import type { WateringTaskListItemDto } from '../../../types'
import { HttpError } from '../../http/errors'
import {
  buildListWateringTasksCursorFiltersSnapshot,
  decodeListWateringTasksCursor,
  encodeListWateringTasksCursor,
} from './list-watering-tasks-cursor'
import type {
  GetWateringTasksQuery,
  ListWateringTasksCursorPayload,
  ListWateringTasksResult,
  ListWateringTasksServiceContext,
  WateringTaskSortField,
} from './types'

type WateringTaskListRow = Pick<
  Tables<'watering_tasks'>,
  | 'id'
  | 'plant_id'
  | 'plan_id'
  | 'due_on'
  | 'status'
  | 'source'
  | 'note'
  | 'completed_at'
  | 'completed_on'
  | 'created_at'
  | 'updated_at'
>

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
  'created_at',
  'updated_at',
].join(',')

const escapeLogicalValue = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

const getSortValue = (row: WateringTaskListRow, sort: WateringTaskSortField): string =>
  row[sort] ?? ''

const mapRowToDto = (row: WateringTaskListRow): WateringTaskListItemDto => ({
  id: row.id,
  plant_id: row.plant_id,
  plan_id: row.plan_id,
  due_on: row.due_on,
  status: row.status,
  source: row.source,
  note: row.note,
  completed_at: row.completed_at,
  completed_on: row.completed_on,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const buildCursorFilter = (payload: ListWateringTasksCursorPayload): string => {
  const operator = payload.order === 'asc' ? 'gt' : 'lt'
  const sortValue = escapeLogicalValue(payload.sortValue)
  const recordId = escapeLogicalValue(payload.id)

  return `${payload.sort}.${operator}.${sortValue},and(${payload.sort}.eq.${sortValue},id.${operator}.${recordId})`
}

export const listWateringTasks = async (
  supabase: SupabaseClient,
  query: GetWateringTasksQuery,
  context?: ListWateringTasksServiceContext,
): Promise<ListWateringTasksResult> => {
  const { userId, from, to, plantId, status, source, sort, order, limit, cursor } = query
  const filtersSnapshot = buildListWateringTasksCursorFiltersSnapshot(query)

  let request = supabase
    .from('watering_tasks')
    .select<WateringTaskListRow>(WATERING_TASK_COLUMNS)
    .eq('user_id', userId)

  if (from) {
    request = request.gte('due_on', from)
  }

  if (to) {
    request = request.lte('due_on', to)
  }

  if (plantId) {
    request = request.eq('plant_id', plantId)
  }

  if (status) {
    request = request.eq('status', status)
  }

  if (source) {
    request = request.eq('source', source)
  }

  if (cursor) {
    const payload = decodeListWateringTasksCursor(cursor, {
      userId,
      sort,
      order,
      filters: filtersSnapshot,
    })
    request = request.or(buildCursorFilter(payload))
  }

  request = request
    .order(sort, { ascending: order === 'asc' })
    .order('id', { ascending: order === 'asc' })
    .limit(limit + 1)

  const { data, error } = await request

  if (error || !data) {
    console.error('listWateringTasks query failed', {
      error,
      userId,
      filters: {
        from,
        to,
        plantId,
        status,
        source,
        limit,
      },
      sort,
      order,
      requestId: context?.requestId,
    })
    throw new HttpError(500, 'Failed to list watering tasks', 'WATERING_TASKS_QUERY_FAILED')
  }

  const hasNext = data.length > limit
  const items = hasNext ? data.slice(0, limit) : data
  const dtoItems = items.map(mapRowToDto)
  const lastItem = items[items.length - 1]

  const nextCursor =
    hasNext && lastItem
      ? encodeListWateringTasksCursor({
          userId,
          sort,
          order,
          sortValue: getSortValue(lastItem, sort),
          id: lastItem.id,
          filters: filtersSnapshot,
        })
      : null

  return {
    items: dtoItems,
    nextCursor,
  }
}

