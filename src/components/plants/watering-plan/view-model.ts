import type {
  AiSuggestionAvailableVm,
  AiSuggestionErrorVm,
  AiSuggestionRateLimitedVm,
  AiSuggestionSkippedVm,
  AiSuggestionStateVm,
  SetPlanErrorVm,
  WateringPlanFormErrors,
  WateringPlanFormField,
  WateringPlanFormValues,
  WateringPlanSourceVm,
} from '@/components/plants/watering-plan/types'
import type {
  SetWateringPlanCommand,
  WateringPlanConfigFields,
  WateringPlanSuggestionDto,
  WateringSuggestionForCreationDto,
} from '@/types'
import { SuggestWateringPlanApiError } from '@/lib/services/watering-plans/suggest-client'
import { SetWateringPlanApiError } from '@/lib/services/watering-plans/set-plan-client'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_SPECIES_NAME_LENGTH = 200
const DEFAULT_INTERVAL_DAYS = 7
const DEFAULT_HORIZON_DAYS = 90

const coerceExplanation = (value?: string | null): string => {
  if (!value) return 'AI nie podało uzasadnienia dla tej sugestii.'
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : 'AI nie podało uzasadnienia dla tej sugestii.'
}

const toFormValue = (value: number | null | undefined, fallback: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return String(fallback)
  }
  return String(value)
}

const mapConfigToVm = (
  dto: WateringPlanSuggestionDto,
): AiSuggestionAvailableVm | AiSuggestionSkippedVm => {
  if (!dto.suggestion) {
    return {
      status: 'skipped',
      reason: 'AI nie zwróciło szczegółów planu.',
    }
  }

  const config = dto.suggestion
  return {
    status: 'available',
    aiRequestId: dto.ai_request_id,
    intervalDays: config.interval_days,
    horizonDays: config.horizon_days ?? DEFAULT_HORIZON_DAYS,
    scheduleBasis: config.schedule_basis,
    startFrom: config.start_from,
    customStartOn: config.custom_start_on ?? null,
    overduePolicy: config.overdue_policy,
    explanation: coerceExplanation(dto.explanation),
  }
}

const mapCreationAvailable = (
  suggestion: Extract<WateringSuggestionForCreationDto, { status: 'available' }>,
): AiSuggestionAvailableVm => ({
  status: 'available',
  aiRequestId: suggestion.ai_request_id,
  intervalDays: suggestion.interval_days,
  horizonDays: suggestion.horizon_days ?? DEFAULT_HORIZON_DAYS,
  scheduleBasis: suggestion.schedule_basis,
  startFrom: suggestion.start_from,
  customStartOn: suggestion.custom_start_on ?? null,
  overduePolicy: suggestion.overdue_policy,
  explanation: coerceExplanation(suggestion.explanation),
})

const normalizeReason = (reason?: string | null): string | null => {
  if (!reason) return null
  const trimmed = reason.trim()
  if (!trimmed) return null
  return trimmed.length > 500 ? `${trimmed.slice(0, 497)}…` : trimmed
}

const parseUnlockAt = (details?: unknown): string | null => {
  if (!details || typeof details !== 'object') return null
  const unlockAt = (details as { unlock_at?: unknown }).unlock_at
  return typeof unlockAt === 'string' ? unlockAt : null
}

const clampSpeciesName = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_SPECIES_NAME_LENGTH) {
    return trimmed.slice(0, MAX_SPECIES_NAME_LENGTH)
  }
  return trimmed
}

const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

const ensureRange = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

const appendFieldError = (
  errors: WateringPlanFormErrors['fieldErrors'],
  field: WateringPlanFormField,
  message: string,
) => {
  if (!errors[field]) {
    errors[field] = []
  }
  errors[field]?.push(message)
}

const extractFieldErrorsFromDetails = (details: unknown): Record<string, string[]> | undefined => {
  if (!details || typeof details !== 'object') return undefined

  const fields = (details as { fields?: unknown }).fields
  if (fields && typeof fields === 'object') {
    const result: Record<string, string[]> = {}
    for (const [field, messages] of Object.entries(fields)) {
      if (!Array.isArray(messages)) continue
      const filtered = messages.filter((message): message is string => typeof message === 'string')
      if (filtered.length > 0) {
        result[field] = filtered
      }
    }
    if (Object.keys(result).length > 0) {
      return result
    }
  }

  const issues = (details as { issues?: unknown }).issues
  if (Array.isArray(issues)) {
    const result: Record<string, string[]> = {}
    for (const issue of issues) {
      if (!issue || typeof issue !== 'object') continue
      const path = (issue as { path?: unknown }).path
      const field = Array.isArray(path)
        ? (path as Array<string | number>).join('.')
        : typeof path === 'string'
          ? path
          : 'form'
      const message = (issue as { message?: unknown }).message
      if (typeof message !== 'string' || !message) continue
      if (!result[field]) {
        result[field] = []
      }
      result[field]?.push(message)
    }
    if (Object.keys(result).length > 0) {
      return result
    }
  }

  return undefined
}

export const isValidWateringPlanPlantId = (value: string): boolean => UUID_REGEX.test(value)

export const normalizeSpeciesNameForSuggest = (value?: string | null): string | null =>
  clampSpeciesName(value)

export const buildDefaultFormValues = (): WateringPlanFormValues => ({
  interval_days: String(DEFAULT_INTERVAL_DAYS),
  start_from: 'today',
  custom_start_on: '',
  horizon_days: String(DEFAULT_HORIZON_DAYS),
  schedule_basis: 'completed_on',
  overdue_policy: 'carry_forward',
})

export const mapSuggestionDtoToVm = (
  dto: WateringPlanSuggestionDto,
): AiSuggestionAvailableVm | AiSuggestionSkippedVm => mapConfigToVm(dto)

export const mapCreationSuggestionToState = (
  suggestion: WateringSuggestionForCreationDto,
): AiSuggestionStateVm => {
  switch (suggestion.status) {
    case 'available':
      return mapCreationAvailable(suggestion)
    case 'rate_limited':
      return {
        status: 'rate_limited',
        unlockAt: suggestion.unlock_at ?? null,
        aiRequestId: suggestion.ai_request_id,
      }
    case 'error':
    case 'skipped':
    default:
      return {
        status: 'skipped',
        reason: normalizeReason(suggestion.explanation),
      }
  }
}

export const buildRateLimitedVm = (
  error: SuggestWateringPlanApiError,
): AiSuggestionRateLimitedVm => ({
  status: 'rate_limited',
  unlockAt: parseUnlockAt(error.details),
  aiRequestId: error.suggestion?.ai_request_id ?? null,
})

export const buildSuggestionErrorVm = (
  error: SuggestWateringPlanApiError,
): AiSuggestionErrorVm => {
  switch (error.kind) {
    case 'timeout':
      return {
        status: 'timeout',
        code: error.code,
        message:
          error.message ??
          'AI nie odpowiedziało na czas. Spróbuj ponownie lub ustaw plan ręcznie.',
        requestId: error.requestId,
        details: error.details,
      }
    case 'provider_error':
      return {
        status: 'provider_error',
        code: error.code,
        message:
          error.message ??
          'Dostawca AI zwrócił błąd. Spróbuj ponownie później lub ustaw plan ręcznie.',
        requestId: error.requestId,
        details: error.details,
      }
    case 'unauthenticated':
      return {
        status: 'unauthenticated',
        code: error.code,
        message: error.message ?? 'Sesja wygasła. Zaloguj się ponownie.',
        requestId: error.requestId,
        details: error.details,
      }
    case 'not_found':
      return {
        status: 'not_found',
        code: error.code,
        message: error.message ?? 'Roślina nie została znaleziona lub nie masz dostępu.',
        requestId: error.requestId,
        details: error.details,
      }
    default:
      return {
        status: 'unknown_error',
        code: error.code,
        message: error.message ?? 'Nie udało się pobrać sugestii AI.',
        requestId: error.requestId,
        details: error.details,
      }
  }
}

export const buildSkippedState = (reason?: string | null): AiSuggestionSkippedVm => ({
  status: 'skipped',
  reason: normalizeReason(reason),
})

export const buildManualOnlyState = (): AiSuggestionSkippedVm => ({
  status: 'skipped',
  reason: 'Ustaw plan ręcznie, aby kontynuować.',
})

export const formValuesFromSuggestion = (
  suggestion: AiSuggestionAvailableVm,
): WateringPlanFormValues => ({
  interval_days: String(suggestion.intervalDays),
  start_from: suggestion.startFrom,
  custom_start_on: suggestion.customStartOn ?? '',
  horizon_days: String(suggestion.horizonDays),
  schedule_basis: suggestion.scheduleBasis,
  overdue_policy: suggestion.overduePolicy,
})

export const formValuesFromConfig = (
  config: WateringPlanConfigFields,
): WateringPlanFormValues => ({
  interval_days: toFormValue(config.interval_days, DEFAULT_INTERVAL_DAYS),
  start_from: config.start_from,
  custom_start_on: config.custom_start_on ?? '',
  horizon_days: toFormValue(config.horizon_days ?? DEFAULT_HORIZON_DAYS, DEFAULT_HORIZON_DAYS),
  schedule_basis: config.schedule_basis,
  overdue_policy: config.overdue_policy,
})

export const sanitizeFormToSetCommand = (
  values: WateringPlanFormValues,
  source: WateringPlanSourceVm,
): SetWateringPlanCommand => {
  const intervalDays = ensureRange(
    parseNumber(values.interval_days, DEFAULT_INTERVAL_DAYS),
    1,
    365,
  )
  const horizonDays = ensureRange(
    parseNumber(values.horizon_days, DEFAULT_HORIZON_DAYS),
    1,
    365,
  )
  const startFrom = values.start_from
  const customStartOn =
    startFrom === 'custom_date' && values.custom_start_on ? values.custom_start_on : null

  return {
    interval_days: intervalDays,
    horizon_days: horizonDays,
    schedule_basis: values.schedule_basis,
    start_from: startFrom,
    custom_start_on: customStartOn,
    overdue_policy: values.overdue_policy,
    source:
      source.type === 'ai'
        ? {
            type: 'ai',
            ai_request_id: source.aiRequestId,
            accepted_without_changes: source.acceptedWithoutChanges,
          }
        : {
            type: 'manual',
          },
  }
}

export const validateWateringPlanForm = (
  values: WateringPlanFormValues,
): WateringPlanFormErrors => {
  const fieldErrors: WateringPlanFormErrors['fieldErrors'] = {}

  const intervalDays = Number.parseInt(values.interval_days, 10)
  if (!Number.isInteger(intervalDays)) {
    appendFieldError(fieldErrors, 'interval_days', 'Podaj liczbę całkowitą (dni).')
  } else if (intervalDays < 1 || intervalDays > 365) {
    appendFieldError(fieldErrors, 'interval_days', 'Zakres dozwolony to 1–365 dni.')
  }

  const horizonDays = Number.parseInt(values.horizon_days, 10)
  if (!Number.isInteger(horizonDays)) {
    appendFieldError(fieldErrors, 'horizon_days', 'Podaj liczbę całkowitą (dni).')
  } else if (horizonDays < 1 || horizonDays > 365) {
    appendFieldError(fieldErrors, 'horizon_days', 'Zakres dozwolony to 1–365 dni.')
  }

  if (values.start_from === 'custom_date') {
    if (!values.custom_start_on) {
      appendFieldError(fieldErrors, 'custom_start_on', 'Wybierz datę rozpoczęcia.')
    }
  } else if (values.custom_start_on) {
    appendFieldError(
      fieldErrors,
      'custom_start_on',
      'Data niestandardowa jest dostępna tylko przy wyborze opcji „Niestandardowa data”.',
    )
  }

  const hasErrors = Object.keys(fieldErrors).length > 0

  return {
    fieldErrors,
    formError: hasErrors ? 'Formularz zawiera błędy. Popraw je i spróbuj ponownie.' : undefined,
  }
}

export const buildSetPlanErrorVm = (error: SetWateringPlanApiError): SetPlanErrorVm => {
  if (error.kind === 'validation') {
    return {
      kind: 'validation',
      message: error.message ?? 'Formularz zawiera błędy. Popraw je i spróbuj ponownie.',
      code: error.code,
      requestId: error.requestId,
      details: error.details,
      fieldErrors: extractFieldErrorsFromDetails(error.details),
    }
  }

  if (error.kind === 'unauthenticated') {
    return {
      kind: 'unauthenticated',
      message: error.message ?? 'Sesja wygasła. Zaloguj się ponownie i spróbuj zapisać plan.',
      code: error.code,
      requestId: error.requestId,
      details: error.details,
    }
  }

  if (error.kind === 'not_found') {
    return {
      kind: 'not_found',
      message: error.message ?? 'Roślina nie została znaleziona lub nie masz dostępu.',
      code: error.code,
      requestId: error.requestId,
      details: error.details,
    }
  }

  if (error.kind === 'conflict') {
    return {
      kind: 'conflict',
      message:
        error.message ??
        'Plan został zmieniony w tle. Odśwież dane i spróbuj ponownie ustawić plan.',
      code: error.code,
      requestId: error.requestId,
      details: error.details,
    }
  }

  if (error.kind === 'network') {
    return {
      kind: 'network',
      message: 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
      code: error.code,
      requestId: error.requestId,
      details: error.details,
    }
  }

  if (error.kind === 'parse') {
    return {
      kind: 'parse',
      message: 'Nie udało się przetworzyć odpowiedzi serwera. Spróbuj ponownie później.',
      code: error.code,
      requestId: error.requestId,
      details: error.details,
    }
  }

  if (error.kind === 'http') {
    return {
      kind: 'http',
      message: error.message ?? 'Serwer odrzucił żądanie zapisu planu.',
      code: error.code,
      requestId: error.requestId,
      details: error.details,
    }
  }

  return {
    kind: 'unknown',
    message: error.message ?? 'Nie udało się zapisać planu podlewania. Spróbuj ponownie.',
    code: error.code,
    requestId: error.requestId,
    details: error.details,
  }
}

export const buildUnknownSetPlanError = (message?: string): SetPlanErrorVm => ({
  kind: 'unknown',
  message: message ?? 'Nie udało się zapisać planu podlewania. Spróbuj ponownie.',
})

