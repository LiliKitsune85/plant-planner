import { useEffect, useMemo, useRef, useState } from 'react'
import type { FC, FormEvent, RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type {
  WateringPlanAdvancedState,
  WateringPlanFormErrors,
  WateringPlanFormState,
  WateringPlanStartFromUi,
} from './types'

export type WateringPlanFormProps = {
  value: WateringPlanFormState
  errors: WateringPlanFormErrors | null
  pending: boolean
  canSubmit: boolean
  onChangeIntervalDays: (next: number | '') => void
  onChangeStartFrom: (next: WateringPlanStartFromUi) => void
  onChangeCustomStartOn: (next: string | null) => void
  onChangeAdvanced: (patch: Partial<WateringPlanAdvancedState>) => void
  onSubmit: () => void
  onCancel: () => void
}

const parseNumericInput = (raw: string): number | '' => {
  if (raw === '') return ''
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? '' : parsed
}

const InlineError = ({ id, message }: { id: string; message?: string }) => {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  )
}

type IntervalDaysFieldProps = {
  value: number | ''
  error?: string
  onChange: (next: number | '') => void
  inputRef: RefObject<HTMLInputElement>
}

const IntervalDaysField: FC<IntervalDaysFieldProps> = ({ value, error, onChange, inputRef }) => (
  <div className="space-y-2">
    <Label htmlFor="interval_days">Interwał podlewania (dni)</Label>
    <Input
      ref={inputRef}
      id="interval_days"
      type="number"
      min={1}
      max={365}
      step={1}
      inputMode="numeric"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? 'interval_days-error' : undefined}
      value={value === '' ? '' : String(value)}
      onChange={(event) => onChange(parseNumericInput(event.target.value))}
    />
    <p className="text-xs text-muted-foreground">Określ co ile dni należy zaplanować podlewanie.</p>
    <InlineError id="interval_days-error" message={error} />
  </div>
)

type StartFromFieldsetProps = {
  startFrom: WateringPlanStartFromUi
  customStartOn: string | null
  error?: string
  customDateError?: string
  pending: boolean
  onChangeStartFrom: (next: WateringPlanStartFromUi) => void
  onChangeCustomStartOn: (next: string | null) => void
  radioRef: RefObject<HTMLInputElement>
  customDateRef: RefObject<HTMLInputElement>
}

const StartFromFieldset: FC<StartFromFieldsetProps> = ({
  startFrom,
  customStartOn,
  error,
  customDateError,
  pending,
  onChangeStartFrom,
  onChangeCustomStartOn,
  radioRef,
  customDateRef,
}) => {
  const startOptions: Array<{
    value: WateringPlanStartFromUi
    title: string
    description: string
  }> = [
    {
      value: 'today',
      title: 'Od dziś',
      description: 'Pierwsze zadania zostaną wygenerowane od bieżącego dnia.',
    },
    {
      value: 'custom_date',
      title: 'Niestandardowa data',
      description: 'Samodzielnie wskaż, kiedy plan ma wejść w życie.',
    },
  ]

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Rozpocznij plan</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {startOptions.map((option) => (
          <label
            key={option.value}
            className={cn(
              'cursor-pointer rounded-2xl border p-4 transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40',
              startFrom === option.value ? 'border-ring bg-background' : 'border-border bg-card',
              pending ? 'opacity-70' : '',
            )}
          >
            <span className="flex items-center gap-2 text-base font-semibold">
              <input
                type="radio"
                name="start_from"
                value={option.value}
                checked={startFrom === option.value}
                  onChange={() => onChangeStartFrom(option.value)}
                  aria-invalid={option.value === startFrom && Boolean(error)}
                  aria-describedby={error ? 'start_from-error' : undefined}
                  ref={option.value === 'today' ? radioRef : undefined}
              />
              {option.title}
            </span>
            <span className="mt-2 block text-sm text-muted-foreground">{option.description}</span>
          </label>
        ))}
      </div>
      <InlineError id="start_from-error" message={error} />

      {startFrom === 'custom_date' ? (
        <div className="space-y-2">
          <Label htmlFor="custom_start_on">Data rozpoczęcia</Label>
          <Input
            ref={customDateRef}
            id="custom_start_on"
            type="date"
            aria-invalid={Boolean(customDateError)}
            aria-describedby={customDateError ? 'custom_start_on-error' : undefined}
            value={customStartOn ?? ''}
            onChange={(event) => {
              const next = event.target.value
              onChangeCustomStartOn(next ? next : null)
            }}
          />
          <InlineError id="custom_start_on-error" message={customDateError} />
        </div>
      ) : null}
    </fieldset>
  )
}

type AdvancedSectionProps = {
  value: WateringPlanAdvancedState
  errors?: Pick<WateringPlanFormErrors, 'horizon_days' | 'schedule_basis' | 'overdue_policy'>
  onChange: (patch: Partial<WateringPlanAdvancedState>) => void
  refs: {
    horizon: RefObject<HTMLInputElement>
    schedule: RefObject<HTMLSelectElement>
    overdue: RefObject<HTMLSelectElement>
  }
}

const AdvancedSection: FC<AdvancedSectionProps> = ({ value, errors, onChange, refs }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <details
      className="rounded-3xl border border-border/70 bg-card/30 p-4 shadow-xs"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground">
        Zaawansowane
        <span className="text-sm text-muted-foreground">{isOpen ? 'Ukryj' : 'Rozwiń'}</span>
      </summary>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="horizon_days">Horyzont planu (dni)</Label>
          <Input
            ref={refs.horizon}
            id="horizon_days"
            type="number"
            min={1}
            max={365}
            step={1}
            inputMode="numeric"
            value={value.horizonDays === '' ? '' : String(value.horizonDays)}
            aria-invalid={Boolean(errors?.horizon_days?.[0])}
            aria-describedby={errors?.horizon_days?.[0] ? 'horizon_days-error' : undefined}
            onChange={(event) => onChange({ horizonDays: parseNumericInput(event.target.value) })}
          />
          <InlineError id="horizon_days-error" message={errors?.horizon_days?.[0]} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule_basis">Podstawa harmonogramu</Label>
          <select
            ref={refs.schedule}
            id="schedule_basis"
            className="w-full rounded-2xl border border-border/70 bg-background p-3 text-sm transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            value={value.scheduleBasis}
            aria-invalid={Boolean(errors?.schedule_basis?.[0])}
            aria-describedby={errors?.schedule_basis?.[0] ? 'schedule_basis-error' : undefined}
            onChange={(event) =>
              onChange({
                scheduleBasis: event.target.value as WateringPlanAdvancedState['scheduleBasis'],
              })
            }
          >
            <option value="completed_on">Uwzględnij wykonanie zadań</option>
            <option value="due_on">Uwzględnij terminy zadań</option>
          </select>
          <InlineError id="schedule_basis-error" message={errors?.schedule_basis?.[0]} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="overdue_policy">Zaległe zadania</Label>
          <select
            ref={refs.overdue}
            id="overdue_policy"
            className="w-full rounded-2xl border border-border/70 bg-background p-3 text-sm transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            value={value.overduePolicy}
            aria-invalid={Boolean(errors?.overdue_policy?.[0])}
            aria-describedby={errors?.overdue_policy?.[0] ? 'overdue_policy-error' : undefined}
            onChange={(event) =>
              onChange({
                overduePolicy: event.target.value as WateringPlanAdvancedState['overduePolicy'],
              })
            }
          >
            <option value="carry_forward">Dołóż zaległe do kolejnego dnia</option>
            <option value="reschedule">Przelicz harmonogram</option>
          </select>
          <InlineError id="overdue_policy-error" message={errors?.overdue_policy?.[0]} />
        </div>
      </div>
    </details>
  )
}

type FormActionsProps = {
  pending: boolean
  canSubmit: boolean
  onCancel: () => void
}

const FormActions: FC<FormActionsProps> = ({ pending, canSubmit, onCancel }) => (
  <div className="flex flex-wrap gap-3">
    <Button type="submit" disabled={!canSubmit || pending}>
      {pending ? 'Zapisywanie…' : 'Zapisz plan'}
    </Button>
    <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
      Anuluj
    </Button>
  </div>
)

export const WateringPlanForm: FC<WateringPlanFormProps> = ({
  value,
  errors,
  pending,
  canSubmit,
  onChangeIntervalDays,
  onChangeStartFrom,
  onChangeCustomStartOn,
  onChangeAdvanced,
  onSubmit,
  onCancel,
}) => {
  const intervalRef = useRef<HTMLInputElement>(null)
  const startRadioRef = useRef<HTMLInputElement>(null)
  const customDateRef = useRef<HTMLInputElement>(null)
  const horizonRef = useRef<HTMLInputElement>(null)
  const scheduleRef = useRef<HTMLSelectElement>(null)
  const overdueRef = useRef<HTMLSelectElement>(null)

  const errorFocusOrder = useMemo(
    () => [
      { field: 'interval_days', ref: intervalRef },
      { field: 'start_from', ref: startRadioRef },
      { field: 'custom_start_on', ref: customDateRef },
      { field: 'horizon_days', ref: horizonRef },
      { field: 'schedule_basis', ref: scheduleRef },
      { field: 'overdue_policy', ref: overdueRef },
    ],
    [],
  )

  useEffect(() => {
    if (!errors) return
    for (const entry of errorFocusOrder) {
      const fieldErrors = (errors as Record<string, string[] | undefined>)[
        entry.field
      ]
      if (fieldErrors && fieldErrors.length > 0 && entry.ref.current) {
        entry.ref.current.focus()
        return
      }
    }
  }, [errorFocusOrder, errors])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <fieldset disabled={pending} className="space-y-6">
        <IntervalDaysField
          value={value.intervalDays}
          error={errors?.interval_days?.[0]}
          onChange={onChangeIntervalDays}
          inputRef={intervalRef}
        />

        <StartFromFieldset
          startFrom={value.startFrom}
          customStartOn={value.customStartOn}
          error={errors?.start_from?.[0]}
          customDateError={errors?.custom_start_on?.[0]}
          pending={pending}
          onChangeStartFrom={(next) => {
            onChangeStartFrom(next)
            if (next === 'today') {
              onChangeCustomStartOn(null)
            }
          }}
          onChangeCustomStartOn={onChangeCustomStartOn}
          radioRef={startRadioRef}
          customDateRef={customDateRef}
        />

        <AdvancedSection
          value={value.advanced}
          errors={{
            horizon_days: errors?.horizon_days,
            schedule_basis: errors?.schedule_basis,
            overdue_policy: errors?.overdue_policy,
          }}
          onChange={onChangeAdvanced}
          refs={{
            horizon: horizonRef,
            schedule: scheduleRef,
            overdue: overdueRef,
          }}
        />
      </fieldset>

      {errors?.form?.length ? (
        <div
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {errors.form.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      <FormActions pending={pending} canSubmit={canSubmit} onCancel={onCancel} />
    </form>
  )
}

WateringPlanForm.displayName = 'WateringPlanForm'

