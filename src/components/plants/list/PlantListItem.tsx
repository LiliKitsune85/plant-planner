import { Button } from "@/components/ui/button";

import { PlantThumbnail } from "./PlantThumbnail";

import type { PlantListItemVm } from "@/lib/services/plants/list-view-model";

interface PlantListItemProps {
  item: PlantListItemVm;
}

export const PlantListItem = ({ item }: PlantListItemProps) => {
  const editHref = `/plants/${item.id}/edit`;

  return (
    <li>
      <article className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm transition hover:border-primary/80 hover:bg-primary/5">
        <a
          href={item.href}
          className="group flex items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <PlantThumbnail photoPath={item.photoPath ?? null} alt={item.displayName} />
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-base font-semibold text-foreground">{item.displayName}</p>
            {item.nickname && <p className="text-sm text-muted-foreground">Pseudonim: {item.nickname}</p>}
            {item.metaLabel && <p className="text-xs text-muted-foreground">{item.metaLabel}</p>}
          </div>
          <span className="text-lg text-primary transition group-hover:translate-x-1" aria-hidden>
            →
          </span>
        </a>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Button asChild variant="outline" size="sm">
            <a href={item.href}>Szczegóły</a>
          </Button>
          <Button asChild size="sm">
            <a href={editHref}>Edytuj</a>
          </Button>
        </div>
      </article>
    </li>
  );
};

PlantListItem.displayName = "PlantListItem";
