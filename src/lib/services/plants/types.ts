import type { Tables } from "../../../db/database.types";
import type { PlantListItemDto } from "../../../types";

export type PlantSortField = "created_at" | "species_name" | "updated_at";

export type SortOrder = "asc" | "desc";

export interface ListPlantsQuery {
  search?: string;
  speciesNormalized?: string;
  sort: PlantSortField;
  order: SortOrder;
  limit: number;
  cursor?: string;
}

export interface ListPlantsCommand {
  userId: string;
  query: ListPlantsQuery;
}

export interface ListPlantsResult {
  items: PlantListItemDto[];
  nextCursor: string | null;
}

export type PlantListRow = Pick<
  Tables<"plants">,
  | "id"
  | "species_name"
  | "species_name_normalized"
  | "duplicate_index"
  | "nickname"
  | "description"
  | "purchase_date"
  | "photo_path"
  | "created_source"
  | "created_at"
  | "updated_at"
>;

export interface ListPlantsCursorPayload {
  userId: string;
  sort: PlantSortField;
  order: SortOrder;
  sortValue: string;
  id: string;
}

export interface ListPlantsCursorContext {
  userId: string;
  sort: PlantSortField;
  order: SortOrder;
}
