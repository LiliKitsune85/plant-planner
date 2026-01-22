import { z } from "zod";

import { HttpError } from "../../http/errors";

const DeleteWateringTaskParamsSchema = z.object({
  taskId: z.string().uuid(),
});

const DeleteWateringTaskQuerySchema = z.object({
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

export type DeleteWateringTaskParams = z.infer<typeof DeleteWateringTaskParamsSchema>;
export type DeleteWateringTaskQuery = z.infer<typeof DeleteWateringTaskQuerySchema>;
export type DeleteWateringTaskRequest = DeleteWateringTaskParams & DeleteWateringTaskQuery;

export const parseDeleteWateringTaskRequest = (
  params: Record<string, string | undefined>,
  searchParams: URLSearchParams
): DeleteWateringTaskRequest => {
  const parsedParams = DeleteWateringTaskParamsSchema.safeParse({
    taskId: params.taskId,
  });

  if (!parsedParams.success) {
    throw toValidationError("Invalid taskId", parsedParams.error);
  }

  const parsedQuery = DeleteWateringTaskQuerySchema.safeParse({
    confirm: searchParams.get("confirm"),
  });

  if (!parsedQuery.success) {
    throw new HttpError(400, "Confirmation is required (confirm=true)", "CONFIRMATION_REQUIRED");
  }

  return {
    ...parsedParams.data,
    ...parsedQuery.data,
  };
};
