import type { PlantSortField } from "@/lib/services/plants/types";

const SORT_OPTIONS: { value: PlantSortField; label: string }[] = [
  { value: "species_name", label: "Nazwa gatunku" },
  { value: "created_at", label: "Data dodania" },
  { value: "updated_at", label: "Ostatnia aktualizacja" },
];

interface PlantsSortSelectProps {
  value: PlantSortField;
  disabled?: boolean;
  onChange: (next: PlantSortField) => void;
}

export const PlantsSortSelect = ({ value, disabled = false, onChange }: PlantsSortSelectProps) => {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      Sortowanie
      <select
        className="rounded-lg border bg-background/80 px-3 py-2 text-base text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as PlantSortField)}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

PlantsSortSelect.displayName = "PlantsSortSelect";
