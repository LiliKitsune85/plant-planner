import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import type { PlantListItemDto } from '@/types'
import { usePlantSearch } from '@/components/hooks/use-plant-search'

type PlantPickerProps = {
  value: PlantListItemDto | null
  onChange: (next: PlantListItemDto | null) => void
  disabled?: boolean
}

export const PlantPicker = ({ value, onChange, disabled }: PlantPickerProps) => {
  const { query, setQuery, results, isLoading, error, clear } = usePlantSearch({
    limit: 8,
    debounceMs: 350,
  })

  const showResults = useMemo(
    () => !value && query.trim().length >= 2,
    [query, value],
  )

  const handleSelect = (plant: PlantListItemDto) => {
    onChange(plant)
    clear()
  }

  if (value) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-semibold text-foreground">{value.display_name}</p>
        {value.nickname && <p className="text-sm text-muted-foreground">{value.nickname}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => onChange(null)}
          disabled={disabled}
        >
          Wybierz inną roślinę
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          Znajdź roślinę (min. 2 znaki)
        </label>
        <input
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="np. Monstera"
          disabled={disabled}
        />
      </div>
      {showResults && (
        <div className="rounded-lg border border-border">
          <ul role="listbox" className="max-h-64 divide-y divide-border overflow-y-auto">
            {results.length === 0 && !isLoading ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">Brak wyników.</li>
            ) : (
              results.map((plant) => (
                <li key={plant.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-4 py-3 text-left text-sm hover:bg-muted"
                    onClick={() => handleSelect(plant)}
                    disabled={disabled}
                  >
                    <span className="font-medium text-foreground">{plant.display_name}</span>
                    {plant.nickname && (
                      <span className="text-xs text-muted-foreground">{plant.nickname}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Ładowanie wyników…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

PlantPicker.displayName = 'PlantPicker'
