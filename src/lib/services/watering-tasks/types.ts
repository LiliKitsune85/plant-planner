import type { WateringTaskListItemDto } from "../../../types";

export type WateringTaskSortField = "due_on" | "created_at";

export type WateringTaskSortOrder = "asc" | "desc";

export type WateringTaskStatusFilter = "pending" | "completed";

export type WateringTaskSourceFilter = "scheduled" | "adhoc";

export interface GetWateringTasksFilters {
  from?: string;
  to?: string;
  plantId?: string;
  status?: WateringTaskStatusFilter;
  source?: WateringTaskSourceFilter;
  sort: WateringTaskSortField;
  order: WateringTaskSortOrder;
  limit: number;
  cursor?: string;
}

export type GetWateringTasksQuery = GetWateringTasksFilters & {
  userId: string;
};

export interface ListWateringTasksResult {
  items: WateringTaskListItemDto[];
  nextCursor: string | null;
}

export interface ListWateringTasksCursorFiltersSnapshot {
  from: string | null;
  to: string | null;
  plantId: string | null;
  status: WateringTaskStatusFilter | null;
  source: WateringTaskSourceFilter | null;
  limit: number;
}

export interface ListWateringTasksCursorPayload {
  userId: string;
  sort: WateringTaskSortField;
  order: WateringTaskSortOrder;
  sortValue: string;
  id: string;
  filters: ListWateringTasksCursorFiltersSnapshot;
}

export interface ListWateringTasksCursorContext {
  userId: string;
  sort: WateringTaskSortField;
  order: WateringTaskSortOrder;
  filters: ListWateringTasksCursorFiltersSnapshot;
}

export interface ListWateringTasksServiceContext {
  requestId?: string;
}
