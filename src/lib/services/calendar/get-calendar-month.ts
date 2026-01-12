import type { SupabaseClient } from "../../../db/supabase.client";
import { logger } from "@/lib/logger";
import type { CalendarMonthResponseDto } from "../../../types";
import { HttpError } from "../../http/errors";
import type { CalendarTaskStatusFilter, GetCalendarMonthQuery } from "./types";
import { monthToDateRange } from "../../utils/date";

type PersistedTaskStatus = Exclude<CalendarTaskStatusFilter, "all">;

interface CalendarMonthTaskRow {
  due_on: string | null;
}

const buildStatusFilter = (status: CalendarTaskStatusFilter): PersistedTaskStatus[] => {
  if (status === "all") {
    return ["pending", "completed"];
  }

  return [status];
};

export const getCalendarMonthSummary = async (
  supabase: SupabaseClient,
  query: GetCalendarMonthQuery
): Promise<CalendarMonthResponseDto> => {
  const { userId, month, status } = query;
  const { rangeStart, rangeEnd } = monthToDateRange(month);
  const statusFilter = buildStatusFilter(status);

  const { data, error } = await supabase
    .from("watering_tasks")
    .select<CalendarMonthTaskRow>("due_on")
    .eq("user_id", userId)
    .gte("due_on", rangeStart)
    .lt("due_on", rangeEnd)
    .in("status", statusFilter)
    .order("due_on", { ascending: true });

  if (error || !data) {
    logger.error("getCalendarMonthSummary query failed", {
      error,
      userId,
      month,
      status,
      rangeStart,
      rangeEnd,
    });
    throw new HttpError(500, "Failed to load calendar month", "CALENDAR_MONTH_QUERY_FAILED");
  }

  const aggregated = new Map<string, number>();

  data.forEach((row) => {
    if (!row.due_on) {
      throw new HttpError(500, "Missing due_on value in calendar aggregation", "CALENDAR_MONTH_ROW_INVALID");
    }

    aggregated.set(row.due_on, (aggregated.get(row.due_on) ?? 0) + 1);
  });

  const days = Array.from(aggregated.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return {
    month,
    days,
  };
};
