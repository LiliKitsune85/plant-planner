import type { FC } from "react";

import type { PlantDetailVm } from "@/components/plants/detail/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { PlantPhoto } from "./PlantPhoto";

export interface PlantIdentityCardProps {
  plant: PlantDetailVm["plant"];
}

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const formatDate = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
};

export const PlantIdentityCard: FC<PlantIdentityCardProps> = ({ plant }) => (
  <Card>
    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <CardTitle className="text-2xl font-semibold text-foreground">{plant.displayName}</CardTitle>
        {plant.nickname ? (
          <p className="text-base text-muted-foreground">Pseudonim: “{plant.nickname}”</p>
        ) : (
          <p className="text-base text-muted-foreground">Pseudonim nieustawiony</p>
        )}
      </div>
      <PlantPhoto photoPath={plant.photoPath} alt={plant.displayName} />
    </CardHeader>
    <CardContent>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Gatunek</dt>
          <dd className="text-base text-foreground">{plant.speciesName}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Numer duplikatu</dt>
          <dd className="text-base text-foreground">#{plant.duplicateIndex}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Data zakupu</dt>
          <dd className="text-base text-foreground">{formatDate(plant.purchaseDate) ?? "Brak informacji"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Opis</dt>
          <dd className="text-base text-foreground">{plant.description ?? "Opis nie został dodany"}</dd>
        </div>
      </dl>
    </CardContent>
  </Card>
);

PlantIdentityCard.displayName = "PlantIdentityCard";
