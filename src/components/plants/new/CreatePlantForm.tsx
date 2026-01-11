import { useCallback, useMemo } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import type {
  CreatePlantFormErrors,
  CreatePlantFormField,
  CreatePlantFormValues,
  CreatePlantAiToggleVm,
} from '@/components/plants/new/types'
import { AiSuggestionToggle } from '@/components/plants/new/AiSuggestionToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type CreatePlantFormProps = {
  value: CreatePlantFormValues
  errors: CreatePlantFormErrors
  isSubmitting: boolean
  onChange: (patch: Partial<CreatePlantFormValues>) => void
  onSubmit: () => void
  onCancel: () => void
  ai: CreatePlantAiToggleVm
}

const FIELD_DESCRIPTORS: Record<
  Exclude<CreatePlantFormField, 'form' | 'generate_watering_suggestion'>,
  { label: string; description?: string }
> = {
  species_name: {
    label: 'Nazwa gatunku *',
    description: 'Np. Monstera deliciosa, Ficus lyrata itp.',
  },
  nickname: {
    label: 'Pseudonim (opcjonalnie)',
    description: 'Pomocne, jeśli masz kilka roślin tego samego gatunku.',
  },
  description: {
    label: 'Opis (opcjonalnie)',
    description: 'Dowolne dodatkowe notatki o roślinie.',
  },
  purchase_date: {
    label: 'Data zakupu (opcjonalnie)',
    description: 'Pomaga w historii pielęgnacji. Format: RRRR-MM-DD.',
  },
}

const buildErrorId = (field: CreatePlantFormField) => `create-plant-${field}-errors`

export const CreatePlantForm = ({
  value,
  errors,
  isSubmitting,
  onChange,
  onSubmit,
  onCancel,
  ai,
}: CreatePlantFormProps) => {
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      onSubmit()
    },
    [onSubmit],
  )

  const canSubmit = useMemo(() => value.species_name.trim().length > 0, [value.species_name])

  const handleInputChange = useCallback(
    (field: keyof CreatePlantFormValues) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange({ [field]: event.target.value })
      },
    [onChange],
  )

  const fieldErrors = errors.fieldErrors ?? {}

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {errors.formError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errors.formError}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="species_name">{FIELD_DESCRIPTORS.species_name.label}</Label>
          <Input
            id="species_name"
            name="species_name"
            autoComplete="off"
            placeholder="np. Sansevieria trifasciata"
            value={value.species_name}
            onChange={handleInputChange('species_name')}
            aria-invalid={Boolean(fieldErrors.species_name?.length)}
            aria-describedby={
              fieldErrors.species_name?.length ? buildErrorId('species_name') : undefined
            }
            required
            disabled={isSubmitting}
            data-testid="create-plant-species"
          />
          <p className="text-sm text-muted-foreground">{FIELD_DESCRIPTORS.species_name.description}</p>
          {fieldErrors.species_name?.length ? (
            <p id={buildErrorId('species_name')} className="text-sm text-destructive">
              {fieldErrors.species_name.join(' ')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nickname">{FIELD_DESCRIPTORS.nickname.label}</Label>
          <Input
            id="nickname"
            name="nickname"
            value={value.nickname}
            onChange={handleInputChange('nickname')}
            placeholder="np. „Królowa salonu”"
            aria-invalid={Boolean(fieldErrors.nickname?.length)}
            aria-describedby={
              fieldErrors.nickname?.length ? buildErrorId('nickname') : undefined
            }
            disabled={isSubmitting}
          />
          <p className="text-sm text-muted-foreground">{FIELD_DESCRIPTORS.nickname.description}</p>
          {fieldErrors.nickname?.length ? (
            <p id={buildErrorId('nickname')} className="text-sm text-destructive">
              {fieldErrors.nickname.join(' ')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{FIELD_DESCRIPTORS.description.label}</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            value={value.description}
            onChange={handleInputChange('description')}
            aria-invalid={Boolean(fieldErrors.description?.length)}
            aria-describedby={
              fieldErrors.description?.length ? buildErrorId('description') : undefined
            }
            disabled={isSubmitting}
          />
          <p className="text-sm text-muted-foreground">{FIELD_DESCRIPTORS.description.description}</p>
          {fieldErrors.description?.length ? (
            <p id={buildErrorId('description')} className="text-sm text-destructive">
              {fieldErrors.description.join(' ')}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_date">{FIELD_DESCRIPTORS.purchase_date.label}</Label>
          <Input
            id="purchase_date"
            name="purchase_date"
            type="date"
            value={value.purchase_date}
            onChange={handleInputChange('purchase_date')}
            aria-invalid={Boolean(fieldErrors.purchase_date?.length)}
            aria-describedby={
              fieldErrors.purchase_date?.length ? buildErrorId('purchase_date') : undefined
            }
            disabled={isSubmitting}
          />
          <p className="text-sm text-muted-foreground">
            {FIELD_DESCRIPTORS.purchase_date.description}
          </p>
          {fieldErrors.purchase_date?.length ? (
            <p id={buildErrorId('purchase_date')} className="text-sm text-destructive">
              {fieldErrors.purchase_date.join(' ')}
            </p>
          ) : null}
        </div>
      </div>

      <AiSuggestionToggle
        checked={ai.enabled}
        disabled={isSubmitting || ai.isRateLimited}
        showLimitInfo={ai.showLimitInfo}
        limitText={ai.limitText}
        rateLimit={
          ai.isRateLimited && ai.unlockAt
            ? {
                unlockAt: ai.unlockAt,
              }
            : ai.isRateLimited
              ? { unlockAt: undefined }
              : null
        }
        onCheckedChange={ai.onToggle}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={ai.onRefresh}
          disabled={isSubmitting || ai.isRefreshingQuota}
        >
          {ai.isRefreshingQuota ? 'Odświeżanie limitu…' : 'Sprawdź limit AI'}
        </Button>
        {ai.isRateLimited ? (
          <p className="text-sm text-muted-foreground">
            Limit AI zostanie odblokowany automatycznie, ale możesz spróbować ręcznie po czasie.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="sm:min-w-[160px]"
        >
          Anuluj
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="sm:min-w-[160px]"
          data-testid="create-plant-submit"
        >
          Dodaj roślinę
        </Button>
      </div>
    </form>
  )
}

CreatePlantForm.displayName = 'CreatePlantForm'
