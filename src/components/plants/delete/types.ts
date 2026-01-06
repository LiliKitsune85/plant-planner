export type PlantDeleteVm = {
  plant: {
    id: string
    displayName: string
  }
}

export type PlantDeleteErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'notFound'
  | 'network'
  | 'parse'
  | 'http'
  | 'unknown'

export type PlantDeleteErrorVm = {
  kind: PlantDeleteErrorKind
  message: string
  code?: string
  status?: number
  requestId?: string
  details?: unknown
}

export type DeletePlantMutationErrorVm = {
  kind: PlantDeleteErrorKind
  message: string
  code?: string
  requestId?: string
  details?: unknown
}

