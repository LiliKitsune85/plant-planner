import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'

import { WateringPlanEditorHeader } from './WateringPlanEditorHeader'
import { WateringPlanEditorErrorBanner } from './WateringPlanEditorErrorBanner'
import { WateringPlanForm } from './WateringPlanForm'
import { TasksRegeneratedSummaryCard } from './TasksRegeneratedSummary'
import type {
  WateringPlanAdvancedState,
  WateringPlanEditorModeContext,
  WateringPlanFormErrors,
  WateringPlanFormState,
  WateringPlanMutationError,
  WateringPlanStartFromUi,
} from './types'
import type { SetWateringPlanCommand, SetWateringPlanResultDto } from '@/types'
import { useWateringPlanMutations } from '@/components/hooks/use-watering-plan-mutations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type WateringPlanEditorViewProps = {
  plantId: string
  mode?: 'manual' | 'ai'
  aiRequestId?: string | null
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const DEFAULT_INTERVAL_DAYS = 7
const DEFAULT_HORIZON_DAYS = 90
const DEFAULT_START_FROM: WateringPlanStartFromUi = 'today'
const DEFAULT_SCHEDULE_BASIS: WateringPlanAdvancedState['scheduleBasis'] = 'completed_on'
const DEFAULT_OVERDUE_POLICY: WateringPlanAdvancedState['overduePolicy'] = 'carry_forward'

const buildAdvancedState = (): WateringPlanAdvancedState => ({
  horizonDays: DEFAULT_HORIZON_DAYS,
  scheduleBasis: DEFAULT_SCHEDULE_BASIS,
  overduePolicy: DEFAULT_OVERDUE_POLICY,
})

const buildInitialFormState = (): WateringPlanFormState => ({
  intervalDays: DEFAULT_INTERVAL_DAYS,
  startFrom: DEFAULT_START_FROM,
  customStartOn: null,
  advanced: buildAdvancedState(),
})

const isIntegerInRange = (value: number | '', min: number, max: number): value is number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return false
  return Number.isInteger(value) && value >= min && value <= max
}

const ensureNumber = (value: number | '', fallback: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return value
}

const validateFormState = (state: WateringPlanFormState): WateringPlanFormErrors | null => {
  const errors: WateringPlanFormErrors = {}
  let hasErrors = false

  if (!isIntegerInRange(state.intervalDays, 1, 365)) {
    errors.interval_days = ['Podaj interwał w zakresie 1–365 dni.']
    hasErrors = true
  }

  const horizon = state.advanced.horizonDays
  if (!isIntegerInRange(horizon, 1, 365)) {
    errors.horizon_days = ['Horyzont planu musi mieścić się w zakresie 1–365 dni.']
    hasErrors = true
  }

  if (state.startFrom === 'custom_date') {
    if (!state.customStartOn) {
      errors.custom_start_on = ['Wybierz datę, od której plan ma obowiązywać.']
      hasErrors = true
    } else if (!ISO_DATE_REGEX.test(state.customStartOn)) {
      errors.custom_start_on = ['Data musi być w formacie RRRR-MM-DD.']
      hasErrors = true
    }
  } else if (state.customStartOn) {
    errors.custom_start_on = ['Data niestandardowa jest dostępna tylko po wybraniu tej opcji.']
    hasErrors = true
  }

  if (!hasErrors) {
    return null
  }

  errors.form = [
    'Formularz zawiera błędy. Popraw zaznaczone pola i spróbuj ponownie.',
  ]

  return errors
}

const buildModeContext = (
  mode: 'manual' | 'ai',
  aiRequestId?: string | null,
): WateringPlanEditorModeContext => {
  if (mode === 'ai' && aiRequestId && UUID_REGEX.test(aiRequestId)) {
    return {
      mode: 'ai',
      aiRequestId,
      acceptedWithoutChanges: false,
    }
  }

  return {
    mode: 'manual',
    aiRequestId: null,
    acceptedWithoutChanges: null,
  }
}

const mapFormStateToCommand = (
  state: WateringPlanFormState,
  context: WateringPlanEditorModeContext,
): SetWateringPlanCommand => {
  const intervalDays = ensureNumber(state.intervalDays, DEFAULT_INTERVAL_DAYS)
  const horizonDays = ensureNumber(state.advanced.horizonDays, DEFAULT_HORIZON_DAYS)
  const startFrom = state.startFrom
  const customStartOn =
    startFrom === 'custom_date' && state.customStartOn ? state.customStartOn : null

  const source: SetWateringPlanCommand['source'] =
    context.mode === 'ai' && context.aiRequestId
      ? {
          type: 'ai',
          ai_request_id: context.aiRequestId,
          accepted_without_changes: Boolean(context.acceptedWithoutChanges),
        }
      : {
          type: 'manual',
        }

  return {
    interval_days: intervalDays,
    horizon_days: horizonDays,
    schedule_basis: state.advanced.scheduleBasis,
    start_from: startFrom,
    custom_start_on: customStartOn,
    overdue_policy: state.advanced.overduePolicy,
    source,
  }
}

const hasAnyErrorEntries = (errors: WateringPlanFormErrors | null): boolean => {
  if (!errors) return false
  return Object.values(errors).some(
    (value) => Array.isArray(value) && value.length > 0,
  )
}

const getLoginHref = (): string | undefined => {
  if (typeof window === 'undefined') return undefined
  const current = `${window.location.pathname}${window.location.search}`
  const normalized = current || '/'
  return `/auth/login?returnTo=${encodeURIComponent(normalized)}`
}

const redirectToCalendar = (plantId: string, result: SetWateringPlanResultDto) => {
  if (typeof window === 'undefined') return
  const targetDate = result.tasks_regenerated.from
  const url = `/calendar/day/${targetDate}?highlightPlantId=${encodeURIComponent(plantId)}`
  window.location.assign(url)
}

export const WateringPlanEditorView: FC<WateringPlanEditorViewProps> = ({
  plantId,
  mode = 'manual',
  aiRequestId = null,
}) => {
  const [formState, setFormState] = useState<WateringPlanFormState>(() => buildInitialFormState())
  const [formErrors, setFormErrors] = useState<WateringPlanFormErrors | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const [loginHref, setLoginHref] = useState<string | undefined>(undefined)

  const {
    pending,
    error,
    submitSetPlan,
    clearError,
    lastResult,
  } = useWateringPlanMutations()

  const modeContext = useMemo(() => buildModeContext(mode, aiRequestId), [mode, aiRequestId])
  const validationSnapshot = useMemo(
    () => validateFormState(formState),
    [formState],
  )
  const isPlantIdValid = plantId && UUID_REGEX.test(plantId)
  const isBusy = pending || redirecting
  const canSubmit = !isBusy && validationSnapshot === null

  useEffect(() => {
    setLoginHref(getLoginHref())
  }, [])

  useEffect(() => {
    if (error?.kind === 'validation' && error.fieldErrors) {
      setFormErrors(error.fieldErrors)
    }
  }, [error])

  const clearFieldErrors = useCallback(
    (fields: Array<keyof WateringPlanFormErrors>) => {
      setFormErrors((prev) => {
        if (!prev) return prev
        let changed = false
        const next: WateringPlanFormErrors = { ...prev }
        for (const field of fields) {
          if (next[field]) {
            delete next[field]
            changed = true
          }
        }
        if (!changed) return prev
        return hasAnyErrorEntries(next) ? next : null
      })
      if (error) {
        clearError()
      }
    },
    [clearError, error],
  )

  const handleIntervalDaysChange = useCallback(
    (value: number | '') => {
      clearFieldErrors(['interval_days'])
      setFormState((prev) => ({ ...prev, intervalDays: value }))
    },
    [clearFieldErrors],
  )

  const handleStartFromChange = useCallback(
    (value: WateringPlanStartFromUi) => {
      clearFieldErrors(['start_from', 'custom_start_on'])
      setFormState((prev) => ({
        ...prev,
        startFrom: value,
        customStartOn: value === 'custom_date' ? prev.customStartOn : null,
      }))
    },
    [clearFieldErrors],
  )

  const handleCustomStartOnChange = useCallback(
    (value: string | null) => {
      clearFieldErrors(['custom_start_on'])
      setFormState((prev) => ({
        ...prev,
        customStartOn: value,
      }))
    },
    [clearFieldErrors],
  )

  const handleAdvancedChange = useCallback(
    (patch: Partial<WateringPlanAdvancedState>) => {
      const fieldsToClear: Array<keyof WateringPlanFormErrors> = []
      if (patch.horizonDays !== undefined) fieldsToClear.push('horizon_days')
      if (patch.scheduleBasis !== undefined) fieldsToClear.push('schedule_basis')
      if (patch.overduePolicy !== undefined) fieldsToClear.push('overdue_policy')
      if (fieldsToClear.length > 0) {
        clearFieldErrors(fieldsToClear)
      }
      setFormState((prev) => ({
        ...prev,
        advanced: {
          ...prev.advanced,
          ...patch,
        },
      }))
    },
    [clearFieldErrors],
  )

  const handleCancel = useCallback(() => {
    if (typeof window === 'undefined') return
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.assign('/calendar')
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!isPlantIdValid || isBusy) return

    if (validationSnapshot) {
      setFormErrors(validationSnapshot)
      return
    }

    setFormErrors(null)
    clearError()

    const command = mapFormStateToCommand(formState, modeContext)
    const result = await submitSetPlan(plantId, command)
    if (!result) {
      return
    }

    setRedirecting(true)
    redirectToCalendar(plantId, result)
  }, [
    clearError,
    formState,
    isBusy,
    isPlantIdValid,
    modeContext,
    plantId,
    submitSetPlan,
    validationSnapshot,
  ])

  const blockingError: WateringPlanMutationError | null =
    error && error.kind !== 'validation' ? error : null

  if (!isPlantIdValid) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <WateringPlanEditorHeader
          backHref="/plants"
          onBack={handleCancel}
          title="Niepoprawny identyfikator rośliny"
          subtitle="Wróć do listy roślin i wybierz obiekt ponownie."
        />
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Nie udało się otworzyć edytora planu</CardTitle>
            <CardDescription>
              Przekazany identyfikator rośliny jest pusty lub ma niepoprawny format. Wróć do listy
              roślin i spróbuj ponownie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a className="text-primary underline" href="/plants">
              Przejdź do listy roślin
            </a>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <WateringPlanEditorHeader
        backHref={`/plants/${plantId}/watering-plan`}
        onBack={handleCancel}
      />

      <section className="rounded-3xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
        <p>
          Tryb edycji:{' '}
          <span className="font-semibold text-foreground">
            {modeContext.mode === 'ai' ? 'Sugestia AI' : 'Ręczna konfiguracja'}
          </span>
        </p>
        <p>
          Określ co ile dni należy podlewać roślinę oraz wybierz datę rozpoczęcia harmonogramu. Po
          zapisaniu planu kalendarz zostanie zaktualizowany automatycznie.
        </p>
      </section>

      {blockingError ? (
        <WateringPlanEditorErrorBanner
          error={blockingError}
          pending={isBusy}
          loginHref={blockingError.kind === 'unauthenticated' ? loginHref : undefined}
          onRetry={handleSubmit}
        />
      ) : null}

      <WateringPlanForm
        value={formState}
        errors={formErrors}
        pending={isBusy}
        canSubmit={canSubmit}
        onChangeIntervalDays={handleIntervalDaysChange}
        onChangeStartFrom={handleStartFromChange}
        onChangeCustomStartOn={handleCustomStartOnChange}
        onChangeAdvanced={handleAdvancedChange}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />

      {lastResult ? (
        <TasksRegeneratedSummaryCard summary={lastResult.tasks_regenerated} />
      ) : null}
    </main>
  )
}

