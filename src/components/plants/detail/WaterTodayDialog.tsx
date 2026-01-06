import { useMemo } from 'react'
import type { FC } from 'react'

import type { PlantDetailMutationErrorVm } from '@/components/plants/detail/types'
import { Button } from '@/components/ui/button'
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'

export type WaterTodayDialogProps = {
  open: boolean
  note: string
  pending: boolean
  error?: PlantDetailMutationErrorVm | null
  onOpenChange: (open: boolean) => void
  onNoteChange: (note: string) => void
  onConfirm: () => Promise<void> | void
  calendarHref: string
}

const NOTE_LIMIT = 500

export const WaterTodayDialog: FC<WaterTodayDialogProps> = ({
  open,
  note,
  pending,
  error,
  onOpenChange,
  onNoteChange,
  onConfirm,
  calendarHref,
}) => {
  const remaining = useMemo(() => Math.max(0, NOTE_LIMIT - note.length), [note.length])

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} labelledBy="water-today-title">
      <ModalHeader>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Podlej dzisiaj</p>
        <h2 id="water-today-title" className="text-2xl font-semibold text-foreground">
          Zapisz dzisiejsze podlewanie
        </h2>
      </ModalHeader>
      <ModalBody>
        <p className="text-base text-muted-foreground">
          Możesz dodać krótką notatkę (opcjonalnie), aby zapamiętać dodatkowe szczegóły, np. ilość wody
          lub nawóz.
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Notatka (opcjonalna)</span>
          <Textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value.slice(0, NOTE_LIMIT))}
            placeholder="np. Dodałem odżywkę, ziemia była sucha"
            rows={4}
            disabled={pending}
          />
          <span className="text-xs text-muted-foreground text-right">Pozostało {remaining} znaków</span>
        </label>
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
            {error.code === 'TASK_ALREADY_EXISTS' ? (
              <p className="mt-2 text-xs">
                Wejdź do{' '}
                <a href={calendarHref} className="underline">
                  kalendarza
                </a>{' '}
                aby zobaczyć wcześniejszy wpis.
              </p>
            ) : null}
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Anuluj
        </Button>
        <Button onClick={() => void onConfirm()} disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz podlewanie'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

WaterTodayDialog.displayName = 'WaterTodayDialog'

