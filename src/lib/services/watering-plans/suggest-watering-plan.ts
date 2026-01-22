import type { SupabaseClient } from "../../../db/supabase.client";
import { logger } from "@/lib/logger";
import type {
  AiQuotaDto,
  SuggestWateringPlanCommand,
  WateringPlanConfigFields,
  WateringPlanSuggestionDto,
} from "../../../types";
import { z } from "zod";
import { HttpError, isHttpError } from "../../http/errors";
import { getAiQuota } from "../ai/ai-quota";
import { createAiRequest, markAiRequestError, markAiRequestRateLimited, markAiRequestSuccess } from "../ai/ai-requests";
import type { OpenRouterChatMessageInput, ResponseFormatJsonSchema } from "../openrouter.service";
import { OpenRouterService } from "../openrouter.service";

interface SuggestWateringPlanClients {
  supabaseUser: SupabaseClient;
  supabaseAdmin: SupabaseClient;
}

interface ServiceParams {
  userId: string;
  plantId: string;
  command: SuggestWateringPlanCommand;
  now?: Date;
}

interface SuggestWateringPlanSuccess {
  status: "success";
  suggestion: WateringPlanSuggestionDto;
  quota: AiQuotaDto;
}

interface SuggestWateringPlanRateLimited {
  status: "rate_limited";
  suggestion: WateringPlanSuggestionDto;
  quota: AiQuotaDto;
}

export type SuggestWateringPlanServiceResult = SuggestWateringPlanSuccess | SuggestWateringPlanRateLimited;

const ensurePlantOwnership = async (supabaseUser: SupabaseClient, userId: string, plantId: string): Promise<void> => {
  const { data, error } = await supabaseUser
    .from("plants")
    .select("id")
    .eq("id", plantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("suggestWateringPlan: plant lookup failed", { error, userId, plantId });
    throw new HttpError(500, "Failed to verify plant ownership", "PLANT_LOOKUP_FAILED");
  }

  if (!data) {
    throw new HttpError(404, "Plant not found", "PLANT_NOT_FOUND");
  }
};

const EXPLANATION_MAX_LENGTH = 800;
const MAX_CUSTOM_DATE_LENGTH = 10;

const isValidIsoDate = (value: string): boolean => {
  if (value.length !== MAX_CUSTOM_DATE_LENGTH) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
};

const isoDateSchema = z
  .string()
  .trim()
  .refine(isValidIsoDate, { message: "Invalid custom_start_on date (expected YYYY-MM-DD)" });

const suggestionSchema = z
  .object({
    interval_days: z.number().int().min(1).max(365),
    horizon_days: z.number().int().min(1).max(365),
    schedule_basis: z.enum(["due_on", "completed_on"]),
    start_from: z.enum(["today", "purchase_date", "custom_date"]),
    custom_start_on: z.union([isoDateSchema, z.null()]).optional(),
    overdue_policy: z.enum(["carry_forward", "reschedule"]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.start_from === "custom_date" && !value.custom_start_on) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_start_on"],
        message: "custom_start_on is required when start_from is custom_date",
      });
    }

    if (value.start_from !== "custom_date" && value.custom_start_on) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_start_on"],
        message: "custom_start_on must be null unless start_from is custom_date",
      });
    }
  });

const responseSchema = z
  .object({
    suggestion: suggestionSchema,
    explanation: z
      .string()
      .trim()
      .min(1, "explanation is required")
      .max(EXPLANATION_MAX_LENGTH, `explanation must be <= ${EXPLANATION_MAX_LENGTH} characters`),
  })
  .strict();

type WateringPlanModelResponse = z.infer<typeof responseSchema>;

const toWateringPlanConfig = (value: z.infer<typeof suggestionSchema>): WateringPlanConfigFields => ({
  interval_days: value.interval_days,
  horizon_days: value.horizon_days,
  schedule_basis: value.schedule_basis,
  start_from: value.start_from,
  custom_start_on: value.custom_start_on ?? null,
  overdue_policy: value.overdue_policy,
});

const resolveOpenRouterConfig = () => ({
  apiKey: import.meta.env.OPENROUTER_API_KEY ?? "",
  defaultModel: import.meta.env.OPENROUTER_MODEL ?? undefined,
  appUrl: import.meta.env.APP_BASE_URL ?? "https://plant-planner.app",
  appTitle: "Plant Planner",
});

interface ServiceResources {
  service: OpenRouterService;
  responseFormat: ResponseFormatJsonSchema;
}

const WATERING_PLAN_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestion", "explanation"],
  properties: {
    suggestion: {
      type: "object",
      additionalProperties: false,
      required: ["interval_days", "horizon_days", "schedule_basis", "start_from", "custom_start_on", "overdue_policy"],
      properties: {
        interval_days: { type: "integer", minimum: 1, maximum: 365 },
        horizon_days: { type: "integer", minimum: 1, maximum: 365 },
        schedule_basis: { type: "string", enum: ["due_on", "completed_on"] },
        start_from: { type: "string", enum: ["today", "purchase_date", "custom_date"] },
        custom_start_on: {
          anyOf: [{ type: "string", format: "date" }, { type: "null" }],
        },
        overdue_policy: { type: "string", enum: ["carry_forward", "reschedule"] },
      },
    },
    explanation: { type: "string", minLength: 1, maxLength: EXPLANATION_MAX_LENGTH },
  },
} as const;

const resolveServiceResources = (() => {
  let cached: ServiceResources | null = null;
  return (): ServiceResources => {
    if (cached) return cached;

    const service = new OpenRouterService(resolveOpenRouterConfig());
    const responseFormat = service.buildResponseFormatJsonSchema(
      "watering_plan_suggestion_v1",
      WATERING_PLAN_RESPONSE_SCHEMA
    );

    cached = { service, responseFormat };
    return cached;
  };
})();

const buildMessages = (speciesName: string): OpenRouterChatMessageInput[] => [
  {
    role: "system",
    content:
      "You are a horticulture assistant that suggests concise watering schedules. " +
      "Return the explanation in Polish. " +
      "Return ONLY a valid JSON object that matches the provided schema. " +
      "Do not include any extra keys, comments, markdown, or prose. " +
      "If you cannot comply, still return a JSON object that matches the schema with best-effort values. " +
      "Base your recommendation only on the user supplied species name.",
  },
  {
    role: "user",
    content:
      "Provide a watering plan suggestion for the following plant species.\n" +
      "Respond with ONLY JSON that matches the schema (no extra keys).\n\n" +
      `species_name: ${speciesName}`,
  },
];

const WATERING_PLAN_MODEL_PARAMS = {
  temperature: 0.2,
  top_p: 0.9,
  max_tokens: 500,
  presence_penalty: 0,
  frequency_penalty: 0.2,
} as const;

const buildRateLimitedSuggestion = (aiRequestId: string): WateringPlanSuggestionDto => ({
  ai_request_id: aiRequestId,
  suggestion: null,
  explanation: null,
});

const withAiRequestDetails = (details: unknown, aiRequestId: string): Record<string, unknown> => {
  if (details && typeof details === "object") {
    return {
      ...(details as Record<string, unknown>),
      ai_request_id: aiRequestId,
    };
  }

  return { ai_request_id: aiRequestId };
};

export const suggestWateringPlan = async (
  clients: SuggestWateringPlanClients,
  { userId, plantId, command, now }: ServiceParams
): Promise<SuggestWateringPlanServiceResult> => {
  const { supabaseUser, supabaseAdmin } = clients;

  await ensurePlantOwnership(supabaseUser, userId, plantId);

  const quota = await getAiQuota(supabaseUser, { userId, now });
  const aiRequestId = await createAiRequest(supabaseAdmin, { userId, plantId });

  if (quota.is_rate_limited) {
    await markAiRequestRateLimited(supabaseAdmin, {
      id: aiRequestId,
      message: "Hourly AI quota exceeded",
    });

    return {
      status: "rate_limited",
      suggestion: buildRateLimitedSuggestion(aiRequestId),
      quota,
    };
  }

  const { service, responseFormat } = resolveServiceResources();

  try {
    const aiResult = await service.chatJson<WateringPlanModelResponse>(
      {
        messages: buildMessages(command.context.species_name),
        responseFormat,
        modelParams: WATERING_PLAN_MODEL_PARAMS,
      },
      responseSchema
    );

    await markAiRequestSuccess(supabaseAdmin, {
      id: aiRequestId,
      model: aiResult.model,
      metrics: {
        latencyMs: aiResult.latencyMs,
        promptTokens: aiResult.usage.promptTokens ?? undefined,
        completionTokens: aiResult.usage.completionTokens ?? undefined,
        totalTokens: aiResult.usage.totalTokens ?? undefined,
      },
    });
    logger.info("suggestWateringPlan: AI response accepted", {
      aiRequestId,
      model: aiResult.model,
      latencyMs: aiResult.latencyMs,
      promptTokens: aiResult.usage.promptTokens,
      completionTokens: aiResult.usage.completionTokens,
      totalTokens: aiResult.usage.totalTokens,
    });

    const parsedSuggestion = toWateringPlanConfig(aiResult.data.suggestion);

    return {
      status: "success",
      suggestion: {
        ai_request_id: aiRequestId,
        suggestion: parsedSuggestion,
        explanation: aiResult.data.explanation,
      },
      quota,
    };
  } catch (error) {
    if (isHttpError(error)) {
      await markAiRequestError(supabaseAdmin, {
        id: aiRequestId,
        code: error.code,
        message: error.message,
      });
      logger.warn("suggestWateringPlan: AI provider error", {
        aiRequestId,
        code: error.code,
        message: error.message,
        details: error.details,
      });
      throw new HttpError(error.status, error.message, error.code, withAiRequestDetails(error.details, aiRequestId));
    }

    await markAiRequestError(supabaseAdmin, {
      id: aiRequestId,
      code: "AI_PROVIDER_ERROR",
      message: "AI provider failed unexpectedly",
    });

    logger.error("Unhandled error while suggesting watering plan", { error, aiRequestId });
    throw new HttpError(
      500,
      "AI provider failed unexpectedly",
      "AI_PROVIDER_ERROR",
      withAiRequestDetails(null, aiRequestId)
    );
  }
};
