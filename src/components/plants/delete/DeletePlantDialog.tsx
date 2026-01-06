import { useCallback, useId } from 'react'
import type { FC } from 'react'

import type { DeletePlantMutationErrorVm } from '@/components/plants/delete/types'
import { Button } from '@/components/ui/button'
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/modal'

export type DeletePlantDialogProps = {
  open: boolean
  plantDisplayName: string
  pending: boolean
  confirmChecked: boolean
  error?: DeletePlantMutationErrorVm | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  onConfirmCheckedChange: (checked: boolean) => void
}

export const DeletePlantDialog: FC<DeletePlantDialogProps> = ({
  open,
  plantDisplayName,
  pending,
  confirmChecked,
  error,
  onOpenChange,
  onConfirm,
  onConfirmCheckedChange,
}) => {
  const checkboxId = useId()
  const handleRequestClose = useCallback(() => {
    if (pending) return
    onOpenChange(false)
  }, [onOpenChange, pending])

  const handleConfirm = useCallback(() => {
    void onConfirm()
  }, [onConfirm])

  return (
    <Modal open={open} onClose={handleRequestClose} labelledBy="plant-delete-dialog-title">
      <ModalHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-destructive">
          Potwierdzenie operacji
        </p>
        <h2 id="plant-delete-dialog-title" className="text-2xl font-semibold text-foreground">
          Usuń roślinę
        </h2>
        <p id="plant-delete-dialog-description" className="text-sm text-muted-foreground">
          Operacja jest nieodwracalna. Usuniesz roślinę oraz jej plan i zadania.
        </p>
      </ModalHeader>
      <ModalBody className="space-y-6">
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Wybrana roślina</p>
          <p className="mt-2 text-lg font-medium text-foreground">„{plantDisplayName}”</p>
          <p className="text-xs text-muted-foreground">Po usunięciu nie będzie możliwości odzyskania danych.</p>
        </div>
        <label htmlFor={checkboxId} className="flex items-start gap-3 text-sm text-foreground">
          <input
            id={checkboxId}
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            checked={confirmChecked}
            onChange={(event) => onConfirmCheckedChange(event.target.checked)}
            disabled={pending}
          />
          <span>Rozumiem, że operacja jest nieodwracalna i chcę usunąć tę roślinę.</span>
        </label>
        {error ? (
          <div
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <p>{error.message}</p>
            {error.code ? <p className="text-xs text-destructive/80">Kod błędu: {error.code}</p> : null}
            {error.requestId ? (
              <p className="text-xs text-destructive/70">ID żądania: {error.requestId}</p>
            ) : null}
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={handleRequestClose} disabled={pending}>
          Anuluj
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={!confirmChecked || pending}
        >
          {pending ? 'Usuwanie…' : 'Usuń roślinę'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

DeletePlantDialog.displayName = 'DeletePlantDialog'

