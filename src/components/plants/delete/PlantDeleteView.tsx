import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'

import { useDeletePlantMutation } from '@/components/hooks/use-delete-plant-mutation'
import { usePlantDelete } from '@/components/hooks/use-plant-delete'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DeletePlantDialog } from '@/components/plants/delete/DeletePlantDialog'
import { PlantDeleteErrorState } from '@/components/plants/delete/PlantDeleteErrorState'
import { PlantDeleteSkeleton } from '@/components/plants/delete/PlantDeleteSkeleton'
import { savePlantDeletedFlashMessage } from '@/lib/services/plants/delete-flash'
import { isValidPlantId } from '@/lib/services/plants/delete-view-model'

import type { PlantDeleteVm } from './types'

export type PlantDeleteViewProps = {
  plantId: string
}

const PLANTS_LIST_HREF = '/plants'
const CALENDAR_FALLBACK_HREF = '/calendar'

type DeleteSuccessState = {
  plantName: string
  requestId?: string
  redirectHref: string
}

const buildLoginHref = (plantId: string): string =>
  `/auth/login?returnTo=${encodeURIComponent(`/plants/${plantId}/delete`)}`

const resolvePlantDetailHref = (plantId: string, data?: PlantDeleteVm | null): string => {
  if (data?.plant.id) {
    return `/plants/${data.plant.id}`
  }
  if (isValidPlantId(plantId)) {
    return `/plants/${plantId}`
  }
  return CALENDAR_FALLBACK_HREF
}

const buildSuccessRedirectHref = (): string => PLANTS_LIST_HREF || CALENDAR_FALLBACK_HREF

export const PlantDeleteView: FC<PlantDeleteViewProps> = ({ plantId }) => {
  const {
    status,
    data,
    error: loadError,
    requestId: loadRequestId,
    reload,
  } = usePlantDelete({ plantId })
  const {
    pending,
    error: mutationError,
    deletePlant,
    resetError,
    cancel,
  } = useDeletePlantMutation({ plantId })

  const [dialogOpen, setDialogOpen] = useState(true)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [successState, setSuccessState] = useState<DeleteSuccessState | null>(null)

  const loginHref = useMemo(() => buildLoginHref(plantId), [plantId])
  const detailHref = useMemo(() => resolvePlantDetailHref(plantId, data), [plantId, data])

  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])

  useEffect(() => {
    if (!dialogOpen) {
      setConfirmChecked(false)
    }
  }, [dialogOpen])

  useEffect(() => {
    setSuccessState(null)
    setDialogOpen(true)
    setConfirmChecked(false)
    resetError()
  }, [plantId, resetError])

  useEffect(() => {
    if (!successState) return
    if (typeof window === 'undefined') return
    const timer = window.setTimeout(() => {
      window.location.href = successState.redirectHref
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [successState])

  const navigateBack = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.href = detailHref
  }, [detailHref])

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (pending) return
        cancel()
        resetError()
        setDialogOpen(false)
        setConfirmChecked(false)
        navigateBack()
        return
      }
      setDialogOpen(true)
    },
    [cancel, navigateBack, pending, resetError],
  )

  const handleConfirm = useCallback(async () => {
    const result = await deletePlant()
    if (result.ok) {
      const plantName = data?.plant.displayName ?? 'roślinę'
      savePlantDeletedFlashMessage({ plantName, requestId: result.requestId })
      const redirectHref = buildSuccessRedirectHref()
      setDialogOpen(false)
      setSuccessState({
        plantName,
        requestId: result.requestId,
        redirectHref,
      })
      setConfirmChecked(false)
      return
    }
    if (result.kind === 'aborted') {
      return
    }
    // error state is already handled via mutationError
  }, [data, deletePlant])

  const renderSuccessCard = () => {
    if (!successState) return null
    return (
      <Card className="border-emerald-400/40 bg-emerald-50 text-emerald-900">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Usunięto roślinę</CardTitle>
          <CardDescription className="text-sm text-emerald-800/90">
            „{successState.plantName}” została usunięta wraz z harmonogramem. Za chwilę przekierujemy Cię na
            listę roślin.
            {successState.requestId ? (
              <span className="mt-2 block text-xs text-emerald-800/70">
                ID żądania: {successState.requestId}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-3">
          <Button variant="default" asChild>
            <a href={PLANTS_LIST_HREF}>Przejdź teraz do listy</a>
          </Button>
          <Button variant="outline" asChild>
            <a href={CALENDAR_FALLBACK_HREF}>Przejdź do kalendarza</a>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6" aria-live="polite">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground">Usuń roślinę</CardTitle>
          <CardDescription>
            Operacja natychmiast usuwa roślinę oraz wszystkie jej zadania i plan podlewania. Potwierdź, że
            rozumiesz konsekwencje, zanim przejdziesz dalej.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Jeżeli dotarłeś do tej strony przypadkowo, możesz wrócić do{' '}
            <a href={detailHref} className="text-primary underline">
              szczegółów rośliny
            </a>{' '}
            lub{' '}
            <a href={PLANTS_LIST_HREF} className="text-primary underline">
              listy roślin
            </a>
            .
          </p>
          {loadRequestId ? (
            <p className="mt-2 text-xs text-muted-foreground/80">ID żądania: {loadRequestId}</p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <a href={detailHref}>Wróć do rośliny</a>
          </Button>
          <Button variant="ghost" asChild>
            <a href={PLANTS_LIST_HREF}>Lista roślin</a>
          </Button>
        </CardFooter>
      </Card>

      {status === 'loading' ? <PlantDeleteSkeleton /> : null}

      {status === 'error' && loadError ? (
        <PlantDeleteErrorState
          error={loadError}
          onRetry={reload}
          onBack={navigateBack}
          loginHref={loginHref}
        />
      ) : null}

      {status === 'success' && data && !successState ? (
        <DeletePlantDialog
          open={dialogOpen}
          plantDisplayName={data.plant.displayName}
          pending={pending}
          confirmChecked={confirmChecked}
          error={mutationError}
          onOpenChange={handleDialogOpenChange}
          onConfirm={handleConfirm}
          onConfirmCheckedChange={setConfirmChecked}
        />
      ) : null}

      {renderSuccessCard()}
    </main>
  )
}

PlantDeleteView.displayName = 'PlantDeleteView'

