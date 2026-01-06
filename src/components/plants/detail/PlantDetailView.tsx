import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'

import { Button } from '@/components/ui/button'
import { usePlantDetail } from '@/components/hooks/use-plant-detail'
import { usePlantDetailMutations } from '@/components/hooks/use-plant-detail-mutations'
import { PlantDetailErrorState } from '@/components/plants/detail/PlantDetailErrorState'
import { PlantDetailHeader } from '@/components/plants/detail/PlantDetailHeader'
import { PlantDetailSkeleton } from '@/components/plants/detail/PlantDetailSkeleton'
import { PlantIdentityCard } from '@/components/plants/detail/PlantIdentityCard'
import { PlantPlanSection } from '@/components/plants/detail/PlantPlanSection'
import { PlantActionsBar } from '@/components/plants/detail/PlantActionsBar'
import { DeletePlantDialog } from '@/components/plants/detail/DeletePlantDialog'
import { WaterTodayDialog } from '@/components/plants/detail/WaterTodayDialog'
import {
  buildPlantActionsVm,
  getTodayIsoDate,
} from '@/lib/services/plants/detail-view-model'

type PlantDetailViewProps = {
  plantId: string
}

export const PlantDetailView: FC<PlantDetailViewProps> = ({ plantId }) => {
  const { status, plant, viewModel, error, reload } = usePlantDetail({ plantId })
  const [waterSuccessMessage, setWaterSuccessMessage] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [waterDialogOpen, setWaterDialogOpen] = useState(false)
  const [waterNote, setWaterNote] = useState('')

  const {
    pendingWaterToday,
    pendingDelete,
    waterError,
    deleteError,
    waterToday,
    deletePlant,
    clearWaterError,
    clearDeleteError,
  } = usePlantDetailMutations({ plantId })

  const actionsVm = useMemo(
    () => (viewModel ? buildPlantActionsVm(viewModel) : null),
    [viewModel],
  )
  const fallbackCalendarHref = useMemo(() => `/calendar/day/${getTodayIsoDate()}`, [])
  const calendarHref = actionsVm?.calendarHref ?? fallbackCalendarHref
  const calendarLabel = actionsVm?.calendarLabel

  const loginHref = useMemo(
    () => `/auth/login?returnTo=${encodeURIComponent(`/plants/${plantId}`)}`,
    [plantId],
  )

  useEffect(() => {
    if (!waterSuccessMessage) return
    if (typeof window === 'undefined') return
    const timer = window.setTimeout(() => setWaterSuccessMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [waterSuccessMessage])

  const handleWaterDialogOpen = useCallback(() => {
    clearWaterError()
    setWaterSuccessMessage(null)
    setWaterDialogOpen(true)
  }, [clearWaterError])

  const handleWaterDialogChange = useCallback(
    (open: boolean) => {
      if (!open) {
        clearWaterError()
      }
      setWaterDialogOpen(open)
    },
    [clearWaterError],
  )

  const handleWaterConfirm = useCallback(async () => {
    clearWaterError()
    setWaterSuccessMessage(null)
    const payload = waterNote.trim().length > 0 ? waterNote.trim() : undefined
    const result = await waterToday(payload)
    if (result.ok) {
      setWaterDialogOpen(false)
      setWaterNote('')
      setWaterSuccessMessage('Zapisano podlewanie na dziś.')
    }
  }, [clearWaterError, waterNote, waterToday])

  const handleDeleteClick = useCallback(() => {
    clearDeleteError()
    setDeleteDialogOpen(true)
  }, [clearDeleteError])

  const handleDeleteConfirm = useCallback(async () => {
    const result = await deletePlant()
    if (result.ok) {
      setDeleteDialogOpen(false)
      if (typeof window !== 'undefined') {
        window.location.href = '/plants'
      }
    }
  }, [deletePlant])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      clearDeleteError()
    }
    setDeleteDialogOpen(open)
  }, [clearDeleteError])

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6" aria-live="polite">
      <PlantDetailHeader backHref="/plants" />

      {status === 'error' && error ? (
        <PlantDetailErrorState
          error={error}
          onRetry={reload}
          loginHref={loginHref}
          backHref="/plants"
        />
      ) : null}

      {status === 'loading' ? <PlantDetailSkeleton /> : null}

      {status === 'success' && plant && viewModel && actionsVm ? (
        <div className="space-y-6">
          <PlantIdentityCard plant={viewModel.plant} />
          <PlantPlanSection
            activePlan={viewModel.activePlan}
            changePlanHref={actionsVm.changePlanHref}
            generateAiHref={actionsVm.generateAiHref}
            setManualHref={actionsVm.setManualHref}
          />
          <PlantActionsBar
            calendarHref={actionsVm.calendarHref}
            calendarLabel={calendarLabel}
            editHref={actionsVm.editHref}
            pendingWaterToday={pendingWaterToday}
            pendingDelete={pendingDelete}
            onWaterTodayClick={handleWaterDialogOpen}
            onDeleteClick={handleDeleteClick}
          />
        </div>
      ) : null}

      {waterSuccessMessage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-700">
          <p>{waterSuccessMessage}</p>
          <Button size="sm" variant="outline" asChild>
            <a href={calendarHref}>Zobacz dzień</a>
          </Button>
        </div>
      ) : null}

      <DeletePlantDialog
        open={deleteDialogOpen}
        plantDisplayName={plant?.plant.display_name ?? 'roślina'}
        pending={pendingDelete}
        error={deleteError}
        onOpenChange={handleDialogOpenChange}
        onConfirm={handleDeleteConfirm}
      />

      <WaterTodayDialog
        open={waterDialogOpen}
        note={waterNote}
        pending={pendingWaterToday}
        error={waterError}
        onOpenChange={handleWaterDialogChange}
        onNoteChange={setWaterNote}
        onConfirm={handleWaterConfirm}
        calendarHref={calendarHref}
      />
    </main>
  )
}

PlantDetailView.displayName = 'PlantDetailView'

