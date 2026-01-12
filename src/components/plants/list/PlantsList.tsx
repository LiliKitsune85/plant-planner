import { PlantListItem } from "./PlantListItem";

import type { PlantListItemVm } from "@/lib/services/plants/list-view-model";

interface PlantsListProps {
  items: PlantListItemVm[];
}

export const PlantsList = ({ items }: PlantsListProps) => {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <PlantListItem key={item.id} item={item} />
      ))}
    </ul>
  );
};

PlantsList.displayName = "PlantsList";
