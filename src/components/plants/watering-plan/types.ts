export type PlantWateringPlanMode = 'suggest' | 'edit'

export type WateringPlanSourceVm =
  | { type: 'ai'; aiRequestId: string; acceptedWithoutChanges: boolean }
  | { type: 'manual' }

export type AiSuggestionStatus =
  | 'idle'
  | 'loading'
  | 'available'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error'
  | 'unauthenticated'
  | 'not_found'
  | 'skipped'
  | 'unknown_error'

export type AiSuggestionAvailableVm = {
  status: 'available'
  aiRequestId: string
  intervalDays: number
  horizonDays: number
  scheduleBasis: 'due_on' | 'completed_on'
  startFrom: 'today' | 'purchase_date' | 'custom_date'
  customStartOn: string | null
  overduePolicy: 'carry_forward' | 'reschedule'
  explanation: string
}

export type AiSuggestionRateLimitedVm = {
  status: 'rate_limited'
  unlockAt?: string | null
  aiRequestId?: string | null
}

export type AiSuggestionErrorVm = {
  status: 'timeout' | 'provider_error' | 'unknown_error' | 'unauthenticated' | 'not_found'
  code?: string
  message: string
  requestId?: string
  details?: unknown
}

export type AiSuggestionSkippedVm = {
  status: 'skipped'
  reason?: string | null
}

export type AiSuggestionStateVm =
  | { status: 'idle' }
  | { status: 'loading' }
  | AiSuggestionAvailableVm
  | AiSuggestionRateLimitedVm
  | AiSuggestionErrorVm
  | AiSuggestionSkippedVm

export type WateringPlanFormValues = {
  interval_days: string
  start_from: 'today' | 'purchase_date' | 'custom_date'
  custom_start_on: string
  horizon_days: string
  schedule_basis: 'due_on' | 'completed_on'
  overdue_policy: 'carry_forward' | 'reschedule'
}

export type WateringPlanFormField =
  | 'interval_days'
  | 'start_from'
  | 'custom_start_on'
  | 'horizon_days'
  | 'schedule_basis'
  | 'overdue_policy'
  | 'form'

export type WateringPlanFormErrors = {
  fieldErrors: Partial<Record<WateringPlanFormField, string[]>>
  formError?: string
}

export type SetPlanErrorVm = {
  kind:
    | 'validation'
    | 'unauthenticated'
    | 'not_found'
    | 'conflict'
    | 'network'
    | 'http'
    | 'parse'
    | 'unknown'
  message: string
  code?: string
  requestId?: string
  details?: unknown
  fieldErrors?: Record<string, string[]>
}

