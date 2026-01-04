import type { SupabaseClient } from '../../../db/supabase.client'
import type { PlantListItemDto } from '../../../types'
import { HttpError } from '../../http/errors'
import { decodeListPlantsCursor, encodeListPlantsCursor } from './list-plants-cursor'
import type {
  ListPlantsCommand,
  ListPlantsCursorPayload,
  ListPlantsResult,
  PlantListRow,
  PlantSortField,
} from './types'

const PLANT_LIST_COLUMNS = [
  'id',
  'species_name',
  'species_name_normalized',
  'duplicate_index',
  'nickname',
  'description',
  'purchase_date',
  'photo_path',
  'created_source',
  'created_at',
  'updated_at',
].join(',')

const escapeLogicalValue = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

const escapeIlikePattern = (value: string): string =>
  value.replace(/[*]/g, '\\*')

const buildDisplayName = (speciesName: string, duplicateIndex: number): string =>
  `${speciesName} #${duplicateIndex + 1}`

const mapRowToDto = (row: PlantListRow): PlantListItemDto => ({
  id: row.id,
  species_name: row.species_name,
  duplicate_index: row.duplicate_index,
  nickname: row.nickname,
  description: row.description,
  purchase_date: row.purchase_date,
  photo_path: row.photo_path,
  created_source: row.created_source,
  created_at: row.created_at,
  updated_at: row.updated_at,
  display_name: buildDisplayName(row.species_name, row.duplicate_index),
})

const getSortValue = (row: PlantListRow, sort: PlantSortField): string =>
  row[sort] ?? ''

const buildCursorFilter = (
  payload: ListPlantsCursorPayload,
  sort: PlantSortField,
): string => {
  const operator = payload.order === 'asc' ? 'gt' : 'lt'
  const sortValue = escapeLogicalValue(payload.sortValue)
  const recordId = escapeLogicalValue(payload.id)

  // Compose `(sortField > value) OR (sortField = value AND id > lastId)` for deterministic pagination.
  return `${sort}.${operator}.${sortValue},and(${sort}.eq.${sortValue},id.${operator}.${recordId})`
}

export const listPlants = async (
  supabase: SupabaseClient,
  { userId, query }: ListPlantsCommand,
): Promise<ListPlantsResult> => {
  const { search, speciesNormalized, sort, order, limit, cursor } = query

  let request = supabase
    .from('plants')
    .select<PlantListRow>(PLANT_LIST_COLUMNS)
    .eq('user_id', userId)

  if (search) {
    const pattern = `*${escapeIlikePattern(search)}*`
    const encodedPattern = escapeLogicalValue(pattern)
    request = request.or(
      [
        `species_name.ilike.${encodedPattern}`,
        `nickname.ilike.${encodedPattern}`,
      ].join(','),
    )
  }

  if (speciesNormalized) {
    request = request.eq('species_name_normalized', speciesNormalized)
  }

  if (cursor) {
    const payload = decodeListPlantsCursor(cursor, { userId, sort, order })
    request = request.or(buildCursorFilter(payload, sort))
  }

  request = request
    .order(sort, { ascending: order === 'asc' })
    .order('id', { ascending: order === 'asc' })
    .limit(limit + 1)

  const { data, error } = await request

  if (error || !data) {
    console.error('listPlants query failed', {
      error,
      userId,
    })
    throw new HttpError(500, 'Failed to list plants', 'PLANT_LIST_QUERY_FAILED')
  }

  const hasNext = data.length > limit
  const items = hasNext ? data.slice(0, limit) : data
  const dtoItems = items.map(mapRowToDto)

  const nextCursor =
    hasNext && items.length > 0
      ? encodeListPlantsCursor({
          userId,
          sort,
          order,
          sortValue: getSortValue(items[items.length - 1], sort),
          id: items[items.length - 1].id,
        })
      : null

  return {
    items: dtoItems,
    nextCursor,
  }
}
