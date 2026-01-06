import type { CreatePlantResultDto, WateringSuggestionForCreationDto } from '@/types'

const STORAGE_KEY = 'pp_create_plant_result'
const MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

export type CreatePlantResultSessionPayload = {
  plantId: string
  speciesName: string | null
  wateringSuggestion: WateringSuggestionForCreationDto
  createdAt: string
}

const isBrowser = (): boolean => typeof window !== 'undefined'

const isExpired = (createdAt: string): boolean => {
  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return true
  return Date.now() - created > MAX_AGE_MS
}

const readRawPayload = (): CreatePlantResultSessionPayload | null => {
  if (!isBrowser()) return null
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<CreatePlantResultSessionPayload>
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.plantId !== 'string' ||
      typeof parsed.createdAt !== 'string' ||
      !parsed.wateringSuggestion
    ) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }

    const speciesName =
      'speciesName' in parsed
        ? typeof parsed.speciesName === 'string'
          ? parsed.speciesName
          : parsed.speciesName === null
            ? null
            : null
        : null

    if (isExpired(parsed.createdAt)) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }

    return {
      plantId: parsed.plantId,
      speciesName,
      wateringSuggestion: parsed.wateringSuggestion,
      createdAt: parsed.createdAt,
    }
  } catch (error) {
    console.warn('Failed to parse stored create plant result', error)
    window.sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const saveCreatePlantResult = (result: CreatePlantResultDto): void => {
  if (!isBrowser()) return
  const payload: CreatePlantResultSessionPayload = {
    plantId: result.plant.id,
    speciesName: result.plant.species_name ?? null,
    wateringSuggestion: result.watering_suggestion,
    createdAt: new Date().toISOString(),
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export const consumeCreatePlantResult = (): CreatePlantResultSessionPayload | null => {
  const payload = readRawPayload()
  if (isBrowser()) {
    window.sessionStorage.removeItem(STORAGE_KEY)
  }
  return payload
}

export const peekCreatePlantResult = (): CreatePlantResultSessionPayload | null => readRawPayload()

export const clearCreatePlantResult = (): void => {
  if (!isBrowser()) return
  window.sessionStorage.removeItem(STORAGE_KEY)
}

