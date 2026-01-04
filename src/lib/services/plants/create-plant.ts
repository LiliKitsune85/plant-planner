import type { TablesInsert } from '../../../db/database.types'
import type { SupabaseClient } from '../../../db/supabase.client'
import type { CreatePlantCommand, PlantSummaryDto } from '../../../types'
import { HttpError } from '../../http/errors'

const INSERT_RESULT_COLUMNS = [
  'id',
  'species_name',
  'duplicate_index',
  'nickname',
  'description',
  'purchase_date',
  'photo_path',
  'created_source',
  'created_at',
  'updated_at',
].join(',')

const normalizeSpeciesName = (input: string): string =>
  input.trim().toLowerCase().replace(/\s+/g, ' ')

const buildDisplayName = (speciesName: string, duplicateIndex: number): string =>
  `${speciesName} #${duplicateIndex + 1}`

const isUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  return 'code' in error && (error as { code?: unknown }).code === '23505'
}

const getNextDuplicateIndex = async (
  supabase: SupabaseClient,
  userId: string,
  speciesNameNormalized: string,
): Promise<number> => {
  const { data, error } = await supabase
    .from('plants')
    .select('duplicate_index')
    .eq('user_id', userId)
    .eq('species_name_normalized', speciesNameNormalized)
    .order('duplicate_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('createPlant duplicate_index lookup failed', {
      error,
      userId,
      speciesNameNormalized,
    })
    throw new HttpError(
      500,
      'Failed to compute plant duplicate index',
      'PLANT_DUPLICATE_INDEX_LOOKUP_FAILED',
    )
  }

  const maxIndex = data?.duplicate_index ?? -1
  return maxIndex + 1
}

export type CreatePlantServiceCommand = {
  userId: string
  plant: CreatePlantCommand
}

export const createPlant = async (
  supabase: SupabaseClient,
  { userId, plant }: CreatePlantServiceCommand,
): Promise<PlantSummaryDto> => {
  const normalized = normalizeSpeciesName(plant.species_name)
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const duplicateIndex = await getNextDuplicateIndex(supabase, userId, normalized)

    const insert: TablesInsert<'plants'> = {
      user_id: userId,
      species_name: plant.species_name,
      duplicate_index: duplicateIndex,
      nickname: plant.nickname ?? null,
      description: plant.description ?? null,
      purchase_date: plant.purchase_date ?? null,
      photo_path: plant.photo_path ?? null,
      created_source: 'manual',
    }

    const { data, error } = await supabase
      .from('plants')
      .insert(insert)
      .select(INSERT_RESULT_COLUMNS)
      .single()

    if (error) {
      if (isUniqueViolation(error) && attempt < maxAttempts) {
        continue
      }

      if (isUniqueViolation(error)) {
        throw new HttpError(
          409,
          'Duplicate index conflict, retry later',
          'DUPLICATE_INDEX_CONFLICT',
        )
      }

      console.error('createPlant insert failed', { error, userId })
      throw new HttpError(500, 'Failed to create plant', 'PLANT_CREATE_FAILED')
    }

    if (!data) {
      console.error('createPlant insert returned no data', { userId })
      throw new HttpError(500, 'Failed to create plant', 'PLANT_CREATE_FAILED')
    }

    return {
      id: data.id,
      species_name: data.species_name,
      duplicate_index: data.duplicate_index,
      nickname: data.nickname,
      description: data.description,
      purchase_date: data.purchase_date,
      photo_path: data.photo_path,
      created_source: data.created_source,
      created_at: data.created_at,
      updated_at: data.updated_at,
      display_name: buildDisplayName(data.species_name, data.duplicate_index),
    }
  }

  throw new HttpError(
    409,
    'Duplicate index conflict, retry later',
    'DUPLICATE_INDEX_CONFLICT',
  )
}

