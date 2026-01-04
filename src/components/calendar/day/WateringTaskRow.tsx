import { Button } from '@/components/ui/button'
import type { CalendarDayTaskVm } from '@/lib/services/calendar/day-view-model'
import { cn } from '@/lib/utils'

type WateringTaskRowProps = {
  task: CalendarDayTaskVm
  isPending?: boolean
  isHighlighted?: boolean
  onConfirm?: (task: CalendarDayTaskVm) => void
  onUndo?: (task: CalendarDayTaskVm) => void
  onEdit?: (task: CalendarDayTaskVm) => void
  onDelete?: (task: CalendarDayTaskVm) => void
}

const statusMeta: Record<
  CalendarDayTaskVm['status'],
  { label: string; className: string }
> = {
  pending: {
    label: 'Do wykonania',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100',
  },
  completed: {
    label: 'Ukończone',
    className:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100',
  },
}

export const WateringTaskRow = ({
  task,
  isPending,
  isHighlighted,
  onConfirm,
  onUndo,
  onEdit,
  onDelete,
}: WateringTaskRowProps) => {
  const canConfirm = task.status === 'pending'
  const canUndo = task.status === 'completed' && task.isScheduled
  const canDelete = task.isAdhoc || (task.isScheduled && task.status === 'completed')

  const handleConfirm = () => {
    if (!canConfirm || !onConfirm || isPending) return
    onConfirm(task)
  }

  const handleUndo = () => {
    if (!canUndo || !onUndo || isPending) return
    onUndo(task)
  }

  const handleEdit = () => {
    if (!onEdit || isPending) return
    onEdit(task)
  }

  const handleDelete = () => {
    if (!canDelete || !onDelete || isPending) return
    onDelete(task)
  }

  return (
    <li
      id={`plant-${task.plantId}`}
      className={cn(
        'rounded-xl border bg-card p-4 shadow-sm transition',
        'hover:border-primary/60',
        isHighlighted && 'ring-2 ring-primary/40',
        isPending && 'opacity-70',
      )}
      tabIndex={-1}
    >
      <article className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">
              {task.plantDisplayName}
            </p>
            {task.plantNickname && (
              <p className="text-sm text-muted-foreground">{task.plantNickname}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold',
                statusMeta[task.status].className,
              )}
            >
              {statusMeta[task.status].label}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {task.sourceLabel}
            </span>
          </div>
        </div>

        {task.note && (
          <p className="text-sm text-muted-foreground whitespace-pre-line">{task.note}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {canConfirm && (
            <Button size="sm" onClick={handleConfirm} disabled={isPending}>
              Potwierdź
            </Button>
          )}

          {canUndo && (
            <Button size="sm" variant="secondary" onClick={handleUndo} disabled={isPending}>
              Cofnij
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleEdit}
            disabled={isPending || !onEdit}
          >
            Edytuj
          </Button>

          {canDelete && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              Usuń wpis
            </Button>
          )}
        </div>

        {isPending && (
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            Zapisywanie zmian…
          </p>
        )}
      </article>
    </li>
  )
}

WateringTaskRow.displayName = 'WateringTaskRow'
