import { z } from "zod";

import type { AdhocWateringCommand } from "../../../types";
import { HttpError } from "../../http/errors";

const isValidIsoDate = (value: string): boolean => {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.toISOString().slice(0, 10) === value;
};

const isoDateStringSchema = z
  .string()
  .trim()
  .refine(isValidIsoDate, { message: "Invalid ISO date (expected YYYY-MM-DD)" });

const noteInputSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= 500, {
    message: "Note must be at most 500 characters",
  });

const AdhocWateringPayloadSchema: z.ZodType<AdhocWateringCommand> = z
  .object({
    completed_on: isoDateStringSchema,
    note: noteInputSchema,
  })
  .strict()
  .transform((value) => ({
    completed_on: value.completed_on,
    note: value.note ?? null,
  }));

const AdhocWateringParamsSchema = z.object({
  plantId: z.string().uuid(),
});

interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

const formatZodIssues = (issues: z.ZodIssue[]): ValidationIssue[] =>
  issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "(body)",
    message: issue.message,
    code: issue.code,
  }));

const toValidationError = (message: string, error: z.ZodError) =>
  new HttpError(400, message, "VALIDATION_ERROR", { issues: formatZodIssues(error.issues) });

export type AdhocWateringParams = z.infer<typeof AdhocWateringParamsSchema>;

export const parseAdhocWateringParams = (params: Record<string, string | undefined>): AdhocWateringParams => {
  const parsed = AdhocWateringParamsSchema.safeParse({ plantId: params.plantId });
  if (!parsed.success) {
    throw new HttpError(400, "Invalid plantId", "INVALID_PLANT_ID");
  }

  return parsed.data;
};

export const parseAdhocWateringRequest = (body: unknown): AdhocWateringCommand => {
  const parsed = AdhocWateringPayloadSchema.safeParse(body);
  if (!parsed.success) {
    throw toValidationError("Invalid request body", parsed.error);
  }

  return parsed.data;
};
