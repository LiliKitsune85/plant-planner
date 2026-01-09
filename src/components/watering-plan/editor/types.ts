import type { SetWateringPlanResultDto } from '@/types'

export type WateringPlanEditorMode = 'manual' | 'ai'

export type WateringPlanEditorModeContext = {
  mode: WateringPlanEditorMode
  aiRequestId: string | null
  acceptedWithoutChanges: boolean | null
}

export type WateringPlanStartFromUi = 'today' | 'custom_date'

export type WateringPlanAdvancedState = {
  horizonDays: number | ''
  scheduleBasis: 'due_on' | 'completed_on'
  overduePolicy: 'carry_forward' | 'reschedule'
}

export type WateringPlanFormState = {
  intervalDays: number | ''
  startFrom: WateringPlanStartFromUi
  customStartOn: string | null
  advanced: WateringPlanAdvancedState
}

export type WateringPlanFormErrors = {
  form?: string[]
  interval_days?: string[]
  start_from?: string[]
  custom_start_on?: string[]
  horizon_days?: string[]
  schedule_basis?: string[]
  overdue_policy?: string[]
}

export type WateringPlanEditorVm = {
  plantId: string
  mode: WateringPlanEditorModeContext
  form: WateringPlanFormState
  pending: boolean
  canSubmit: boolean
  errors: WateringPlanFormErrors | null
  lastResult: SetWateringPlanResultDto | null
}

export type WateringPlanMutationErrorKind =
  | 'validation'
  | 'conflict'
  | 'notFound'
  | 'unauthenticated'
  | 'http'
  | 'network'
  | 'parse'
  | 'unknown'

export type WateringPlanMutationError = {
  kind: WateringPlanMutationErrorKind
  message: string
  code?: string
  details?: unknown
  requestId?: string
  fieldErrors?: WateringPlanFormErrors
}

