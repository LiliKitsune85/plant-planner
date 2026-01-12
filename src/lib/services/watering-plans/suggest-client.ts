import type { SuggestWateringPlanCommand, WateringPlanSuggestionDto } from "@/types";

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

export type SuggestWateringPlanApiErrorKind =
  | "rate_limited"
  | "timeout"
  | "provider_error"
  | "unauthenticated"
  | "not_found"
  | "validation"
  | "network"
  | "parse"
  | "http"
  | "unknown";

interface SuggestWateringPlanApiErrorOptions {
  status?: number;
  requestId?: string;
  details?: unknown;
  suggestion?: WateringPlanSuggestionDto | null;
  kind?: SuggestWateringPlanApiErrorKind;
  cause?: unknown;
}

export class SuggestWateringPlanApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly suggestion?: WateringPlanSuggestionDto | null;
  readonly kind: SuggestWateringPlanApiErrorKind;

  constructor(code: string, message: string, options: SuggestWateringPlanApiErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.code = code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.details = options.details;
    this.suggestion = options.suggestion;
    this.kind = options.kind ?? "unknown";
  }
}

const detectRequestId = (meta?: Record<string, unknown> | null): string | undefined => {
  if (!meta) return undefined;
  const value = (meta as { request_id?: unknown }).request_id;
  return typeof value === "string" ? value : undefined;
};

const detectResponseTimeBudget = (meta?: Record<string, unknown> | null): number | undefined => {
  if (!meta) return undefined;
  const value = (meta as { response_time_budget_ms?: unknown }).response_time_budget_ms;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const determineErrorKind = (status?: number, code?: string): SuggestWateringPlanApiErrorKind => {
  switch (code) {
    case "AI_RATE_LIMITED":
      return "rate_limited";
    case "AI_TIMEOUT":
      return "timeout";
    case "AI_PROVIDER_ERROR":
      return "provider_error";
    case "UNAUTHENTICATED":
      return "unauthenticated";
    case "PLANT_NOT_FOUND":
      return "not_found";
    case "VALIDATION_ERROR":
    case "INVALID_QUERY_PARAMS":
      return "validation";
    default:
      if (status === 401) return "unauthenticated";
      if (status === 404) return "not_found";
      if (status === 408) return "timeout";
      if (status === 429) return "rate_limited";
      if (status === 502) return "provider_error";
      if (status && status >= 400) return "http";
      return "unknown";
  }
};

interface RequestSuggestWateringPlanResult {
  data: WateringPlanSuggestionDto;
  requestId?: string;
  responseTimeBudgetMs?: number;
}

interface SuggestWateringPlanOptions {
  signal?: AbortSignal;
}

export const suggestWateringPlan = async (
  plantId: string,
  command: SuggestWateringPlanCommand,
  options: SuggestWateringPlanOptions = {}
): Promise<RequestSuggestWateringPlanResult> => {
  let response: Response;
  try {
    response = await fetch(`/api/plants/${plantId}/watering-plan/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(command),
      signal: options.signal,
    });
  } catch (error) {
    throw new SuggestWateringPlanApiError("NETWORK_ERROR", "Nie udało się połączyć z usługą sugestii planu.", {
      kind: "network",
      cause: error,
    });
  }

  let envelope: ApiEnvelope<WateringPlanSuggestionDto>;
  try {
    envelope = (await response.json()) as ApiEnvelope<WateringPlanSuggestionDto>;
  } catch (error) {
    throw new SuggestWateringPlanApiError("PARSE_ERROR", "Nie udało się przetworzyć odpowiedzi z usługi AI.", {
      status: response.status,
      kind: "parse",
      cause: error,
    });
  }

  const requestId = detectRequestId(envelope.meta ?? null);
  const responseTimeBudgetMs = detectResponseTimeBudget(envelope.meta ?? null);

  if (!response.ok || envelope.error || !envelope.data) {
    const code = envelope.error?.code ?? "HTTP_ERROR";
    const message = envelope.error?.message ?? `Sugestia AI nie powiodła się (status ${response.status}).`;
    throw new SuggestWateringPlanApiError(code, message, {
      status: response.status,
      requestId,
      details: envelope.error?.details,
      suggestion: envelope.data,
      kind: determineErrorKind(response.status, code),
    });
  }

  return {
    data: envelope.data,
    requestId,
    responseTimeBudgetMs,
  };
};
