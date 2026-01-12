import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";

import type { APIRoute } from "astro";

import { parseSignInRequest } from "../../../lib/api/auth/sign-in-request";
import { HttpError, isHttpError } from "../../../lib/http/errors";
import { signIn } from "../../../lib/services/auth/sign-in";
import type { MeResponseDto } from "../../../types";

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
      "Cache-Control": "no-store",
      ...headers,
    },
  });

const buildRequestId = (): string => {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const requestId = buildRequestId();

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body", "INVALID_JSON");
    }

    const command = parseSignInRequest(body);
    const result = await signIn(locals.supabase, command);

    return json<MeResponseDto>(200, {
      data: result,
      error: null,
      meta: { request_id: requestId },
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json<MeResponseDto>(error.status, {
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
        meta: { request_id: requestId },
      });
    }

    logger.error("Unhandled error in POST /api/auth/sign-in", { error, requestId });

    return json<MeResponseDto>(500, {
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
      meta: { request_id: requestId },
    });
  }
};
