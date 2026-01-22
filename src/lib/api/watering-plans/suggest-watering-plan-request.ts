import { z } from "zod";

import type { SuggestWateringPlanCommand } from "../../../types";
import { HttpError } from "../../http/errors";

const MAX_SPECIES_NAME_LENGTH = 120;

const normalizeWhitespace = (input: string): string => input.trim().replace(/\s+/g, " ");

const speciesNameSchema = z
  .string({
    required_error: "species_name is required",
    invalid_type_error: "species_name must be a string",
  })
  .transform((value) => normalizeWhitespace(value))
  .refine((value) => value.length > 0, { message: "species_name is required" })
  .refine((value) => value.length <= MAX_SPECIES_NAME_LENGTH, {
    message: `species_name must be at most ${MAX_SPECIES_NAME_LENGTH} characters`,
  });

const suggestWateringPlanPayloadSchema: z.ZodType<SuggestWateringPlanCommand> = z
  .object({
    context: z
      .object({
        species_name: speciesNameSchema,
      })
      .strict(),
  })
  .strict();

const suggestWateringPlanParamsSchema = z.object({
  plantId: z.string().uuid(),
});

export type SuggestWateringPlanParams = z.infer<typeof suggestWateringPlanParamsSchema>;

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

const buildValidationError = (message: string, error: z.ZodError) =>
  new HttpError(422, message, "VALIDATION_ERROR", { issues: formatZodIssues(error.issues) });

export const parseSuggestWateringPlanParams = (params: Record<string, string | undefined>) => {
  const parsed = suggestWateringPlanParamsSchema.safeParse({ plantId: params.plantId });

  if (!parsed.success) {
    throw buildValidationError("Invalid plantId", parsed.error);
  }

  return parsed.data;
};

export const parseSuggestWateringPlanRequest = (body: unknown): SuggestWateringPlanCommand => {
  const parsed = suggestWateringPlanPayloadSchema.safeParse(body);

  if (!parsed.success) {
    throw buildValidationError("Invalid request body", parsed.error);
  }

  return parsed.data;
};
