export type PlantsFlashMessage =
  | {
      kind: 'plantDeleted'
      plantName: string
      requestId?: string
      createdAt: number
    }

const FLASH_STORAGE_KEY = 'plantPlanner:plantsFlash'

const isPlantsFlashMessage = (value: unknown): value is PlantsFlashMessage => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    record.kind === 'plantDeleted' &&
    typeof record.plantName === 'string' &&
    typeof record.createdAt === 'number'
  )
}

export const savePlantDeletedFlashMessage = (params: {
  plantName: string
  requestId?: string
}): void => {
  if (typeof window === 'undefined') return
  try {
    const payload: PlantsFlashMessage = {
      kind: 'plantDeleted',
      plantName: params.plantName,
      requestId: params.requestId,
      createdAt: Date.now(),
    }
    window.sessionStorage.setItem(FLASH_STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.warn('Failed to persist plants flash message', error)
  }
}

export const consumePlantsFlashMessage = (): PlantsFlashMessage | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(FLASH_STORAGE_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(FLASH_STORAGE_KEY)
    const parsed = JSON.parse(raw) as unknown
    if (isPlantsFlashMessage(parsed)) {
      return parsed
    }
  } catch (error) {
    console.warn('Failed to read plants flash message', error)
  }
  return null
}

