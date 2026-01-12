import type { Tables } from "../../../db/database.types";
import type { WateringPlanHistoryItemDto } from "../../../types";

export type WateringPlanSortField = "valid_from";

export type WateringPlanSortOrder = "asc" | "desc";

export interface WateringPlanHistoryCursor {
  validFrom: string;
  id: string;
}

export interface WateringPlanHistoryFilters {
  activeOnly: boolean;
  sort: WateringPlanSortField;
  order: WateringPlanSortOrder;
  limit: number;
  cursor: WateringPlanHistoryCursor | null;
}

export type ListWateringPlansQuery = WateringPlanHistoryFilters & {
  userId: string;
  plantId: string;
};

export interface ListWateringPlansResult {
  items: WateringPlanHistoryItemDto[];
  nextCursor: string | null;
}

export type WateringPlanRow = Pick<
  Tables<"watering_plans">,
  | "id"
  | "plant_id"
  | "user_id"
  | "is_active"
  | "valid_from"
  | "valid_to"
  | "interval_days"
  | "horizon_days"
  | "schedule_basis"
  | "start_from"
  | "custom_start_on"
  | "overdue_policy"
  | "was_ai_suggested"
  | "was_ai_accepted_without_changes"
  | "ai_request_id"
>;
