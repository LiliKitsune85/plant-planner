import { z } from "zod";

import type { UpdatePlantCommand } from "../../../types";
import { HttpError } from "../../http/errors";

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
};

const isoDateStringSchema = z
  .string()
  .trim()
  .refine(isValidIsoDate, { message: "Invalid ISO date (expected YYYY-MM-DD)" });

const photoPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !/^https?:\/\//i.test(value), {
    message: "photo_path must be a storage path, not a URL",
  })
  .refine((value) => !value.startsWith("/"), {
    message: "photo_path must be a relative path",
  })
  .refine((value) => !value.includes(".."), {
    message: 'photo_path must not contain ".."',
  })
  .refine((value) => !value.includes("\\"), {
    message: "photo_path must not contain backslashes",
  })
  .refine((value) => !value.includes("?") && !value.includes("#"), {
    message: "photo_path must not contain query or fragment characters",
  });

const nullableTrimmedString = (min: number, max: number) =>
  z
    .union([z.string().trim().min(min).max(max), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      return value.length === 0 ? null : value;
    });

const updatePlantParamsSchema = z.object({
  plantId: z.string().uuid(),
});

const updatePlantBodySchema = z
  .object({
    nickname: nullableTrimmedString(1, 80),
    description: z
      .union([z.string().trim().max(10_000), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        return value.length === 0 ? null : value;
      }),
    purchase_date: z
      .union([isoDateStringSchema, z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        return value ?? null;
      }),
    photo_path: z
      .union([photoPathSchema, z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        return value ?? null;
      }),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasAnyField =
      value.nickname !== undefined ||
      value.description !== undefined ||
      value.purchase_date !== undefined ||
      value.photo_path !== undefined;

    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field must be provided",
      });
    }
  });

export type UpdatePlantParams = z.infer<typeof updatePlantParamsSchema>;
export type UpdatePlantRequestDto = z.infer<typeof updatePlantBodySchema>;

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
  new HttpError(422, message, "VALIDATION_ERROR", { issues: formatZodIssues(error.issues) });

const ensureNoImmutableFields = (body: unknown) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return;
  }

  if ("species_name" in body) {
    throw new HttpError(409, "Species name is immutable", "IMMUTABLE_FIELD", {
      field: "species_name",
    });
  }
};

export const parseUpdatePlantParams = (params: Record<string, string | undefined>): UpdatePlantParams => {
  const parsed = updatePlantParamsSchema.safeParse({
    plantId: params.plantId,
  });

  if (!parsed.success) {
    throw toValidationError("Invalid plantId", parsed.error);
  }

  return parsed.data;
};

export const parseUpdatePlantRequest = (body: unknown): UpdatePlantCommand => {
  ensureNoImmutableFields(body);

  const parsed = updatePlantBodySchema.safeParse(body);

  if (!parsed.success) {
    throw toValidationError("Invalid request body", parsed.error);
  }

  const sanitizedEntries = Object.entries(parsed.data).filter(([, value]) => value !== undefined) as [
    keyof UpdatePlantRequestDto,
    string | null,
  ][];

  if (sanitizedEntries.length === 0) {
    throw new HttpError(422, "No fields to update", "NO_FIELDS_TO_UPDATE");
  }

  return Object.fromEntries(sanitizedEntries) as UpdatePlantCommand;
};
