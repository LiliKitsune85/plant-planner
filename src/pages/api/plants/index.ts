import { randomUUID } from "node:crypto";
import type { APIRoute } from "astro";
import { logger } from "@/lib/logger";

import type { SupabaseClient } from "../../../db/supabase.client";
import { createAdminClient } from "../../../db/supabase.admin";
import { parseCreatePlantRequest } from "../../../lib/api/plants/create-plant-request";
import { parseListPlantsRequest } from "../../../lib/api/plants/get-plants-request";
import { requireUserId } from "../../../lib/api/auth/require-user-id";
import { HttpError, isHttpError } from "../../../lib/http/errors";
import { createPlant } from "../../../lib/services/plants/create-plant";
import { listPlants } from "../../../lib/services/plants/list-plants";
import { decodeListPlantsCursor } from "../../../lib/services/plants/list-plants-cursor";
import { suggestWateringPlan } from "../../../lib/services/watering-plans/suggest-watering-plan";
import type {
  CreatePlantResultDto,
  PlantListDto,
  PlantSummaryDto,
  WateringSuggestionForCreationDto,
} from "../../../types";

export const prerender = false;

interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

interface ApiEnvelope<TData> {
  data: TData | null;
  error: ApiErrorPayload | null;
  meta: Record<string, unknown>;
}

const json = <TData>(status: number, envelope: ApiEnvelope<TData>, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(envelope), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });

const baseHeaders = {
  "Cache-Control": "no-store",
  // Protect per-user responses when cached by shared proxies.
  Vary: "Authorization, Cookie",
};

const buildSkippedSuggestion = (): WateringSuggestionForCreationDto => ({
  status: "skipped",
  ai_request_id: null,
  explanation: null,
});

const extractAiRequestId = (error: unknown): string | null => {
  if (!isHttpError(error)) {
    return null;
  }

  const details = error.details;
  if (details && typeof details === "object" && "ai_request_id" in details) {
    const value = (details as Record<string, unknown>).ai_request_id;
    return typeof value === "string" ? value : null;
  }

  return null;
};

const logAiSuggestionFailure = (error: unknown, plantId: string, userId: string) => {
  logger.error("Failed to generate AI watering suggestion during plant creation", {
    error,
    plantId,
    userId,
  });
};

interface GenerateWateringSuggestionParams {
  supabaseUser: SupabaseClient;
  supabaseAdmin: SupabaseClient;
  userId: string;
  plant: PlantSummaryDto;
}

const AI_FAILURE_MESSAGE = "AI watering suggestion is temporarily unavailable. Configure the plan manually.";

const mapAiFailureStatus = (error: unknown): "timeout" | "provider_error" | "unknown_error" => {
  if (isHttpError(error)) {
    if (error.code === "AI_TIMEOUT") return "timeout";
    if (error.code === "AI_PROVIDER_ERROR") return "provider_error";
  }
  return "unknown_error";
};

const generateWateringSuggestion = async ({
  supabaseUser,
  supabaseAdmin,
  userId,
  plant,
}: GenerateWateringSuggestionParams): Promise<WateringSuggestionForCreationDto> => {
  try {
    const result = await suggestWateringPlan(
      { supabaseUser, supabaseAdmin },
      {
        userId,
        plantId: plant.id,
        command: {
          context: { species_name: plant.species_name },
        },
      }
    );

    if (result.status === "rate_limited") {
      const unlockAt = result.quota.unlock_at ?? result.quota.window_resets_at;
      return {
        status: "rate_limited",
        ai_request_id: result.suggestion.ai_request_id,
        unlock_at: unlockAt,
      };
    }

    const suggestion = result.suggestion;

    if (!suggestion.suggestion) {
      throw new HttpError(500, "AI suggestion payload is invalid", "AI_SUGGESTION_INVALID");
    }

    return {
      status: "available",
      ai_request_id: suggestion.ai_request_id,
      explanation: suggestion.explanation ?? "AI suggestion ready.",
      ...suggestion.suggestion,
    };
  } catch (error) {
    logAiSuggestionFailure(error, plant.id, userId);
    const status = mapAiFailureStatus(error);
    const message = isHttpError(error) ? error.message : AI_FAILURE_MESSAGE;
    const code = isHttpError(error) ? error.code : undefined;
    return {
      status,
      ai_request_id: extractAiRequestId(error),
      message,
      code,
    };
  }
};

export const GET: APIRoute = async ({ locals, request, url }) => {
  const requestId = randomUUID();

  try {
    const query = parseListPlantsRequest(url.searchParams);
    const userId = await requireUserId(locals, request);

    if (query.cursor) {
      decodeListPlantsCursor(query.cursor, {
        userId,
        sort: query.sort,
        order: query.order,
      });
    }

    const result = await listPlants(locals.supabase, { userId, query });
    const data: PlantListDto = { items: result.items };

    return json(
      200,
      {
        data,
        error: null,
        meta: { next_cursor: result.nextCursor, request_id: requestId },
      },
      baseHeaders
    );
  } catch (error) {
    if (isHttpError(error)) {
      return json(
        error.status,
        {
          data: null,
          error: { code: error.code, message: error.message, details: error.details },
          meta: { request_id: requestId },
        },
        baseHeaders
      );
    }

    logger.error("Unhandled error in GET /api/plants", { error });

    return json(
      500,
      {
        data: null,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
        meta: { request_id: requestId },
      },
      baseHeaders
    );
  }
};

export const POST: APIRoute = async ({ locals, request, url }) => {
  const requestId = randomUUID();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body", "INVALID_JSON");
    }

    const command = parseCreatePlantRequest(body);
    const userId = await requireUserId(locals, request);

    const plant = await createPlant(locals.supabase, { userId, plant: command });

    let watering_suggestion: WateringSuggestionForCreationDto;

    if (!command.generate_watering_suggestion) {
      watering_suggestion = buildSkippedSuggestion();
    } else {
      const supabaseAdmin = createAdminClient();
      watering_suggestion = await generateWateringSuggestion({
        supabaseUser: locals.supabase,
        supabaseAdmin,
        userId,
        plant,
      });
    }

    const result: CreatePlantResultDto = { plant, watering_suggestion };

    return json(
      201,
      { data: result, error: null, meta: { request_id: requestId } },
      {
        ...baseHeaders,
        Location: new URL(`/api/plants/${plant.id}`, url).toString(),
      }
    );
  } catch (error) {
    if (isHttpError(error)) {
      return json(
        error.status,
        {
          data: null,
          error: { code: error.code, message: error.message, details: error.details },
          meta: { request_id: requestId },
        },
        baseHeaders
      );
    }

    logger.error("Unhandled error in POST /api/plants", { error });

    return json(
      500,
      {
        data: null,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
        meta: { request_id: requestId },
      },
      baseHeaders
    );
  }
};
