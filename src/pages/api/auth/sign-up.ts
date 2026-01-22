import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";

import type { APIRoute } from "astro";

import { parseSignUpRequest } from "../../../lib/api/auth/sign-up-request";
import { HttpError, isHttpError } from "../../../lib/http/errors";
import { signUp } from "../../../lib/services/auth/sign-up";
import type { SignUpResultDto } from "../../../types";
import { createAdminClient } from "../../../db/supabase.admin";

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

const buildRedirectUrl = (requestUrl: URL, returnTo?: string | null): string => {
  const callbackUrl = new URL("/auth/callback", requestUrl);
  if (returnTo) {
    callbackUrl.searchParams.set("returnTo", returnTo);
  }
  return callbackUrl.toString();
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

    const payload = parseSignUpRequest(body);
    const redirectTo = buildRedirectUrl(new URL(request.url), payload.returnTo ?? null);
    const supabaseAdmin = createAdminClient();
    const result = await signUp(locals.supabase, supabaseAdmin, payload, redirectTo);

    return json<SignUpResultDto>(200, {
      data: result,
      error: null,
      meta: { request_id: requestId },
    });
  } catch (error) {
    if (isHttpError(error)) {
      return json<SignUpResultDto>(error.status, {
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
        meta: { request_id: requestId },
      });
    }

    logger.error("Unhandled error in POST /api/auth/sign-up", { error, requestId });

    return json<SignUpResultDto>(500, {
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
      meta: { request_id: requestId },
    });
  }
};
