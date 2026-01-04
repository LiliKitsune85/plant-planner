import { useEffect, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/modal'
import type { AdhocWateringCommand, PlantListItemDto } from '@/types'

import { PlantPicker } from './PlantPicker'

type AdhocWateringDialogProps = {
  open: boolean
  defaultCompletedOn: string
  pending?: boolean
  error?: {
    message: string
    fieldErrors?: Record<string, string[]>
  } | null
  onOpenChange: (open: boolean) => void
  onSubmit: (plantId: string, command: AdhocWateringCommand) => Promise<void> | void
}

type FieldErrors = Record<string, string[]>

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const AdhocWateringDialog = ({
  open,
  defaultCompletedOn,
  pending,
  error,
  onOpenChange,
  onSubmit,
}: AdhocWateringDialogProps) => {
  const titleId = useId()
  const [selectedPlant, setSelectedPlant] = useState<PlantListItemDto | null>(null)
  const [completedOn, setCompletedOn] = useState(defaultCompletedOn)
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCompletedOn(defaultCompletedOn)
    setNote('')
    setFieldErrors({})
    setFormError(null)
  }, [defaultCompletedOn, open])

  useEffect(() => {
    if (error?.fieldErrors) {
      setFieldErrors(error.fieldErrors)
    }
    if (error && !error.fieldErrors) {
      setFormError(error.message)
    }
  }, [error])

  const validate = (): boolean => {
    const nextFieldErrors: FieldErrors = {}
    let nextFormError: string | null = null

    if (!selectedPlant) {
      nextFieldErrors.plant = ['Wybierz roślinę do wpisu.']
    }

    if (!completedOn || !ISO_DATE_REGEX.test(completedOn)) {
      nextFieldErrors.completed_on = ['Podaj poprawną datę wykonania w formacie RRRR-MM-DD.']
    }

    if (note.trim().length > 500) {
      nextFieldErrors.note = ['Notatka nie może przekraczać 500 znaków.']
    }

    setFieldErrors(nextFieldErrors)
    setFormError(nextFormError)

    return Object.keys(nextFieldErrors).length === 0 && !nextFormError
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (!validate() || !selectedPlant) {
      return
    }

    const command: AdhocWateringCommand = {
      completed_on: completedOn,
      note: note.trim() === '' ? null : note.trim(),
    }

    await onSubmit(selectedPlant.id, command)
  }

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <ModalHeader>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Nowy wpis</p>
            <h2 id={titleId} className="text-2xl font-semibold">
              Dodaj podlewanie ad hoc
            </h2>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </ModalHeader>

        <ModalBody>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Roślina</label>
            <PlantPicker value={selectedPlant} onChange={setSelectedPlant} disabled={pending} />
            {fieldErrors.plant && (
              <p className="text-sm text-destructive">{fieldErrors.plant.join(' ')}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Data wykonania</label>
            <input
              type="date"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={completedOn}
              onChange={(event) => setCompletedOn(event.target.value)}
              disabled={pending}
            />
            {fieldErrors.completed_on && (
              <p className="text-sm text-destructive">{fieldErrors.completed_on.join(' ')}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Notatka (opcjonalnie)</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={pending}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Pozostało {500 - note.length} znaków
            </p>
            {fieldErrors.note && (
              <p className="text-sm text-destructive">{fieldErrors.note.join(' ')}</p>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Anuluj
          </Button>
          <Button type="submit" disabled={pending}>
            Dodaj wpis
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

AdhocWateringDialog.displayName = 'AdhocWateringDialog'
