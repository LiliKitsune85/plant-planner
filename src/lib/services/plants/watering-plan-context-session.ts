import type { WateringSuggestionForCreationDto } from '@/types'

const STORAGE_PREFIX = 'pp:watering-plan-context:'
const MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

type StoredWateringPlanContext = {
  speciesName?: string | null
  suggestion?: WateringSuggestionForCreationDto
  updatedAt: string
}

const isBrowser = (): boolean => typeof window !== 'undefined'

const buildKey = (plantId: string): string => `${STORAGE_PREFIX}${plantId}`

const isExpired = (timestamp: string): boolean => {
  const created = Date.parse(timestamp)
  if (Number.isNaN(created)) return true
  return Date.now() - created > MAX_AGE_MS
}

const readStoredContext = (plantId: string): StoredWateringPlanContext | null => {
  if (!isBrowser()) return null
  const raw = window.sessionStorage.getItem(buildKey(plantId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredWateringPlanContext
    if (!parsed || typeof parsed !== 'object' || typeof parsed.updatedAt !== 'string') {
      window.sessionStorage.removeItem(buildKey(plantId))
      return null
    }
    if (isExpired(parsed.updatedAt)) {
      window.sessionStorage.removeItem(buildKey(plantId))
      return null
    }
    return parsed
  } catch (error) {
    console.warn('Failed to parse watering plan session context', error)
    window.sessionStorage.removeItem(buildKey(plantId))
    return null
  }
}

type ContextPatch = {
  speciesName?: string | null
  suggestion?: WateringSuggestionForCreationDto | null
}

export const getWateringPlanContext = (
  plantId: string,
): StoredWateringPlanContext | null => readStoredContext(plantId)

export const saveWateringPlanContext = (plantId: string, patch: ContextPatch): void => {
  if (!isBrowser()) return
  const current = readStoredContext(plantId)
  const hasSpeciesPatch = Object.prototype.hasOwnProperty.call(patch, 'speciesName')
  const hasSuggestionPatch = Object.prototype.hasOwnProperty.call(patch, 'suggestion')

  const nextSpecies =
    hasSpeciesPatch && patch.speciesName !== undefined
      ? patch.speciesName
      : current?.speciesName ?? null

  const nextSuggestion =
    hasSuggestionPatch && patch.suggestion === null
      ? undefined
      : hasSuggestionPatch && patch.suggestion
        ? patch.suggestion
        : current?.suggestion

  if (!nextSpecies && !nextSuggestion) {
    window.sessionStorage.removeItem(buildKey(plantId))
    return
  }

  const nextPayload: StoredWateringPlanContext = {
    speciesName: nextSpecies,
    suggestion: nextSuggestion,
    updatedAt: new Date().toISOString(),
  }

  window.sessionStorage.setItem(buildKey(plantId), JSON.stringify(nextPayload))
}

export const clearWateringPlanContext = (plantId: string): void => {
  if (!isBrowser()) return
  window.sessionStorage.removeItem(buildKey(plantId))
}

