import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AiQuotaDto } from '@/types'
import {
  CREATE_PLANT_FIELD_ORDER,
  DEFAULT_CREATE_PLANT_FORM_ERRORS,
  DEFAULT_CREATE_PLANT_FORM_VALUES,
  type CreatePlantAiToggleVm,
  type CreatePlantErrorVm,
  type CreatePlantFormErrors,
  type CreatePlantFormField,
  type CreatePlantFormValues,
  type CreatePlantSubmitState,
} from '@/components/plants/new/types'
import {
  hasCreatePlantFieldErrors,
  mergeFieldErrorsFromDetails,
  sanitizeCreatePlantValues,
  validateCreatePlant,
} from '@/components/plants/new/validation'
import { saveCreatePlantResult } from '@/lib/services/plants/create-plant-result-session'
import { fetchAiQuota, AiQuotaApiError } from '@/lib/services/ai/ai-quota-client'
import { createPlant, PlantsApiError } from '@/lib/services/plants/plants-client'

const AI_LIMIT_INFO_STORAGE_KEY = 'pp_ai_limit_info_seen'
const AI_UNLOCK_AT_STORAGE_KEY = 'pp_ai_unlock_at'
const DEFAULT_LIMIT_TEXT = 'Limit: 20 zapytań/h na użytkownika'

const buildUnknownError = (overrides?: Partial<CreatePlantErrorVm>): CreatePlantErrorVm => ({
  kind: 'unknown',
  message: 'Nie udało się zapisać rośliny. Spróbuj ponownie później.',
  ...overrides,
})

const mapPlantsApiError = (error: PlantsApiError): CreatePlantErrorVm => {
  switch (error.kind) {
    case 'unauthenticated':
      return {
        kind: 'unauthenticated',
        message: 'Sesja wygasła. Zaloguj się ponownie, aby kontynuować.',
        code: error.code,
        requestId: error.requestId,
        details: error.details,
      }
    case 'network':
      return {
        kind: 'network',
        message: 'Brak połączenia z siecią. Sprawdź internet i spróbuj ponownie.',
        code: error.code,
        requestId: error.requestId,
        details: error.details,
      }
    case 'conflict':
      return {
        kind: 'conflict',
        message: 'Konflikt numeracji duplikatów. Spróbuj ponownie.',
        code: error.code,
        requestId: error.requestId,
        details: error.details,
      }
    case 'validation':
      return {
        kind: 'validation',
        message: 'Formularz zawiera błędy. Popraw je i spróbuj ponownie.',
        code: error.code,
        requestId: error.requestId,
        details: error.details,
      }
    case 'parse':
      return {
        kind: 'parse',
        message: 'Nie udało się przetworzyć odpowiedzi serwera. Spróbuj ponownie.',
        code: error.code,
        requestId: error.requestId,
        details: error.details,
      }
    case 'http':
      return {
        kind: 'http',
        message: error.message ?? 'Nie udało się zapisać rośliny. Spróbuj ponownie.',
        code: error.code,
        requestId: error.requestId,
        details: error.details,
      }
    default:
      return buildUnknownError({
        code: error.code,
        requestId: error.requestId,
        details: error.details,
      })
  }
}

const focusFirstErrorField = (fieldErrors: CreatePlantFormErrors['fieldErrors']) => {
  if (typeof window === 'undefined') return
  for (const field of CREATE_PLANT_FIELD_ORDER) {
    const errors = fieldErrors[field]
    if (!errors || errors.length === 0) continue
    const el = document.getElementById(field)
    if (el && 'focus' in el) {
      ;(el as HTMLElement).focus()
    }
    break
  }
}

const isUnlockExpired = (unlockAt?: string | null): boolean => {
  if (!unlockAt) return true
  const unlockTime = Date.parse(unlockAt)
  if (Number.isNaN(unlockTime)) return true
  return unlockTime <= Date.now()
}

const readStoredUnlockAt = (): string | null => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(AI_UNLOCK_AT_STORAGE_KEY)
}

const cacheUnlockAt = (unlockAt: string) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AI_UNLOCK_AT_STORAGE_KEY, unlockAt)
}

const clearUnlockAt = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AI_UNLOCK_AT_STORAGE_KEY)
}

const markLimitInfoSeen = () => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AI_LIMIT_INFO_STORAGE_KEY, 'seen')
}

const hasSeenLimitInfo = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(AI_LIMIT_INFO_STORAGE_KEY) === 'seen'
}

const removeFieldErrorsForPatch = (
  prevErrors: CreatePlantFormErrors['fieldErrors'],
  patch: Partial<CreatePlantFormValues>,
) => {
  const next = { ...prevErrors }
  for (const key of Object.keys(patch) as Array<keyof CreatePlantFormValues>) {
    if (key in next) {
      delete next[key as CreatePlantFormField]
    }
  }
  return next
}

type UseCreatePlantResult = {
  value: CreatePlantFormValues
  errors: CreatePlantFormErrors
  isSubmitting: boolean
  submitState: CreatePlantSubmitState
  aiToggleVm: CreatePlantAiToggleVm
  handleChange: (patch: Partial<CreatePlantFormValues>) => void
  handleSubmit: () => void
  resetForm: () => void
  resetError: () => void
}

export const useCreatePlant = (): UseCreatePlantResult => {
  const [value, setValue] = useState<CreatePlantFormValues>(DEFAULT_CREATE_PLANT_FORM_VALUES)
  const [errors, setErrors] = useState<CreatePlantFormErrors>(DEFAULT_CREATE_PLANT_FORM_ERRORS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<CreatePlantSubmitState>({ status: 'idle' })
  const [showLimitInfo, setShowLimitInfo] = useState(true)
  const [limitText, setLimitText] = useState(DEFAULT_LIMIT_TEXT)
  const [aiRateLimited, setAiRateLimited] = useState<{
    isRateLimited: boolean
    unlockAt: string | null
  }>({
    isRateLimited: false,
    unlockAt: null,
  })
  const [isRefreshingQuota, setIsRefreshingQuota] = useState(false)
  const unlockTimeoutRef = useRef<number | null>(null)
  const quotaIntervalRef = useRef<number | null>(null)

  const initializeAiLimitState = useCallback(() => {
    if (hasSeenLimitInfo()) {
      setShowLimitInfo(false)
    } else {
      setShowLimitInfo(true)
      markLimitInfoSeen()
    }

    const storedUnlock = readStoredUnlockAt()
    if (storedUnlock && !isUnlockExpired(storedUnlock)) {
      setAiRateLimited({ isRateLimited: true, unlockAt: storedUnlock })
      setValue((prev) => ({
        ...prev,
        generate_watering_suggestion: false,
      }))
    } else if (storedUnlock) {
      clearUnlockAt()
    }
  }, [])

  const applyQuota = useCallback(
    (quota: AiQuotaDto) => {
      setLimitText(
        `Limit: ${quota.limit_per_hour} zapytań/h · Pozostało ${Math.max(
          0,
          quota.remaining,
        )} zapytań`,
      )

      if (quota.is_rate_limited && quota.unlock_at) {
        cacheUnlockAt(quota.unlock_at)
        setAiRateLimited({ isRateLimited: true, unlockAt: quota.unlock_at })
        setValue((prev) => ({
          ...prev,
          generate_watering_suggestion: false,
        }))
      } else if (!quota.is_rate_limited) {
        clearUnlockAt()
        setAiRateLimited((prev) =>
          prev.isRateLimited ? { isRateLimited: false, unlockAt: null } : prev,
        )
      }
    },
    [setValue],
  )

  const refreshAiQuota = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const quota = await fetchAiQuota({ signal })
        applyQuota(quota)
      } catch (error) {
        if (error instanceof AiQuotaApiError && error.status === 401) {
          // Unauthenticated users cannot call the quota endpoint; ignore silently.
          return
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        console.warn('Failed to fetch AI quota', error)
      }
    },
    [applyQuota],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    initializeAiLimitState()
    const controller = new AbortController()
    void refreshAiQuota(controller.signal)

    quotaIntervalRef.current = window.setInterval(() => {
      void refreshAiQuota()
    }, 60_000)

    return () => {
      controller.abort()
      if (quotaIntervalRef.current) {
        window.clearInterval(quotaIntervalRef.current)
      }
      if (unlockTimeoutRef.current) {
        window.clearTimeout(unlockTimeoutRef.current)
      }
    }
  }, [initializeAiLimitState, refreshAiQuota])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!aiRateLimited.isRateLimited || !aiRateLimited.unlockAt) {
      if (unlockTimeoutRef.current) {
        window.clearTimeout(unlockTimeoutRef.current)
        unlockTimeoutRef.current = null
      }
      return
    }

    const msUntilUnlock = Date.parse(aiRateLimited.unlockAt) - Date.now()
    if (msUntilUnlock <= 0) {
      setAiRateLimited({ isRateLimited: false, unlockAt: null })
      clearUnlockAt()
      return
    }

    unlockTimeoutRef.current = window.setTimeout(() => {
      setAiRateLimited({ isRateLimited: false, unlockAt: null })
      clearUnlockAt()
    }, msUntilUnlock)
  }, [aiRateLimited])

  const resetForm = useCallback(() => {
    setValue(DEFAULT_CREATE_PLANT_FORM_VALUES)
    setErrors(DEFAULT_CREATE_PLANT_FORM_ERRORS)
    setSubmitState({ status: 'idle' })
  }, [])

  const resetError = useCallback(() => {
    setSubmitState((prev) => (prev.status === 'error' ? { status: 'idle' } : prev))
    setErrors((prev) => ({
      ...prev,
      formError: undefined,
    }))
  }, [])

  const handleChange = useCallback(
    (patch: Partial<CreatePlantFormValues>) => {
      setValue((prev) => ({ ...prev, ...patch }))
      setErrors((prev) => ({
        fieldErrors: removeFieldErrorsForPatch(prev.fieldErrors, patch),
        formError: undefined,
      }))
      setSubmitState((prev) => (prev.status === 'error' ? { status: 'idle' } : prev))
    },
    [],
  )

  const handleAiToggle = useCallback(
    (enabled: boolean) => {
      if (aiRateLimited.isRateLimited) return
      handleChange({ generate_watering_suggestion: enabled })
    },
    [aiRateLimited.isRateLimited, handleChange],
  )

  const handleManualQuotaRefresh = useCallback(async () => {
    if (isRefreshingQuota) return
    setIsRefreshingQuota(true)
    try {
      await refreshAiQuota()
    } finally {
      setIsRefreshingQuota(false)
    }
  }, [isRefreshingQuota, refreshAiQuota])

  const aiToggleVm: CreatePlantAiToggleVm = useMemo(
    () => ({
      enabled: value.generate_watering_suggestion && !aiRateLimited.isRateLimited,
      isRateLimited: aiRateLimited.isRateLimited,
      unlockAt: aiRateLimited.unlockAt,
      showLimitInfo,
      limitText,
      isRefreshingQuota,
      onToggle: handleAiToggle,
      onRefresh: handleManualQuotaRefresh,
    }),
    [
      value.generate_watering_suggestion,
      aiRateLimited.isRateLimited,
      aiRateLimited.unlockAt,
      showLimitInfo,
      limitText,
      isRefreshingQuota,
      handleAiToggle,
      handleManualQuotaRefresh,
    ],
  )

  const handleSubmit = useCallback(async () => {
    const validationResult = validateCreatePlant(value)
    if (hasCreatePlantFieldErrors(validationResult)) {
      setErrors(validationResult)
      focusFirstErrorField(validationResult.fieldErrors)
      return
    }

    setIsSubmitting(true)
    setSubmitState({ status: 'submitting' })
    setErrors({ fieldErrors: {} })

    try {
      const payload = sanitizeCreatePlantValues(value)
      const { data } = await createPlant(payload)
      setSubmitState({ status: 'success', result: data })
      saveCreatePlantResult(data)

      if (data.watering_suggestion.status === 'rate_limited') {
        const unlockAt = data.watering_suggestion.unlock_at
        if (unlockAt) {
          cacheUnlockAt(unlockAt)
          setAiRateLimited({ isRateLimited: true, unlockAt })
          setValue((prev) => ({
            ...prev,
            generate_watering_suggestion: false,
          }))
        }
      } else {
        clearUnlockAt()
        setAiRateLimited({ isRateLimited: false, unlockAt: null })
      }
    } catch (error) {
      if (error instanceof PlantsApiError) {
        console.error('createPlant request failed', {
          code: error.code,
          kind: error.kind,
          requestId: error.requestId,
          details: error.details,
        })

        const errorVm = mapPlantsApiError(error)
        setSubmitState({ status: 'error', error: errorVm })

        let nextFieldErrors: CreatePlantFormErrors['fieldErrors'] = {}
        if (error.kind === 'validation') {
          nextFieldErrors = mergeFieldErrorsFromDetails({}, error.details)
        }

        setErrors({
          fieldErrors: nextFieldErrors,
          formError: errorVm.message,
        })
        if (error.kind === 'validation') {
          focusFirstErrorField(nextFieldErrors)
        }
      } else {
        console.error('createPlant request failed with unexpected error', error)
        const fallback = buildUnknownError()
        setSubmitState({ status: 'error', error: fallback })
        setErrors({
          fieldErrors: {},
          formError: fallback.message,
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [value])

  return {
    value,
    errors,
    isSubmitting,
    submitState,
    aiToggleVm,
    handleChange,
    handleSubmit,
    resetForm,
    resetError,
  }
}
