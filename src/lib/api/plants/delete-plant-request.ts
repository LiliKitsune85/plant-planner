import { z } from "zod";

import { HttpError } from "../../http/errors";

const deletePlantParamsSchema = z.object({
  plantId: z.string().uuid(),
});

const deletePlantQuerySchema = z.object({
  // Safety confirmation against accidental deletes.
  confirm: z.literal("true"),
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
  new HttpError(422, message, "VALIDATION_ERROR", { issues: formatZodIssues(error.issues) });

export type DeletePlantParams = z.infer<typeof deletePlantParamsSchema>;
export type DeletePlantQuery = z.infer<typeof deletePlantQuerySchema>;

export type DeletePlantRequest = DeletePlantParams & DeletePlantQuery;

export const parseDeletePlantRequest = (
  params: Record<string, string | undefined>,
  searchParams: URLSearchParams
): DeletePlantRequest => {
  const parsedParams = deletePlantParamsSchema.safeParse({
    plantId: params.plantId,
  });

  if (!parsedParams.success) {
    throw toValidationError("Invalid plantId", parsedParams.error);
  }

  const parsedQuery = deletePlantQuerySchema.safeParse({
    confirm: searchParams.get("confirm"),
  });

  if (!parsedQuery.success) {
    throw new HttpError(400, "Confirmation required (confirm=true)", "CONFIRMATION_REQUIRED");
  }

  return {
    ...parsedParams.data,
    ...parsedQuery.data,
  };
};
