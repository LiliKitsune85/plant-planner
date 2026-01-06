import type { PlantDetailDto, UpdatePlantCommand } from '@/types'

import type {
  PlantEditDirtyState,
  PlantEditFieldKey,
  PlantEditFormErrors,
  PlantEditFormValues,
} from './types'

export const DEFAULT_PLANT_EDIT_FORM_VALUES: PlantEditFormValues = {
  speciesName: '',
  nickname: '',
  description: '',
  purchaseDate: '',
  photoPath: '',
}

export const DEFAULT_PLANT_EDIT_FORM_ERRORS: PlantEditFormErrors = {
  fields: {},
}

const EDITABLE_FIELD_KEYS: Array<keyof UpdatePlantCommand> = [
  'nickname',
  'description',
  'purchase_date',
  'photo_path',
]

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const ensureFieldError = (
  target: PlantEditFormErrors['fields'],
  field: PlantEditFieldKey,
  message: string,
) => {
  target[field] = target[field] ? [...target[field]!, message] : [message]
}

const normalizeOptionalString = (value: string): string => value.trim()

const sanitizeNullableString = (value: string): string | null => {
  const normalized = normalizeOptionalString(value)
  return normalized.length ? normalized : null
}

const sanitizeNullableDescription = (value: string): string | null => sanitizeNullableString(value)

const sanitizeNullableDate = (value: string): string | null => {
  const normalized = normalizeOptionalString(value)
  return normalized.length ? normalized : null
}

const sanitizeNullablePhotoPath = (value: string): string | null => sanitizeNullableString(value)

const getComparablePayload = (
  values: PlantEditFormValues,
): Record<keyof UpdatePlantCommand, string | null> => ({
  nickname: sanitizeNullableString(values.nickname),
  description: sanitizeNullableDescription(values.description),
  purchase_date: sanitizeNullableDate(values.purchaseDate),
  photo_path: sanitizeNullablePhotoPath(values.photoPath),
})

const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE_REGEX.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.toISOString().slice(0, 10) === value
}

const containsForbiddenSegments = (value: string): boolean => {
  if (value.includes('..')) return true
  if (value.includes('\\')) return true
  if (value.includes('?')) return true
  if (value.includes('#')) return true
  return false
}

export const mapPlantDetailToFormValues = (detail: PlantDetailDto): PlantEditFormValues => ({
  speciesName: detail.plant.species_name,
  nickname: detail.plant.nickname ?? '',
  description: detail.plant.description ?? '',
  purchaseDate: detail.plant.purchase_date ?? '',
  photoPath: detail.plant.photo_path ?? '',
})

export const validatePlantEditValues = (values: PlantEditFormValues): PlantEditFormErrors => {
  const fieldErrors: PlantEditFormErrors['fields'] = {}

  const nickname = values.nickname.trim()
  if (nickname && nickname.length > 80) {
    ensureFieldError(fieldErrors, 'nickname', 'Pseudonim może mieć maks. 80 znaków.')
  }

  const description = values.description.trim()
  if (description.length > 10_000) {
    ensureFieldError(fieldErrors, 'description', 'Opis może mieć maks. 10 000 znaków.')
  }

  const purchaseDate = values.purchaseDate.trim()
  if (purchaseDate && !isValidIsoDate(purchaseDate)) {
    ensureFieldError(
      fieldErrors,
      'purchase_date',
      'Data musi być w formacie RRRR-MM-DD i być poprawną datą.',
    )
  }

  const photoPath = values.photoPath.trim()
  if (photoPath) {
    if (photoPath.length > 500) {
      ensureFieldError(fieldErrors, 'photo_path', 'Ścieżka może mieć maks. 500 znaków.')
    }
    if (photoPath.startsWith('/') || photoPath.startsWith('\\')) {
      ensureFieldError(fieldErrors, 'photo_path', 'Ścieżka nie może rozpoczynać się od /.')
    }
    const lower = photoPath.toLowerCase()
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      ensureFieldError(fieldErrors, 'photo_path', 'Wklej ścieżkę z magazynu, nie pełny URL.')
    }
    if (containsForbiddenSegments(photoPath)) {
      ensureFieldError(
        fieldErrors,
        'photo_path',
        'Ścieżka nie może zawierać znaków ?, #, \\, ani sekwencji ..',
      )
    }
  }

  return {
    fields: fieldErrors,
  }
}

export const hasPlantEditErrors = (errors: PlantEditFormErrors): boolean => {
  if (errors.form) return true
  return Object.values(errors.fields).some((messages) => (messages?.length ?? 0) > 0)
}

export const buildUpdatePlantPayload = (
  initial: PlantEditFormValues,
  current: PlantEditFormValues,
): UpdatePlantCommand => {
  const initialPayload = getComparablePayload(initial)
  const currentPayload = getComparablePayload(current)

  return EDITABLE_FIELD_KEYS.reduce<UpdatePlantCommand>((acc, field) => {
    if (initialPayload[field] !== currentPayload[field]) {
      acc[field] = currentPayload[field] ?? null
    }
    return acc
  }, {})
}

export const calculatePlantEditDirtyState = (
  initial: PlantEditFormValues,
  current: PlantEditFormValues,
): PlantEditDirtyState => {
  const initialPayload = getComparablePayload(initial)
  const currentPayload = getComparablePayload(current)

  const changedFields = EDITABLE_FIELD_KEYS.filter(
    (field) => initialPayload[field] !== currentPayload[field],
  )

  return {
    isDirty: changedFields.length > 0,
    changedFields,
  }
}

type IssueDetails = {
  issues?: Array<{
    message?: string
    path?: Array<string | number>
  }>
}

type FieldDetails = {
  field?: string
  message?: string
}

const mapIssuePathToField = (path: Array<string | number> | undefined): PlantEditFieldKey => {
  if (!path || path.length === 0) return 'form'
  const [first] = path
  if (
    first === 'nickname' ||
    first === 'description' ||
    first === 'purchase_date' ||
    first === 'photo_path'
  ) {
    return first
  }
  return 'form'
}

export const mergePlantEditFieldErrorsFromDetails = (
  existing: PlantEditFormErrors['fields'],
  details: unknown,
): PlantEditFormErrors['fields'] => {
  if (!details || typeof details !== 'object') return existing

  const normalized = { ...existing }

  if ('field' in details && typeof (details as FieldDetails).field === 'string') {
    const fieldName = (details as FieldDetails).field!
    const message =
      typeof (details as FieldDetails).message === 'string'
        ? (details as FieldDetails).message!
        : 'Pole zawiera nieprawidłowe dane.'
    const field = mapIssuePathToField([fieldName])
    ensureFieldError(normalized, field, message)
  }

  if ('issues' in details && Array.isArray((details as IssueDetails).issues)) {
    for (const issue of (details as IssueDetails).issues ?? []) {
      if (!issue) continue
      const field = mapIssuePathToField(issue.path)
      ensureFieldError(
        normalized,
        field,
        issue.message ?? 'Pole zawiera nieprawidłowe dane. Zweryfikuj wartości i spróbuj ponownie.',
      )
    }
  }

  return normalized
}
