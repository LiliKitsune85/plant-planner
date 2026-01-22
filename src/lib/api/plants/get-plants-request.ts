import { z } from "zod";

import { HttpError } from "../../http/errors";
import type { ListPlantsQuery } from "../../services/plants/types";

const MAX_QUERY_LENGTH = 120;
const MAX_SPECIES_LENGTH = 120;
const DEFAULT_LIMIT = 20;

const getPlantsQuerySchema = z.object({
  q: z.string().trim().min(1).max(MAX_QUERY_LENGTH).optional(),
  species: z.string().trim().min(1).max(MAX_SPECIES_LENGTH).optional(),
  sort: z.enum(["created_at", "species_name", "updated_at"]).optional().default("created_at"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(DEFAULT_LIMIT),
  cursor: z.string().trim().min(1).optional(),
});

const normalizeSpeciesName = (input: string): string => input.trim().toLowerCase().replace(/\s+/g, " ");

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

export const parseListPlantsRequest = (searchParams: URLSearchParams): ListPlantsQuery => {
  const parsed = getPlantsQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    species: searchParams.get("species") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    order: searchParams.get("order") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });

  if (!parsed.success) {
    throw toValidationError("Invalid query parameters", parsed.error);
  }

  const { q, species, sort, order, limit, cursor } = parsed.data;

  return {
    search: q ?? undefined,
    speciesNormalized: species ? normalizeSpeciesName(species) : undefined,
    sort,
    order,
    limit,
    cursor: cursor ?? undefined,
  };
};
