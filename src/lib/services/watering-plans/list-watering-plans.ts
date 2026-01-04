import type { SupabaseClient } from "../../../db/supabase.client";
import type { WateringPlanHistoryItemDto } from "../../../types";
import { HttpError } from "../../http/errors";
import { encodeWateringPlanHistoryCursor } from "./cursor";
import type {
  ListWateringPlansQuery,
  ListWateringPlansResult,
  WateringPlanHistoryCursor,
  WateringPlanRow,
  WateringPlanSortField,
} from "./types";

const WATERING_PLAN_COLUMNS = [
  "id",
  "plant_id",
  "user_id",
  "is_active",
  "valid_from",
  "valid_to",
  "interval_days",
  "horizon_days",
  "schedule_basis",
  "start_from",
  "custom_start_on",
  "overdue_policy",
  "was_ai_suggested",
  "was_ai_accepted_without_changes",
  "ai_request_id",
].join(",");

interface PlantLookupRow {
  id: string;
}

const escapeLogicalValue = (value: string): string => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const buildCursorFilter = (
  cursor: WateringPlanHistoryCursor,
  sortField: WateringPlanSortField,
  order: ListWateringPlansQuery["order"]
): string => {
  const comparator = order === "asc" ? "gt" : "lt";
  const encodedSortValue = escapeLogicalValue(cursor.validFrom);
  const encodedId = escapeLogicalValue(cursor.id);

  return [
    `${sortField}.${comparator}.${encodedSortValue}`,
    `and(${sortField}.eq.${encodedSortValue},id.${comparator}.${encodedId})`,
  ].join(",");
};

const mapRowToDto = (row: WateringPlanRow): WateringPlanHistoryItemDto => ({
  id: row.id,
  is_active: row.is_active,
  valid_from: row.valid_from,
  valid_to: row.valid_to,
  interval_days: row.interval_days,
  horizon_days: row.horizon_days,
  schedule_basis: row.schedule_basis,
  start_from: row.start_from,
  custom_start_on: row.custom_start_on,
  overdue_policy: row.overdue_policy,
  was_ai_suggested: row.was_ai_suggested,
  was_ai_accepted_without_changes: row.was_ai_accepted_without_changes,
  ai_request_id: row.ai_request_id,
});

const ensurePlantOwnership = async (supabase: SupabaseClient, userId: string, plantId: string): Promise<void> => {
  const { data, error } = await supabase
    .from("plants")
    .select<PlantLookupRow>("id")
    .eq("id", plantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("listWateringPlans: plant lookup failed", { error, userId, plantId });
    throw new HttpError(500, "Failed to verify plant ownership", "PLANT_LOOKUP_FAILED");
  }

  if (!data) {
    throw new HttpError(404, "Plant not found", "PLANT_NOT_FOUND");
  }
};

export const listWateringPlans = async (
  supabase: SupabaseClient,
  query: ListWateringPlansQuery
): Promise<ListWateringPlansResult> => {
  const { userId, plantId, activeOnly, order, limit, cursor, sort } = query;

  await ensurePlantOwnership(supabase, userId, plantId);

  let request = supabase
    .from("watering_plans")
    .select<WateringPlanRow>(WATERING_PLAN_COLUMNS)
    .eq("user_id", userId)
    .eq("plant_id", plantId);

  if (activeOnly) {
    request = request.eq("is_active", true);
  }

  if (cursor) {
    request = request.or(buildCursorFilter(cursor, sort, order));
  }

  request = request.order(sort, { ascending: order === "asc" }).order("id", {
    ascending: order === "asc",
  });

  const { data, error } = await request.limit(limit + 1);

  if (error || !data) {
    console.error("listWateringPlans query failed", {
      error,
      userId,
      plantId,
    });
    throw new HttpError(500, "Failed to list watering plans", "WATERING_PLAN_QUERY_FAILED");
  }

  const hasNextPage = data.length > limit;
  const pageItems = hasNextPage ? data.slice(0, limit) : data;
  const items = pageItems.map(mapRowToDto);

  const lastItem = pageItems[pageItems.length - 1];
  const lastSortValue = lastItem ? lastItem[sort] : null;
  const nextCursor =
    hasNextPage && lastItem && lastSortValue
      ? encodeWateringPlanHistoryCursor({
          validFrom: lastSortValue,
          id: lastItem.id,
        })
      : null;

  return {
    items,
    nextCursor,
  };
};
