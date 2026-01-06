import { useMemo } from 'react'
import type { FC, FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  WateringPlanFormErrors,
  WateringPlanFormValues,
  WateringPlanFormField,
} from '@/components/plants/watering-plan/types'

export type WateringPlanFormProps = {
  value: WateringPlanFormValues
  errors: WateringPlanFormErrors
  isSaving: boolean
  onChange: (patch: Partial<WateringPlanFormValues>) => void
  onSubmit: () => void
  onBack: () => void
}

const FIELD_LABELS: Record<WateringPlanFormField, string> = {
  interval_days: 'Interwał (dni)',
  start_from: 'Rozpocznij od',
  custom_start_on: 'Niestandardowa data startu',
  horizon_days: 'Horyzont planu (dni)',
  schedule_basis: 'Podstawa harmonogramu',
  overdue_policy: 'Zaległe zadania',
  form: 'Formularz',
}

export const WateringPlanForm: FC<WateringPlanFormProps> = ({
  value,
  errors,
  isSaving,
  onChange,
  onSubmit,
  onBack,
}) => {
  const getError = useMemo(() => {
    return (field: WateringPlanFormField) => errors.fieldErrors[field]?.[0]
  }, [errors.fieldErrors])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  const intervalError = getError('interval_days')
  const horizonError = getError('horizon_days')
  const customDateError = getError('custom_start_on')
  const scheduleBasisError = getError('schedule_basis')
  const overduePolicyError = getError('overdue_policy')

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="interval_days">{FIELD_LABELS.interval_days}</Label>
          <Input
            id="interval_days"
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            value={value.interval_days}
            aria-invalid={Boolean(intervalError)}
            aria-describedby={intervalError ? 'interval_days-error' : undefined}
            onChange={(event) => onChange({ interval_days: event.target.value })}
          />
          {intervalError ? (
            <p id="interval_days-error" className="text-sm text-destructive">
              {intervalError}
            </p>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{FIELD_LABELS.start_from}</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-2xl border border-border/70 p-3">
              <input
                type="radio"
                name="start_from"
                value="today"
                checked={value.start_from === 'today'}
                onChange={() => onChange({ start_from: 'today', custom_start_on: '' })}
              />
              <span>Dzisiaj</span>
            </label>
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-2xl border border-border/70 p-3">
              <input
                type="radio"
                name="start_from"
                value="custom_date"
                checked={value.start_from === 'custom_date'}
                onChange={() => onChange({ start_from: 'custom_date' })}
              />
              <span>Niestandardowa data</span>
            </label>
          </div>
        </fieldset>

        {value.start_from === 'custom_date' ? (
          <div className="space-y-2">
            <Label htmlFor="custom_start_on">{FIELD_LABELS.custom_start_on}</Label>
            <Input
              id="custom_start_on"
              type="date"
              value={value.custom_start_on}
              aria-invalid={Boolean(customDateError)}
              aria-describedby={customDateError ? 'custom_start_on-error' : undefined}
              onChange={(event) => onChange({ custom_start_on: event.target.value })}
            />
            {customDateError ? (
              <p id="custom_start_on-error" className="text-sm text-destructive">
                {customDateError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 rounded-3xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Zaawansowane
        </p>

        <div className="space-y-2">
          <Label htmlFor="horizon_days">{FIELD_LABELS.horizon_days}</Label>
          <Input
            id="horizon_days"
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            value={value.horizon_days}
            aria-invalid={Boolean(horizonError)}
            aria-describedby={horizonError ? 'horizon_days-error' : undefined}
            onChange={(event) => onChange({ horizon_days: event.target.value })}
          />
          {horizonError ? (
            <p id="horizon_days-error" className="text-sm text-destructive">
              {horizonError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule_basis">{FIELD_LABELS.schedule_basis}</Label>
          <select
            id="schedule_basis"
            className="w-full rounded-2xl border border-border/60 bg-background p-3 text-sm"
            value={value.schedule_basis}
            aria-invalid={Boolean(scheduleBasisError)}
            aria-describedby={scheduleBasisError ? 'schedule_basis-error' : undefined}
            onChange={(event) =>
              onChange({ schedule_basis: event.target.value as WateringPlanFormValues['schedule_basis'] })
            }
          >
            <option value="completed_on">Wykonanie zadania</option>
            <option value="due_on">Termin zadania</option>
          </select>
          {scheduleBasisError ? (
            <p id="schedule_basis-error" className="text-sm text-destructive">
              {scheduleBasisError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="overdue_policy">{FIELD_LABELS.overdue_policy}</Label>
          <select
            id="overdue_policy"
            className="w-full rounded-2xl border border-border/60 bg-background p-3 text-sm"
            value={value.overdue_policy}
            aria-invalid={Boolean(overduePolicyError)}
            aria-describedby={overduePolicyError ? 'overdue_policy-error' : undefined}
            onChange={(event) =>
              onChange({ overdue_policy: event.target.value as WateringPlanFormValues['overdue_policy'] })
            }
          >
            <option value="carry_forward">Przenieś i nadrób</option>
            <option value="reschedule">Przelicz harmonogram</option>
          </select>
          {overduePolicyError ? (
            <p id="overdue_policy-error" className="text-sm text-destructive">
              {overduePolicyError}
            </p>
          ) : null}
        </div>
      </div>

      {errors.formError ? <p className="text-sm text-destructive">{errors.formError}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSaving}>
          Zapisz plan
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} disabled={isSaving}>
          Wróć
        </Button>
      </div>
    </form>
  )
}

WateringPlanForm.displayName = 'WateringPlanForm'

