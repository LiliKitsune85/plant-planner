import { z } from "zod";

import { HttpError } from "../../http/errors";
import type { GetCalendarDayFilters } from "../../services/calendar/types";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (value: string): boolean => {
  if (!isoDateRegex.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.toISOString().slice(0, 10) === value;
};

const getCalendarDayQuerySchema = z.object({
  date: z.string().trim().refine(isValidIsoDate, {
    message: "date must be a valid ISO date (YYYY-MM-DD)",
  }),
  status: z.enum(["pending", "completed", "all"]).optional().default("pending"),
  sort: z.enum(["species_name", "due_on"]).optional().default("due_on"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});

const buildValidationDetails = (error: z.ZodError): Record<string, string[]> => {
  const details: Record<string, string[]> = {};
  const flattened = error.flatten().fieldErrors;
  for (const [field, messages] of Object.entries(flattened)) {
    if (!messages || messages.length === 0) continue;
    details[field] = messages.filter((message): message is string => Boolean(message));
  }
  return details;
};

export const parseGetCalendarDayQuery = (searchParams: URLSearchParams): GetCalendarDayFilters => {
  const parsed = getCalendarDayQuerySchema.safeParse({
    date: searchParams.get("date"),
    status: searchParams.get("status") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    order: searchParams.get("order") ?? undefined,
  });

  if (!parsed.success) {
    throw new HttpError(400, "Invalid query parameters", "VALIDATION_ERROR", {
      fields: buildValidationDetails(parsed.error),
    });
  }

  return parsed.data;
};
