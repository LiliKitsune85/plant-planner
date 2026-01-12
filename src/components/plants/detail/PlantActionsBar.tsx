import type { FC } from "react";

import { Button } from "@/components/ui/button";

export interface PlantActionsBarProps {
  calendarHref: string;
  calendarLabel?: string;
  editHref: string;
  pendingWaterToday: boolean;
  pendingDelete: boolean;
  onWaterTodayClick: () => void;
  onDeleteClick: () => void;
}

export const PlantActionsBar: FC<PlantActionsBarProps> = ({
  calendarHref,
  calendarLabel,
  editHref,
  pendingWaterToday,
  pendingDelete,
  onWaterTodayClick,
  onDeleteClick,
}) => (
  <section aria-label="Akcje rośliny" className="rounded-2xl border border-border p-4">
    <div className="flex flex-wrap gap-3">
      <Button asChild variant="outline">
        <a href={calendarHref}>
          Zobacz w kalendarzu
          {calendarLabel ? <span className="ml-1 text-xs text-muted-foreground">({calendarLabel})</span> : null}
        </a>
      </Button>
      <Button onClick={onWaterTodayClick} disabled={pendingWaterToday}>
        {pendingWaterToday ? "Zapisywanie…" : "Podlej dzisiaj"}
      </Button>
      <Button asChild variant="secondary">
        <a href={editHref}>Edytuj</a>
      </Button>
      <Button variant="destructive" onClick={onDeleteClick} disabled={pendingDelete}>
        Usuń
      </Button>
    </div>
  </section>
);

PlantActionsBar.displayName = "PlantActionsBar";
