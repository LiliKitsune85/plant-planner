import type {
  DeletePlantMutationErrorVm,
  PlantDeleteErrorVm,
  PlantDeleteVm,
} from '@/components/plants/delete/types'
import type { PlantDetailDto } from '@/types'

import { PlantsApiError } from './plants-client'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isValidPlantId = (value: string): boolean => UUID_REGEX.test(value)

export const mapPlantDetailDtoToPlantDeleteVm = (dto: PlantDetailDto): PlantDeleteVm => ({
  plant: {
    id: dto.plant.id,
    displayName: dto.plant.display_name,
  },
})

export const buildMissingPlantIdErrorVm = (): PlantDeleteErrorVm => ({
  kind: 'validation',
  message: 'Brakuje identyfikatora rośliny w adresie URL.',
  code: 'MISSING_PLANT_ID',
})

export const buildInvalidPlantIdErrorVm = (): PlantDeleteErrorVm => ({
  kind: 'validation',
  message: 'Niepoprawny identyfikator rośliny.',
  code: 'INVALID_PLANT_ID',
})

export const buildUnknownPlantDeleteErrorVm = (): PlantDeleteErrorVm => ({
  kind: 'unknown',
  message: 'Nie udało się pobrać danych rośliny. Spróbuj ponownie później.',
  code: 'UNKNOWN_ERROR',
})

export const mapPlantsApiErrorToPlantDeleteErrorVm = (error: PlantsApiError): PlantDeleteErrorVm => ({
  kind: error.kind,
  message: error.message ?? 'Nie udało się pobrać danych rośliny.',
  code: error.code,
  status: error.status,
  requestId: error.requestId,
  details: error.details,
})

export const mapPlantsApiErrorToDeletePlantMutationErrorVm = (
  error: PlantsApiError,
): DeletePlantMutationErrorVm => ({
  kind: error.kind,
  message: error.message ?? 'Nie udało się usunąć rośliny.',
  code: error.code,
  requestId: error.requestId,
  details: error.details,
})

export const buildUnknownDeletePlantMutationErrorVm = (): DeletePlantMutationErrorVm => ({
  kind: 'unknown',
  message: 'Nie udało się usunąć rośliny. Spróbuj ponownie później.',
  code: 'UNKNOWN_DELETE_ERROR',
})

