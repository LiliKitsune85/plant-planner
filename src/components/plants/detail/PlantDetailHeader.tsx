import type { FC } from "react";

import { Button } from "@/components/ui/button";

export interface PlantDetailHeaderProps {
  backHref: string;
}

export const PlantDetailHeader: FC<PlantDetailHeaderProps> = ({ backHref }) => (
  <header className="flex items-start justify-between gap-4">
    <div>
      <p className="text-sm uppercase tracking-widest text-muted-foreground">szczegóły rośliny</p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Szczegóły rośliny</h1>
    </div>
    <Button variant="ghost" asChild>
      <a href={backHref}>← Powrót</a>
    </Button>
  </header>
);

PlantDetailHeader.displayName = "PlantDetailHeader";
