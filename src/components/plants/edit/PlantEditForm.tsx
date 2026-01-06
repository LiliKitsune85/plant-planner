import { useCallback } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import type {
  PlantEditDirtyState,
  PlantEditFormErrors,
  PlantEditFormValues,
} from './types'

const FIELD_METADATA = {
  speciesName: {
    label: 'Nazwa gatunku',
    description: 'Pole jest tylko do odczytu w MVP.',
  },
  nickname: {
    label: 'Pseudonim (opcjonalnie)',
    description: 'Pomaga rozróżnić rośliny tego samego gatunku.',
  },
  description: {
    label: 'Opis (opcjonalnie)',
    description: 'Dowolne notatki o pielęgnacji, obserwacjach itp.',
  },
  purchaseDate: {
    label: 'Data zakupu (opcjonalnie)',
    description: 'Format RRRR-MM-DD. Ułatwia śledzenie historii rośliny.',
  },
  photoPath: {
    label: 'Ścieżka do zdjęcia (opcjonalnie)',
    description:
      'Wklej względną ścieżkę z magazynu (bez http/https, bez wiodącego ukośnika).',
  },
} as const

const buildErrorId = (field: string) => `plant-edit-${field}-errors`

type PlantEditFormProps = {
  values: PlantEditFormValues
  errors: PlantEditFormErrors
  pending: boolean
  dirtyState: PlantEditDirtyState
  onChange: (patch: Partial<PlantEditFormValues>) => void
  onSubmit: () => void
  onCancel: () => void
}

export const PlantEditForm = ({
  values,
  errors,
  pending,
  dirtyState,
  onChange,
  onSubmit,
  onCancel,
}: PlantEditFormProps) => {
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (pending) return
      onSubmit()
    },
    [onSubmit, pending],
  )

  const handleFieldChange = useCallback(
    (field: keyof PlantEditFormValues) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange({ [field]: event.target.value })
      },
    [onChange],
  )

  const fieldErrors = errors.fields ?? {}
  const canSubmit = dirtyState.isDirty && !pending

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {errors.form ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errors.form}
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="speciesName">{FIELD_METADATA.speciesName.label}</Label>
          <Input
            id="speciesName"
            value={values.speciesName}
            readOnly
            disabled
            aria-readonly="true"
            aria-describedby="plant-edit-species-helper"
          />
          <p id="plant-edit-species-helper" className="text-sm text-muted-foreground">
            {FIELD_METADATA.speciesName.description}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nickname">{FIELD_METADATA.nickname.label}</Label>
          <Input
            id="nickname"
            name="nickname"
            value={values.nickname}
            onChange={handleFieldChange('nickname')}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.nickname?.length)}
            aria-describedby={
              fieldErrors.nickname?.length ? buildErrorId('nickname') : undefined
            }
          />
          <p className="text-sm text-muted-foreground">{FIELD_METADATA.nickname.description}</p>
          {fieldErrors.nickname?.length ? (
            <p id={buildErrorId('nickname')} className="text-sm text-destructive">
              {fieldErrors.nickname.join(' ')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{FIELD_METADATA.description.label}</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            value={values.description}
            onChange={handleFieldChange('description')}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.description?.length)}
            aria-describedby={
              fieldErrors.description?.length ? buildErrorId('description') : undefined
            }
          />
          <p className="text-sm text-muted-foreground">
            {FIELD_METADATA.description.description}
          </p>
          {fieldErrors.description?.length ? (
            <p id={buildErrorId('description')} className="text-sm text-destructive">
              {fieldErrors.description.join(' ')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchaseDate">{FIELD_METADATA.purchaseDate.label}</Label>
          <Input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            value={values.purchaseDate}
            onChange={handleFieldChange('purchaseDate')}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.purchase_date?.length)}
            aria-describedby={
              fieldErrors.purchase_date?.length ? buildErrorId('purchase_date') : undefined
            }
          />
          <p className="text-sm text-muted-foreground">
            {FIELD_METADATA.purchaseDate.description}
          </p>
          {fieldErrors.purchase_date?.length ? (
            <p id={buildErrorId('purchase_date')} className="text-sm text-destructive">
              {fieldErrors.purchase_date.join(' ')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="photoPath">{FIELD_METADATA.photoPath.label}</Label>
          <Input
            id="photoPath"
            name="photoPath"
            value={values.photoPath}
            onChange={handleFieldChange('photoPath')}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.photo_path?.length)}
            aria-describedby={
              fieldErrors.photo_path?.length ? buildErrorId('photo_path') : undefined
            }
          />
          <p className="text-sm text-muted-foreground">
            {FIELD_METADATA.photoPath.description}
          </p>
          {fieldErrors.photo_path?.length ? (
            <p id={buildErrorId('photo_path')} className="text-sm text-destructive">
              {fieldErrors.photo_path.join(' ')}
            </p>
          ) : null}
        </div>
      </div>

      {!dirtyState.isDirty ? (
        <p className="text-sm text-muted-foreground">
          Brak zmian do zapisania. Wprowadź aktualizacje w przynajmniej jednym polu.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
          className="sm:min-w-[160px]"
        >
          Anuluj
        </Button>
        <Button type="submit" disabled={!canSubmit} className="sm:min-w-[160px]">
          {pending ? 'Zapisywanie…' : 'Zapisz zmiany'}
        </Button>
      </div>
    </form>
  )
}

PlantEditForm.displayName = 'PlantEditForm'
