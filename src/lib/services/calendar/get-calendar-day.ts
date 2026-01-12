import type { Tables } from "../../../db/database.types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { CalendarDayResponseDto, CalendarTaskSummaryDto } from "../../../types";
import { HttpError } from "../../http/errors";
import { formatPlantDisplayName } from "../plants/format-plant-display-name";
import type { GetCalendarDayQuery } from "./types";

type WateringTaskRow = Pick<
  Tables<"watering_tasks">,
  "id" | "due_on" | "status" | "source" | "note" | "completed_at" | "completed_on"
>;

type PlantRow = Pick<Tables<"plants">, "id" | "nickname" | "species_name" | "duplicate_index">;

type CalendarTaskRow = WateringTaskRow & {
  plants: PlantRow | null;
};

const SELECT_COLUMNS = [
  "id",
  "due_on",
  "status",
  "source",
  "note",
  "completed_at",
  "completed_on",
  "plants ( id, nickname, species_name, duplicate_index )",
].join(",");

const mapRowToDto = (row: CalendarTaskRow): CalendarTaskSummaryDto => {
  if (!row.plants) {
    throw new HttpError(500, "Plant data missing for task", "CALENDAR_TASK_PLANT_MISSING");
  }

  return {
    task: {
      id: row.id,
      due_on: row.due_on,
      status: row.status,
      source: row.source,
      note: row.note,
      completed_at: row.completed_at,
      completed_on: row.completed_on,
    },
    plant: {
      id: row.plants.id,
      nickname: row.plants.nickname,
      display_name: formatPlantDisplayName(row.plants.species_name, row.plants.duplicate_index),
    },
  };
};

export const getCalendarDay = async (
  supabase: SupabaseClient,
  query: GetCalendarDayQuery
): Promise<CalendarDayResponseDto> => {
  const { userId, date, status, sort, order } = query;

  let request = supabase
    .from("watering_tasks")
    .select<CalendarTaskRow>(SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("due_on", date);

  if (status !== "all") {
    request = request.eq("status", status);
  }

  const ascending = order === "asc";

  if (sort === "species_name") {
    request = request
      .order("species_name", { foreignTable: "plants", ascending })
      .order("duplicate_index", { foreignTable: "plants", ascending })
      .order("due_on", { ascending: true })
      .order("id", { ascending: true });
  } else {
    request = request
      .order("due_on", { ascending })
      .order("species_name", { foreignTable: "plants", ascending: true })
      .order("duplicate_index", { foreignTable: "plants", ascending: true })
      .order("id", { ascending: true });
  }

  const { data, error } = await request;

  if (error || !data) {
    logger.error("getCalendarDay query failed", {
      error,
      userId,
      date,
      status,
      sort,
      order,
    });
    throw new HttpError(500, "Failed to load calendar day", "CALENDAR_DAY_QUERY_FAILED");
  }

  const items = data.map(mapRowToDto);

  return {
    date,
    items,
  };
};
