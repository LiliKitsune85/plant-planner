const LIMIT_OPTIONS = [10, 20, 30, 50, 100]

type PlantsLimitSelectProps = {
  value: number
  disabled?: boolean
  onChange: (next: number) => void
}

export const PlantsLimitSelect = ({ value, disabled = false, onChange }: PlantsLimitSelectProps) => {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      Liczba wyników na stronie
      <select
        className="rounded-lg border bg-background/80 px-3 py-2 text-base text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {LIMIT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

PlantsLimitSelect.displayName = 'PlantsLimitSelect'
