import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/modal'
import type { CalendarDayTaskVm } from '@/lib/services/calendar/day-view-model'

type ConfirmDeleteDialogProps = {
  open: boolean
  task: CalendarDayTaskVm
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (taskId: string) => Promise<void> | void
}

const getDialogCopy = (task: CalendarDayTaskVm) => {
  if (task.isAdhoc) {
    return {
      title: 'Usuń wpis ad hoc',
      description: 'Czy na pewno chcesz usunąć ten wpis? Operacja jest nieodwracalna.',
      confirmLabel: 'Usuń wpis',
    }
  }

  return {
    title: 'Cofnij ukończone zadanie',
    description:
      'Usunięcie wpisu przywróci zaplanowane zadanie do statusu "Do wykonania" oraz usunie notatkę.',
    confirmLabel: 'Cofnij oznaczenie',
  }
}

export const ConfirmDeleteDialog = ({
  open,
  task,
  pending,
  onOpenChange,
  onConfirm,
}: ConfirmDeleteDialogProps) => {
  const titleId = useId()
  const copy = getDialogCopy(task)

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} labelledBy={titleId}>
      <ModalHeader>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Potwierdzenie operacji</p>
          <h2 id={titleId} className="text-2xl font-semibold">
            {copy.title}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </ModalHeader>

      <ModalBody>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">{task.plantDisplayName}</p>
          {task.note && (
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{task.note}</p>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Anuluj
        </Button>
        <Button
          type="button"
          variant={task.isAdhoc ? 'destructive' : 'default'}
          onClick={() => onConfirm(task.id)}
          disabled={pending}
        >
          {copy.confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

ConfirmDeleteDialog.displayName = 'ConfirmDeleteDialog'
