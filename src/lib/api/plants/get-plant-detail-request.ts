import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { HttpError } from "../../http/errors";

const plantIdParamSchema = z.object({
  plantId: z.string().uuid(),
});

export type PlantIdParams = z.infer<typeof plantIdParamSchema>;

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

export const parsePlantIdParams = (params: Record<string, string | undefined>): PlantIdParams => {
  const parsed = plantIdParamSchema.safeParse({ plantId: params.plantId });
  if (!parsed.success) {
    throw toValidationError("Invalid plantId", parsed.error);
  }

  return parsed.data;
};

export const requireAuthUser = async (locals: App.Locals): Promise<User> => {
  const { data, error } = await locals.supabase.auth.getUser();
  if (error || !data.user) {
    throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
  }

  return data.user;
};
