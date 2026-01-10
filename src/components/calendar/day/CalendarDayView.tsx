import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CalendarErrorState } from '@/components/calendar/shared/CalendarErrorState'
import { CalendarStatusFilter } from '@/components/calendar/shared/CalendarStatusFilter'
import { useCalendarDay } from '@/components/hooks/use-calendar-day'
import { useWateringTaskMutations } from '@/components/hooks/use-watering-task-mutations'
import { Button } from '@/components/ui/button'
import type {
  CalendarTaskSortField,
  CalendarTaskStatusFilter,
  SortOrder,
} from '@/lib/services/calendar/types'
import {
  buildCalendarDayHeaderVm,
  buildCalendarDayStatusFilterOptions,
  buildCalendarDaySortOptions,
  buildCalendarDayOrderOptions,
} from '@/lib/services/calendar/day-view-model'

import { AdhocWateringDialog } from './AdhocWateringDialog'
import { CalendarDayEmptyState } from './CalendarDayEmptyState'
import { CalendarDaySkeleton } from './CalendarDaySkeleton'
import { CalendarDayTaskList } from './CalendarDayTaskList'
import { CalendarDaySortControls } from './CalendarDaySortControls'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { EditWateringEntryDialog } from './EditWateringEntryDialog'

type HighlightSource = 'url' | 'conflict' | 'manual'

type CalendarDayViewProps = {
  date: string
  status?: CalendarTaskStatusFilter
  sort?: CalendarTaskSortField
  order?: SortOrder
}

export const CalendarDayView = ({
  date,
  status,
  sort,
  order,
}: CalendarDayViewProps) => {
  const { status: fetchStatus, data, error, reload } = useCalendarDay({
    date,
    status,
    sort,
    order,
  })
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [adhocOpen, setAdhocOpen] = useState(false)
  const [highlightPlantId, setHighlightPlantId] = useState<string | undefined>(undefined)
  const [highlightSource, setHighlightSource] = useState<HighlightSource | null>(null)
  const [loginHref, setLoginHref] = useState('/auth/login')
  const highlightInitRef = useRef(false)
  const scrollTimeoutRef = useRef<number | null>(null)

  const updateHighlightInUrl = useCallback((plantId?: string) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (plantId) {
      url.searchParams.set('highlightPlantId', plantId)
      url.hash = `plant-${plantId}`
    } else {
      url.searchParams.delete('highlightPlantId')
      url.hash = ''
    }
    window.history.replaceState({}, '', url)
  }, [])

  const setHighlight = useCallback(
    (plantId?: string, source: HighlightSource = 'manual') => {
      setHighlightPlantId(plantId)
      setHighlightSource(plantId ? source : null)
      updateHighlightInUrl(plantId)
    },
    [updateHighlightInUrl],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || highlightInitRef.current) return
    highlightInitRef.current = true
    const params = new URLSearchParams(window.location.search)
    const paramHighlight = params.get('highlightPlantId')
    const hashHighlight = window.location.hash.startsWith('#plant-')
      ? window.location.hash.replace('#plant-', '')
      : undefined
    const initialHighlight = paramHighlight ?? hashHighlight
    if (initialHighlight) {
      setHighlight(initialHighlight, 'url')
    }
  }, [setHighlight])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setLoginHref(
      `/auth/login?returnTo=${encodeURIComponent(
        `${window.location.pathname}${window.location.search}`,
      )}`,
    )
  }, [])

  const mutationDate = data?.date ?? date

  const mutations = useWateringTaskMutations({
    date: mutationDate,
    onReload: reload,
  })

  useEffect(() => {
    if (data?.items) {
      mutations.acknowledgeServerState(data.items)
    }
  }, [data?.items, mutations])

  useEffect(() => {
    if (
      mutations.error?.code === 'TASK_ALREADY_EXISTS' &&
      mutations.error.plantId
    ) {
      setHighlight(mutations.error.plantId, 'conflict')
    }
  }, [mutations.error, setHighlight])

  if (fetchStatus === 'error' && error) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <CalendarErrorState
          error={error}
          onRetry={reload}
          title="Nie udało się wczytać listy zadań"
          validationCtaHref="/calendar/day"
          validationCtaLabel="Przejdź do dzisiejszego dnia"
          loginHref={loginHref}
          loginCtaLabel="Zaloguj się ponownie"
        />
      </main>
    )
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <CalendarDaySkeleton />
      </main>
    )
  }

  const headerVm = buildCalendarDayHeaderVm(data)
  const statusOptions = buildCalendarDayStatusFilterOptions(data)
  const sortOptions = buildCalendarDaySortOptions(data)
  const orderOptions = buildCalendarDayOrderOptions(data)
  const mergedTasks = useMemo(
    () =>
      data.items.map((task) => mutations.optimisticTasks[task.id] ?? task),
    [data.items, mutations.optimisticTasks],
  )
  const mergedTaskIdsKey = useMemo(
    () => mergedTasks.map((task) => task.id).join('|'),
    [mergedTasks],
  )

  useEffect(() => {
    if (!highlightPlantId || typeof window === 'undefined') return
    const element = document.getElementById(`plant-${highlightPlantId}`)
    if (!element) return
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current)
    }
    const timeoutId = window.setTimeout(() => {
      element.scrollIntoView({
        behavior: highlightSource === 'url' ? 'auto' : 'smooth',
        block: 'center',
      })
      if ('focus' in element) {
        ;(element as HTMLElement).focus({ preventScroll: true })
      }
    }, 80)
    scrollTimeoutRef.current = timeoutId
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [highlightPlantId, highlightSource, mergedTaskIdsKey])

  const editingTask = mergedTasks.find((task) => task.id === editingTaskId) ?? null
  const deletingTask = mergedTasks.find((task) => task.id === deletingTaskId) ?? null

  const activeError = mutations.error
  const editError =
    editingTaskId &&
    activeError?.taskId === editingTaskId &&
    activeError.kind === 'validation'
      ? activeError
      : null
  const adhocDialogError =
    adhocOpen && activeError?.plantId ? activeError : null
  const suppressInline =
    (editError && activeError === editError) ||
    (adhocDialogError &&
      activeError === adhocDialogError &&
      activeError.kind === 'validation')
  const inlineError = suppressInline ? null : activeError

  const highlightConflict = useCallback(
    (plantId: string) => {
      setHighlight(plantId, 'conflict')
    },
    [setHighlight],
  )

  const mutationAlert = useMemo(() => {
    if (!inlineError) return null

    if (inlineError.kind === 'unauthenticated') {
      return {
        variant: 'danger' as const,
        title: 'Sesja wygasła',
        description: 'Zaloguj się ponownie, aby zarządzać wpisami podlewania.',
        primary: {
          label: 'Przejdź do logowania',
          handler: () => {
            if (typeof window !== 'undefined') {
              window.location.assign(loginHref)
            }
          },
        },
      }
    }

    if (inlineError.kind === 'notFound') {
      return {
        variant: 'info' as const,
        title: 'Nie znaleziono wpisu',
        description: 'Wygląda na to, że zadanie zostało usunięte. Odśwież widok i spróbuj ponownie.',
        primary: {
          label: 'Odśwież listę',
          handler: reload,
        },
      }
    }

    if (
      inlineError.kind === 'conflict' &&
      inlineError.code === 'TASK_ALREADY_EXISTS' &&
      inlineError.plantId
    ) {
      return {
        variant: 'warning' as const,
        title: 'Wpis już istnieje',
        description: 'Na ten dzień istnieje już wpis podlewania dla tej rośliny.',
        primary: {
          label: 'Pokaż na liście',
          handler: () => highlightConflict(inlineError.plantId as string),
        },
      }
    }

    if (inlineError.kind === 'network') {
      return {
        variant: 'warning' as const,
        title: 'Brak połączenia',
        description: 'Sprawdź połączenie z internetem i ponów próbę.',
        primary: {
          label: 'Spróbuj ponownie',
          handler: reload,
        },
      }
    }

    return {
      variant: inlineError.kind === 'validation' ? ('warning' as const) : ('danger' as const),
      title: 'Nie udało się zapisać zmian',
      description: inlineError.message,
      primary: {
        label: 'Spróbuj ponownie',
        handler: reload,
      },
    }
  }, [highlightConflict, inlineError, loginHref, reload])

  const handleAlertAction = useCallback(
    (action?: () => void) => () => {
      action?.()
      mutations.clearError()
    },
    [mutations],
  )

  const mutationAlertClasses: Record<string, string> = {
    danger: 'border-destructive/40 bg-destructive/10 text-destructive',
    warning: 'border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100',
    info: 'border-primary/30 bg-primary/5 text-primary',
  }

  const handleEditSubmit = async (command: Parameters<typeof mutations.editTask>[1]) => {
    if (!editingTask) return
    await mutations.editTask(editingTask, command)
    setEditingTaskId(null)
  }

  const handleDeleteConfirm = async (taskId: string) => {
    const task = mergedTasks.find((item) => item.id === taskId)
    if (!task) return
    await mutations.deleteTask(task)
    setDeletingTaskId(null)
  }

  const handleAdhocSubmit = async (
    plantId: string,
    command: Parameters<typeof mutations.createAdhoc>[1],
  ) => {
    await mutations.createAdhoc(plantId, command)
    setAdhocOpen(false)
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm uppercase text-muted-foreground">{headerVm.weekdayLabel}</p>
          <h1 className="text-3xl font-bold tracking-tight">{headerVm.dateLabel}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/calendar/day">Dziś</a>
          </Button>
          <Button asChild variant="link" className="px-0 text-primary">
            <a href={headerVm.monthHref}>&larr; Powrót do widoku miesiąca</a>
          </Button>
        </div>
      </header>

      <CalendarStatusFilter options={statusOptions} />
      <CalendarDaySortControls sortOptions={sortOptions} orderOptions={orderOptions} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.hasTasks
            ? 'Zarządzaj wpisami z danego dnia.'
            : 'Brak wpisów — dodaj wpis ad hoc lub zmień filtr.'}
        </p>
        <Button onClick={() => setAdhocOpen(true)} disabled={mutations.globalPending}>
          Dodaj wpis ad hoc
        </Button>
      </div>

      {mutationAlert && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm ${mutationAlertClasses[mutationAlert.variant]}`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold">{mutationAlert.title}</p>
              <p>{mutationAlert.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {mutationAlert.primary && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAlertAction(mutationAlert.primary.handler)}
                >
                  {mutationAlert.primary.label}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => mutations.clearError()}>
                Ukryj
              </Button>
            </div>
          </div>
        </div>
      )}

      {data.hasTasks ? (
        <CalendarDayTaskList
          items={mergedTasks}
          pendingByTaskId={mutations.pendingByTaskId}
          highlightPlantId={highlightPlantId}
          onConfirm={(task) => mutations.confirmTask(task)}
          onUndo={(task) => mutations.undoTask(task)}
          onEdit={(task) => setEditingTaskId(task.id)}
          onDelete={(task) => {
            if (!task.isAdhoc && task.status !== 'completed') {
              return
            }
            setDeletingTaskId(task.id)
          }}
        />
      ) : (
        <CalendarDayEmptyState
          date={data.date}
          status={data.status}
          onAddAdhoc={() => setAdhocOpen(true)}
          disableAdhoc={mutations.globalPending}
        />
      )}

      {editingTask && (
        <EditWateringEntryDialog
          open={Boolean(editingTask)}
          task={editingTask}
          dateContext={data.date}
          pending={Boolean(mutations.pendingByTaskId[editingTask.id])}
          error={
            editError
              ? { message: editError.message, fieldErrors: editError.fieldErrors }
              : null
          }
          onOpenChange={(open) => {
            if (!open) setEditingTaskId(null)
          }}
          onSubmit={handleEditSubmit}
        />
      )}

      {deletingTask && (
        <ConfirmDeleteDialog
          open={Boolean(deletingTask)}
          task={deletingTask}
          pending={Boolean(mutations.pendingByTaskId[deletingTask.id])}
          onOpenChange={(open) => {
            if (!open) setDeletingTaskId(null)
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}

      <AdhocWateringDialog
        open={adhocOpen}
        defaultCompletedOn={data.date}
        pending={mutations.globalPending}
        error={
          adhocDialogError
            ? { message: adhocDialogError.message, fieldErrors: adhocDialogError.fieldErrors }
            : null
        }
        onOpenChange={setAdhocOpen}
        onSubmit={handleAdhocSubmit}
      />
    </main>
  )
}

CalendarDayView.displayName = 'CalendarDayView'
