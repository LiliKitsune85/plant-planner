import type { APIRoute } from "astro";

import type { SupabaseClient } from "../../../db/supabase.client";
import { createAdminClient } from "../../../db/supabase.admin";
import { parseCreatePlantRequest } from "../../../lib/api/plants/create-plant-request";
import { parseListPlantsRequest } from "../../../lib/api/plants/get-plants-request";
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

type ApiEnvelope<TData> = {
  data: TData | null;
  error: { code: string; message: string } | null;
  meta: Record<string, unknown>;
};

const json = <TData>(
  status: number,
  envelope: ApiEnvelope<TData>,
  headers?: HeadersInit,
): Response =>
  new Response(JSON.stringify(envelope), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });

const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/.exec(header);
  return match?.[1] ?? null;
};

const requireUserId = async (locals: App.Locals, request: Request) => {
  const token = getBearerToken(request);
  const { data, error } = token
    ? await locals.supabase.auth.getUser(token)
    : await locals.supabase.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "Unauthenticated", "UNAUTHENTICATED");
  }

  return data.user.id;
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
  console.error("Failed to generate AI watering suggestion during plant creation", {
    error,
    plantId,
    userId,
  });
};

type GenerateWateringSuggestionParams = {
  supabaseUser: SupabaseClient;
  supabaseAdmin: SupabaseClient;
  userId: string;
  plant: PlantSummaryDto;
};

const AI_FAILURE_MESSAGE =
  "AI watering suggestion is temporarily unavailable. Configure the plan manually.";

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
      },
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
    return {
      status: "error",
      ai_request_id: extractAiRequestId(error),
      explanation: AI_FAILURE_MESSAGE,
    };
  }
};

export const GET: APIRoute = async ({ locals, request, url }) => {
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

    return json(200, {
      data,
      error: null,
      meta: { next_cursor: result.nextCursor },
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json(error.status, {
        data: null,
        error: { code: error.code, message: error.message },
        meta: {},
      });
    }

    console.error("Unhandled error in GET /api/plants", { error });

    return json(500, {
      data: null,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      meta: {},
    });
  }
};

export const POST: APIRoute = async ({ locals, request, url }) => {
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
      { data: result, error: null, meta: {} },
      {
        "Cache-Control": "no-store",
        Location: new URL(`/api/plants/${plant.id}`, url).toString(),
      },
    );
  } catch (error) {
    if (isHttpError(error)) {
      return json(
        error.status,
        {
          data: null,
          error: { code: error.code, message: error.message },
          meta: {},
        },
        { "Cache-Control": "no-store" },
      );
    }

    console.error("Unhandled error in POST /api/plants", { error });

    return json(
      500,
      {
        data: null,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
        meta: {},
      },
      { "Cache-Control": "no-store" },
    );
  }
};

