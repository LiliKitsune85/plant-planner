import type { UpdatePlantCommand } from '@/types'

export type PlantEditFormValues = {
  speciesName: string
  nickname: string
  description: string
  purchaseDate: string
  photoPath: string
}

export type PlantEditFieldKey =
  | 'nickname'
  | 'description'
  | 'purchase_date'
  | 'photo_path'
  | 'form'

export type PlantEditFormFieldErrors = Partial<Record<PlantEditFieldKey, string[]>>

export type PlantEditFormErrors = {
  form?: string
  fields: PlantEditFormFieldErrors
}

export type PlantEditErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'notFound'
  | 'network'
  | 'http'
  | 'parse'
  | 'unknown'

export type PlantEditErrorVm = {
  kind: PlantEditErrorKind
  message: string
  code?: string
  requestId?: string
  details?: unknown
  fieldErrors?: Record<string, string[]>
}

export type PlantEditDirtyState = {
  isDirty: boolean
  changedFields: Array<keyof UpdatePlantCommand>
}

export type PlantEditViewStatus = 'idle' | 'loading' | 'success' | 'error'
