import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";

import type { APIRoute } from "astro";

import type { CalendarDayResponseDto } from "../../../types";
import { parseGetCalendarDayQuery } from "../../../lib/api/calendar/get-calendar-day-request";
import { HttpError, isHttpError } from "../../../lib/http/errors";
import { getCalendarDay } from "../../../lib/services/calendar/get-calendar-day";

export const prerender = false;

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

interface ApiEnvelope<TData> {
  data: TData | null;
  error: ApiError | null;
  meta: Record<string, unknown>;
}

const json = <TData>(status: number, envelope: ApiEnvelope<TData>): Response =>
  new Response(JSON.stringify(envelope), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/.exec(header);
  return match?.[1] ?? null;
};

const requireUserId = async (locals: App.Locals, request: Request): Promise<string> => {
  const token = getBearerToken(request);
  const { data, error } = token ? await locals.supabase.auth.getUser(token) : await locals.supabase.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "Unauthenticated", "UNAUTHENTICATED");
  }

  return data.user.id;
};

const handleHttpError = (error: HttpError, requestId: string): Response =>
  json(error.status, {
    data: null,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    meta: { request_id: requestId },
  });

const handleUnexpectedError = (requestId: string): Response =>
  json(500, {
    data: null,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    },
    meta: { request_id: requestId },
  });

export const GET: APIRoute = async ({ locals, request, url }) => {
  const requestId = randomUUID();

  try {
    const filters = parseGetCalendarDayQuery(url.searchParams);
    const userId = await requireUserId(locals, request);

    const data: CalendarDayResponseDto = await getCalendarDay(locals.supabase, {
      userId,
      ...filters,
    });

    return json(200, { data, error: null, meta: { request_id: requestId } });
  } catch (error) {
    if (isHttpError(error)) {
      logger.error("Handled error in GET /api/calendar/day", { requestId, error });
      return handleHttpError(error, requestId);
    }

    logger.error("Unhandled error in GET /api/calendar/day", { requestId, error });
    return handleUnexpectedError(requestId);
  }
};
