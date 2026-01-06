import { useCallback, useEffect, useState } from 'react'
import type { FC } from 'react'

import type { PlantDetailMutationErrorVm } from '@/components/plants/detail/types'
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
  error?: PlantDetailMutationErrorVm | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
}

export const DeletePlantDialog: FC<DeletePlantDialogProps> = ({
  open,
  plantDisplayName,
  pending,
  error,
  onOpenChange,
  onConfirm,
}) => {
  const [confirmationChecked, setConfirmationChecked] = useState(false)

  useEffect(() => {
    if (!open) {
      setConfirmationChecked(false)
    }
  }, [open])

  const handleConfirm = useCallback(async () => {
    await onConfirm()
  }, [onConfirm])

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} labelledBy="delete-plant-title">
      <ModalHeader>
        <p className="text-sm uppercase tracking-widest text-destructive">Usuwanie rośliny</p>
        <h2 id="delete-plant-title" className="text-2xl font-semibold text-foreground">
          Czy na pewno chcesz usunąć “{plantDisplayName}”?
        </h2>
      </ModalHeader>
      <ModalBody>
        <p className="text-base text-muted-foreground">
          Ta operacja jest nieodwracalna i usunie wszystkie powiązane dane planów oraz historii
          podlewania. Zaznacz potwierdzenie, aby kontynuować.
        </p>
        <label className="flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-border"
            checked={confirmationChecked}
            onChange={(event) => setConfirmationChecked(event.target.checked)}
            disabled={pending}
          />
          Rozumiem konsekwencje i chcę usunąć tę roślinę.
        </label>
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
            {error.code ? (
              <p className="text-xs text-destructive/80">Kod błędu: {error.code}</p>
            ) : null}
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Anuluj
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={!confirmationChecked || pending}
        >
          {pending ? 'Usuwanie…' : 'Usuń roślinę'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

DeletePlantDialog.displayName = 'DeletePlantDialog'

