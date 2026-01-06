import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'

import { Button } from '@/components/ui/button'
import { PlantWateringPlanHeader } from '@/components/plants/watering-plan/PlantWateringPlanHeader'
import { AiSuggestionCard } from '@/components/plants/watering-plan/AiSuggestionCard'
import { AiBlockedState } from '@/components/plants/watering-plan/AiBlockedState'
import { AiErrorState } from '@/components/plants/watering-plan/AiErrorState'
import { AiSkippedState } from '@/components/plants/watering-plan/AiSkippedState'
import { FullScreenState } from '@/components/plants/watering-plan/FullScreenState'
import { WateringPlanEditor } from '@/components/plants/watering-plan/WateringPlanEditor'
import type {
  PlantWateringPlanMode,
  WateringPlanFormValues,
  WateringPlanSourceVm,
  AiSuggestionAvailableVm,
  AiSuggestionStateVm,
} from '@/components/plants/watering-plan/types'
import { useWateringPlanSuggestion } from '@/components/hooks/use-watering-plan-suggestion'
import { useSetWateringPlan } from '@/components/hooks/use-set-watering-plan'
import {
  buildDefaultFormValues,
  buildManualOnlyState,
  formValuesFromSuggestion,
  sanitizeFormToSetCommand,
} from '@/components/plants/watering-plan/view-model'
import type { WateringSuggestionForCreationDto } from '@/types'
import { consumeCreatePlantResult } from '@/lib/services/plants/create-plant-result-session'
import { getCalendarDay } from '@/lib/services/calendar/day-client'
import { getCalendarMonth } from '@/lib/services/calendar/month-client'

export type PlantWateringPlanViewProps = {
  plantId: string
  mode?: PlantWateringPlanMode
  initialSpeciesName?: string
}

const getTodayIsoDate = (): string => {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10)
}

export const PlantWateringPlanView: FC<PlantWateringPlanViewProps> = ({
  plantId,
  mode = 'suggest',
  initialSpeciesName,
}) => {
  const [currentMode, setCurrentMode] = useState<PlantWateringPlanMode>(mode)
  const [speciesName, setSpeciesName] = useState<string | null>(initialSpeciesName ?? null)
  const [creationSuggestion, setCreationSuggestion] = useState<WateringSuggestionForCreationDto | null>(null)
  const [aiEnabled, setAiEnabled] = useState(mode !== 'edit')
  const [editorMode, setEditorMode] = useState<'ai_edit' | 'manual'>(mode === 'edit' ? 'manual' : 'ai_edit')
  const [editorInitialValues, setEditorInitialValues] = useState<WateringPlanFormValues>(
    buildDefaultFormValues(),
  )
  const [editorSource, setEditorSource] = useState<WateringPlanSourceVm>({ type: 'manual' })
  const [isRedirecting, setIsRedirecting] = useState(false)

  const { state: suggestionState, isRunning: isSuggesting, run, reset } = useWateringPlanSuggestion({
    plantId,
    speciesName,
    enabled: aiEnabled,
    initialSuggestion: creationSuggestion,
  })
  const { isSaving, error: saveError, save, clearError } = useSetWateringPlan({ plantId })
  const isBusy = isSaving || isRedirecting

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = consumeCreatePlantResult()
    if (!payload || payload.plantId !== plantId) return
    setCreationSuggestion(payload.wateringSuggestion)
    if (payload.speciesName) {
      setSpeciesName((prev) => prev ?? payload.speciesName)
    }
  }, [plantId])

  useEffect(() => {
    if (!aiEnabled) return
    if (currentMode !== 'suggest') return
    if (suggestionState.status !== 'idle') return
    run()
  }, [aiEnabled, currentMode, suggestionState.status, run])

  const manualSkippedState = useMemo(() => buildManualOnlyState(), [])
  const suggestionForDisplay: AiSuggestionStateVm = aiEnabled ? suggestionState : manualSkippedState

  const redirectAfterSave = useCallback(async () => {
    if (typeof window === 'undefined') return
    const todayIso = getTodayIsoDate()
    try {
      const { data } = await getCalendarDay({ date: todayIso, status: 'pending' })
      if (data.items.length > 0) {
        window.location.assign(`/calendar/day/${todayIso}`)
        return
      }
    } catch (error) {
      console.warn('calendar day lookup failed', error)
    }

    try {
      const monthParam = todayIso.slice(0, 7)
      const { data } = await getCalendarMonth({ month: monthParam, status: 'pending' })
      const nextDay = data.days.find((day) => day.count > 0)
      if (nextDay) {
        window.location.assign(`/calendar/day/${nextDay.date}`)
        return
      }
    } catch (error) {
      console.warn('calendar month lookup failed', error)
    }

    window.location.assign('/calendar')
  }, [])

  const handlePlanSaved = useCallback(async () => {
    setIsRedirecting(true)
    try {
      await redirectAfterSave()
    } finally {
      setIsRedirecting(false)
    }
  }, [redirectAfterSave])

  const startManualFlow = useCallback(
    (initial?: WateringPlanFormValues) => {
      setEditorMode('manual')
      setEditorInitialValues(initial ?? buildDefaultFormValues())
      setEditorSource({ type: 'manual' })
      setCurrentMode('edit')
      setAiEnabled(false)
      clearError()
    },
    [clearError],
  )

  const handleManual = useCallback(() => {
    if (isBusy) return
    startManualFlow()
  }, [isBusy, startManualFlow])

  const handleRejectToManual = useCallback(() => {
    if (isBusy) return
    startManualFlow()
  }, [isBusy, startManualFlow])

  const handleEditSuggestion = useCallback(
    (suggestion: AiSuggestionAvailableVm) => {
      if (isBusy) return
      setEditorMode('ai_edit')
      setEditorInitialValues(formValuesFromSuggestion(suggestion))
      setEditorSource({
        type: 'ai',
        aiRequestId: suggestion.aiRequestId,
        acceptedWithoutChanges: false,
      })
      setCurrentMode('edit')
      clearError()
    },
    [clearError, isBusy],
  )

  const handleBackFromEditor = useCallback(() => {
    if (isBusy) return
    clearError()
    setCurrentMode('suggest')
  }, [clearError, isBusy])

  const handleEditorSubmit = useCallback(
    async (values: WateringPlanFormValues) => {
      const command = sanitizeFormToSetCommand(values, editorSource)
      const result = await save(command)
      if (result) {
        await handlePlanSaved()
      }
    },
    [editorSource, handlePlanSaved, save],
  )

  const handleAcceptSuggestion = useCallback(async () => {
    if (isBusy) return
    if (suggestionState.status !== 'available') return
    const command = sanitizeFormToSetCommand(
      formValuesFromSuggestion(suggestionState),
      {
        type: 'ai',
        aiRequestId: suggestionState.aiRequestId,
        acceptedWithoutChanges: true,
      },
    )
    const result = await save(command)
    if (result) {
      await handlePlanSaved()
    }
  }, [handlePlanSaved, isBusy, save, suggestionState])

  const handleRetrySuggest = useCallback(() => {
    reset()
    run()
  }, [reset, run])

  const renderSuggestion = () => {
    if (currentMode === 'edit') {
      return null
    }

    if (suggestionForDisplay.status === 'loading' || suggestionForDisplay.status === 'idle') {
      return (
        <FullScreenState
          title="Sugerowanie planu…"
          description="To może potrwać do 5 sekund."
          action={
            <Button variant="ghost" onClick={handleManual} disabled={isBusy}>
              Ustaw ręcznie
            </Button>
          }
        />
      )
    }

    if (suggestionForDisplay.status === 'available') {
      return (
        <AiSuggestionCard
          suggestion={suggestionForDisplay}
          isSaving={isBusy}
          onAccept={handleAcceptSuggestion}
          onEdit={() => handleEditSuggestion(suggestionForDisplay)}
          onRejectToManual={handleRejectToManual}
        />
      )
    }

    if (suggestionForDisplay.status === 'rate_limited') {
      return <AiBlockedState status={suggestionForDisplay} onManual={handleManual} />
    }

    if (
      suggestionForDisplay.status === 'timeout' ||
      suggestionForDisplay.status === 'provider_error' ||
      suggestionForDisplay.status === 'unknown_error' ||
      suggestionForDisplay.status === 'unauthenticated' ||
      suggestionForDisplay.status === 'not_found'
    ) {
      return (
        <AiErrorState
          error={suggestionForDisplay}
          isRetrying={isSuggesting}
          onRetry={handleRetrySuggest}
          onManual={handleManual}
        />
      )
    }

    if (suggestionForDisplay.status === 'skipped') {
      return <AiSkippedState state={suggestionForDisplay} onManual={handleManual} />
    }

    return null
  }

  const displayedSpeciesName = speciesName ?? undefined

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6" aria-live="polite">
      <PlantWateringPlanHeader speciesName={displayedSpeciesName} />

      {renderSuggestion()}

      {currentMode === 'edit' ? (
        <WateringPlanEditor
          mode={editorMode}
          initialValues={editorInitialValues}
          isSaving={isBusy}
          saveError={saveError}
          onSubmit={handleEditorSubmit}
          onBack={handleBackFromEditor}
          onDismissError={clearError}
        />
      ) : null}
    </main>
  )
}

PlantWateringPlanView.displayName = 'PlantWateringPlanView'

