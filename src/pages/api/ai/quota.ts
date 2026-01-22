import type { APIRoute } from "astro";
import { logger } from "@/lib/logger";

import type { AiQuotaDto } from "../../../types";
import { isHttpError } from "../../../lib/http/errors";
import { requireUserId } from "../../../lib/api/auth/require-user-id";
import { getAiQuota } from "../../../lib/services/ai/ai-quota";

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

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    logger.info("GET /api/ai/quota - Starting request");

    const userId = await requireUserId(locals, request);
    const quota = await getAiQuota(locals.supabase, { userId });

    return json<AiQuotaDto>(200, { data: quota, error: null, meta: {} }, baseHeaders);
  } catch (error) {
    if (isHttpError(error)) {
      return json(
        error.status,
        {
          data: null,
          error: { code: error.code, message: error.message, details: error.details },
          meta: {},
        },
        baseHeaders
      );
    }

    logger.error("Unhandled error in GET /api/ai/quota", { error });

    return json(
      500,
      {
        data: null,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
        meta: {},
      },
      baseHeaders
    );
  }
};
