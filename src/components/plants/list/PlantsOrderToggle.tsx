import { Button } from '@/components/ui/button'
import type { SortOrder } from '@/lib/services/plants/types'

const ORDER_OPTIONS: Array<{ value: SortOrder; label: string; symbol: string }> = [
  { value: 'asc', label: 'Rosnąco', symbol: '↑' },
  { value: 'desc', label: 'Malejąco', symbol: '↓' },
]

type PlantsOrderToggleProps = {
  value: SortOrder
  disabled?: boolean
  onChange: (next: SortOrder) => void
}

export const PlantsOrderToggle = ({
  value,
  disabled = false,
  onChange,
}: PlantsOrderToggleProps) => {
  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-foreground">
      Kolejność
      <div className="flex gap-2">
        {ORDER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={option.value === value ? 'default' : 'outline'}
            size="sm"
            disabled={disabled}
            className="flex-1"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
          >
            <span className="font-semibold">{option.symbol}</span>
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

PlantsOrderToggle.displayName = 'PlantsOrderToggle'
