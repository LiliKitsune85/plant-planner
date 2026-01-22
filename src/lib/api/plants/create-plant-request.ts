import { z } from "zod";

import type { CreatePlantCommand } from "../../../types";
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
      if (value === undefined || value === null) return null;
      return value.length === 0 ? null : value;
    });

const createPlantBodySchema = z
  .object({
    species_name: z.string().trim().min(1).max(120),
    nickname: nullableTrimmedString(1, 80),
    description: z
      .union([z.string().trim().max(10_000), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined || value === null) return null;
        return value.length === 0 ? null : value;
      }),
    purchase_date: z
      .union([isoDateStringSchema, z.null()])
      .optional()
      .transform((value) => value ?? null),
    photo_path: z
      .union([photoPathSchema, z.null()])
      .optional()
      .transform((value) => value ?? null),
    generate_watering_suggestion: z.boolean().optional().default(true),
  })
  .strict();

export const parseCreatePlantRequest = (body: unknown): CreatePlantCommand => {
  const parsed = createPlantBodySchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join(".") : "(body)",
      message: issue.message,
      code: issue.code,
    }));
    throw new HttpError(422, "Invalid request body", "VALIDATION_ERROR", { issues });
  }

  return parsed.data;
};
