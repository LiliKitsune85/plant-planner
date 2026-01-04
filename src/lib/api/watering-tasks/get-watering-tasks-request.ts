import { z } from "zod";

import { HttpError } from "../../http/errors";
import type { GetWateringTasksFilters } from "../../services/watering-tasks/types";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_DATE_RANGE_DAYS = 366;
const MS_PER_DAY = 86_400_000;

const isValidIsoDate = (value: string): boolean => {
  if (!isoDateRegex.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
};

const isoDateToEpochMs = (value: string): number => new Date(`${value}T00:00:00Z`).getTime();

const buildValidationDetails = (error: z.ZodError): Record<string, string[]> => {
  const details: Record<string, string[]> = {};
  const flattened = error.flatten().fieldErrors;

  for (const [field, messages] of Object.entries(flattened)) {
    if (!messages?.length) continue;
    details[field] = messages.filter((message): message is string => Boolean(message));
  }

  return details;
};

const getWateringTasksQuerySchema = z
  .object({
    from: z
      .string()
      .trim()
      .refine(isValidIsoDate, {
        message: "from must be a valid ISO date (YYYY-MM-DD)",
      })
      .optional(),
    to: z
      .string()
      .trim()
      .refine(isValidIsoDate, {
        message: "to must be a valid ISO date (YYYY-MM-DD)",
      })
      .optional(),
    plant_id: z.string().uuid("plant_id must be a valid UUID").optional(),
    status: z.enum(["pending", "completed"]).optional(),
    source: z.enum(["scheduled", "adhoc"]).optional(),
    sort: z.enum(["due_on", "created_at"]).optional().default("due_on"),
    order: z.enum(["asc", "desc"]).optional().default("asc"),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
    cursor: z.string().trim().min(1, { message: "cursor cannot be empty" }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to) {
      const fromMs = isoDateToEpochMs(data.from);
      const toMs = isoDateToEpochMs(data.to);
      const rangeDays = Math.floor((toMs - fromMs) / MS_PER_DAY) + 1;

      if (fromMs > toMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "`from` must be earlier than or equal to `to`",
          path: ["from"],
        });
      } else if (rangeDays > MAX_DATE_RANGE_DAYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`,
          path: ["to"],
        });
      }
    }

    if (data.source === "adhoc" && data.status === "pending") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "adhoc tasks cannot be filtered with status=pending",
        path: ["status"],
      });
    }
  });

export const parseGetWateringTasksQuery = (searchParams: URLSearchParams): GetWateringTasksFilters => {
  const parsed = getWateringTasksQuerySchema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    plant_id: searchParams.get("plant_id") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    order: searchParams.get("order") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });

  if (!parsed.success) {
    throw new HttpError(400, "Invalid query parameters", "VALIDATION_ERROR", {
      fields: buildValidationDetails(parsed.error),
    });
  }

  const { from, to, plant_id: plantId, status, source, sort, order, limit, cursor } = parsed.data;

  const filters: GetWateringTasksFilters = {
    from,
    to,
    plantId: plantId ?? undefined,
    status: status ?? undefined,
    source: source ?? undefined,
    sort,
    order,
    limit,
    cursor: cursor ?? undefined,
  };

  return filters;
};
