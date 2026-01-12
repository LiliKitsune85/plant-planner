import type { CalendarDayResponseDto } from "@/types";

import type { CalendarTaskSortField, CalendarTaskStatusFilter, SortOrder } from "./types";

interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

interface ApiEnvelope<TData> {
  data: TData | null;
  error: ApiErrorPayload | null;
  meta?: Record<string, unknown> | null;
}

export type CalendarDayApiErrorKind = "validation" | "unauthenticated" | "http" | "network" | "parse" | "unknown";

interface CalendarDayApiErrorOptions {
  status?: number;
  requestId?: string;
  details?: unknown;
  kind?: CalendarDayApiErrorKind;
  cause?: unknown;
}

export class CalendarDayApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly kind: CalendarDayApiErrorKind;

  constructor(code: string, message: string, options: CalendarDayApiErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.code = code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.details = options.details;
    this.kind = options.kind ?? "unknown";
  }
}

const buildQueryString = (params: Record<string, string | undefined>): string => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    searchParams.set(key, value);
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const detectRequestId = (meta?: Record<string, unknown> | null): string | undefined => {
  if (!meta) return undefined;
  const value = (meta as { request_id?: unknown }).request_id;
  return typeof value === "string" ? value : undefined;
};

const determineErrorKind = (status?: number, code?: string): CalendarDayApiErrorKind => {
  if (code === "VALIDATION_ERROR") return "validation";
  if (code === "UNAUTHENTICATED" || status === 401) return "unauthenticated";
  if (status && status >= 400) return "http";
  return "unknown";
};

interface GetCalendarDayParams {
  date: string;
  status?: CalendarTaskStatusFilter;
  sort?: CalendarTaskSortField;
  order?: SortOrder;
}

interface GetCalendarDayOptions {
  signal?: AbortSignal;
}

export interface GetCalendarDayResult {
  data: CalendarDayResponseDto;
  requestId?: string;
}

export const getCalendarDay = async (
  params: GetCalendarDayParams,
  options: GetCalendarDayOptions = {}
): Promise<GetCalendarDayResult> => {
  const query = buildQueryString({
    date: params.date,
    status: params.status,
    sort: params.sort,
    order: params.order,
  });

  let response: Response;
  try {
    response = await fetch(`/api/calendar/day${query}`, { signal: options.signal });
  } catch (error) {
    throw new CalendarDayApiError("NETWORK_ERROR", "Failed to reach calendar API", {
      kind: "network",
      cause: error,
    });
  }

  let envelope: ApiEnvelope<CalendarDayResponseDto>;
  try {
    envelope = (await response.json()) as ApiEnvelope<CalendarDayResponseDto>;
  } catch (error) {
    throw new CalendarDayApiError("PARSE_ERROR", "Failed to parse calendar payload", {
      status: response.status,
      kind: "parse",
      cause: error,
    });
  }

  const requestId = detectRequestId(envelope.meta ?? null);

  if (!response.ok || envelope.error || !envelope.data) {
    const errorPayload = envelope.error;
    const code = errorPayload?.code ?? "HTTP_ERROR";
    const message = errorPayload?.message ?? `Request failed with status ${response.status}`;
    throw new CalendarDayApiError(code, message, {
      status: response.status,
      requestId,
      details: errorPayload?.details,
      kind: determineErrorKind(response.status, code),
    });
  }

  return {
    data: envelope.data,
    requestId,
  };
};
