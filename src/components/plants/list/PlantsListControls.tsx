import { Button } from "@/components/ui/button";
import { PlantsLimitSelect } from "./PlantsLimitSelect";
import { PlantsOrderToggle } from "./PlantsOrderToggle";
import { PlantsSearchInput } from "./PlantsSearchInput";
import { PlantsSortSelect } from "./PlantsSortSelect";
import { PlantsSpeciesInput } from "./PlantsSpeciesInput";

import type { PlantSortField, SortOrder } from "@/lib/services/plants/types";

interface PlantsListControlsProps {
  searchValue: string;
  speciesValue: string;
  sort: PlantSortField;
  order: SortOrder;
  limit: number;
  pending?: boolean;
  showReset?: boolean;
  onSearchCommit: (value: string) => void;
  onSpeciesCommit: (value: string) => void;
  onSortChange: (value: PlantSortField) => void;
  onOrderChange: (value: SortOrder) => void;
  onLimitChange: (value: number) => void;
  onReset?: () => void;
}

export const PlantsListControls = ({
  searchValue,
  speciesValue,
  sort,
  order,
  limit,
  pending = false,
  showReset = false,
  onSearchCommit,
  onSpeciesCommit,
  onSortChange,
  onOrderChange,
  onLimitChange,
  onReset,
}: PlantsListControlsProps) => {
  return (
    <section className="space-y-5 rounded-xl border border-border/70 bg-card/50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Filtry</p>
          <p className="text-xs text-muted-foreground">
            Filtrowanie dotyczy zarówno wyszukiwania jak i dokładnego gatunku.
          </p>
        </div>
        {showReset && onReset && (
          <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={pending}>
            Resetuj filtry
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PlantsSearchInput value={searchValue} pending={pending} onCommit={onSearchCommit} />
        <PlantsSpeciesInput value={speciesValue} pending={pending} onCommit={onSpeciesCommit} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <PlantsSortSelect value={sort} onChange={onSortChange} disabled={pending} />
        <PlantsOrderToggle value={order} onChange={onOrderChange} disabled={pending} />
        <PlantsLimitSelect value={limit} onChange={onLimitChange} disabled={pending} />
      </div>
    </section>
  );
};

PlantsListControls.displayName = "PlantsListControls";
