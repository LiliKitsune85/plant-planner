import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "../../../../db/database.types.ts";
import type { PlantDetailDto } from "../../../types";
import { HttpError } from "../../http/errors";

export interface GetPlantDetailQuery {
  plantId: string;
  userId: string;
}

type PlantDetailRow = Pick<
  Tables<"plants">,
  "id" | "species_name" | "duplicate_index" | "nickname" | "description" | "purchase_date" | "photo_path"
>;

type ActiveWateringPlanRow = Pick<
  Tables<"watering_plans">,
  | "id"
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

export interface PlantDetailRecord {
  plant: PlantDetailRow;
  activePlan: ActiveWateringPlanRow | null;
}

const buildDisplayName = (speciesName: string, duplicateIndex: number): string =>
  `${speciesName} #${duplicateIndex + 1}`;

export const mapPlantDetailRecordToDto = (record: PlantDetailRecord): PlantDetailDto => ({
  plant: {
    id: record.plant.id,
    species_name: record.plant.species_name,
    duplicate_index: record.plant.duplicate_index,
    nickname: record.plant.nickname,
    description: record.plant.description,
    purchase_date: record.plant.purchase_date,
    photo_path: record.plant.photo_path,
    display_name: buildDisplayName(record.plant.species_name, record.plant.duplicate_index),
  },
  active_watering_plan: record.activePlan
    ? {
        id: record.activePlan.id,
        is_active: record.activePlan.is_active,
        valid_from: record.activePlan.valid_from,
        valid_to: record.activePlan.valid_to,
        interval_days: record.activePlan.interval_days,
        horizon_days: record.activePlan.horizon_days,
        schedule_basis: record.activePlan.schedule_basis,
        start_from: record.activePlan.start_from,
        custom_start_on: record.activePlan.custom_start_on,
        overdue_policy: record.activePlan.overdue_policy,
        was_ai_suggested: record.activePlan.was_ai_suggested,
        was_ai_accepted_without_changes: record.activePlan.was_ai_accepted_without_changes,
        ai_request_id: record.activePlan.ai_request_id,
      }
    : null,
});

export const getPlantDetail = async (
  supabase: SupabaseClient<Database>,
  { plantId, userId }: GetPlantDetailQuery
): Promise<PlantDetailRecord | null> => {
  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .select(
      ["id", "species_name", "duplicate_index", "nickname", "description", "purchase_date", "photo_path"].join(",")
    )
    .eq("id", plantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (plantError) {
    throw new HttpError(500, "Failed to load plant", "PLANT_QUERY_FAILED");
  }

  if (!plant) {
    return null;
  }

  const { data: activePlan, error: planError } = await supabase
    .from("watering_plans")
    .select(
      [
        "id",
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
      ].join(",")
    )
    .eq("plant_id", plantId)
    .eq("is_active", true)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) {
    throw new HttpError(500, "Failed to load watering plan", "WATERING_PLAN_QUERY_FAILED");
  }

  return {
    plant,
    activePlan: activePlan ?? null,
  };
};
