import type { DeleteWateringTaskResultDto, UpdateWateringTaskCommand, UpdateWateringTaskResultDto } from "@/types";

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

export type WateringTaskApiErrorKind =
  | "validation"
  | "conflict"
  | "notFound"
  | "unauthenticated"
  | "http"
  | "network"
  | "parse"
  | "unknown";

interface WateringTaskApiErrorOptions {
  status?: number;
  requestId?: string;
  details?: unknown;
  kind?: WateringTaskApiErrorKind;
  cause?: unknown;
}

export class WateringTaskApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly kind: WateringTaskApiErrorKind;

  constructor(code: string, message: string, options: WateringTaskApiErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.code = code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.details = options.details;
    this.kind = options.kind ?? "unknown";
  }
}

const detectRequestId = (meta?: Record<string, unknown> | null): string | undefined => {
  if (!meta) return undefined;
  const value = (meta as { request_id?: unknown }).request_id;
  return typeof value === "string" ? value : undefined;
};

const determineErrorKind = (status?: number, code?: string): WateringTaskApiErrorKind => {
  if (code === "VALIDATION_ERROR") return "validation";
  if (code === "CONSTRAINT_VIOLATION" || code === "TASK_ALREADY_EXISTS" || code === "NOT_ALLOWED") {
    return "conflict";
  }
  if (code === "WATERING_TASK_NOT_FOUND") return "notFound";
  if (code === "UNAUTHENTICATED" || status === 401) return "unauthenticated";
  if (status && status >= 400) return "http";
  return "unknown";
};

export const requestWateringTaskApi = async <TData>(
  input: RequestInfo,
  init: RequestInit
): Promise<{ data: TData; requestId?: string }> => {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    throw new WateringTaskApiError("NETWORK_ERROR", "Failed to reach watering task API", {
      kind: "network",
      cause: error,
    });
  }

  let envelope: ApiEnvelope<TData>;
  try {
    envelope = (await response.json()) as ApiEnvelope<TData>;
  } catch (error) {
    throw new WateringTaskApiError("PARSE_ERROR", "Failed to parse watering task payload", {
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
    throw new WateringTaskApiError(code, message, {
      status: response.status,
      requestId,
      details: errorPayload?.details,
      kind: determineErrorKind(response.status, code),
    });
  }

  return { data: envelope.data, requestId };
};

interface UpdateWateringTaskOptions {
  signal?: AbortSignal;
}

export const updateWateringTask = async (
  taskId: string,
  command: UpdateWateringTaskCommand,
  options: UpdateWateringTaskOptions = {}
): Promise<{ data: UpdateWateringTaskResultDto; requestId?: string }> =>
  requestWateringTaskApi<UpdateWateringTaskResultDto>(`/api/watering-tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
    signal: options.signal,
  });

interface DeleteWateringTaskOptions {
  signal?: AbortSignal;
}

export const deleteWateringTask = async (
  taskId: string,
  options: DeleteWateringTaskOptions = {}
): Promise<{ data: DeleteWateringTaskResultDto; requestId?: string }> =>
  requestWateringTaskApi<DeleteWateringTaskResultDto>(`/api/watering-tasks/${taskId}?confirm=true`, {
    method: "DELETE",
    signal: options.signal,
  });
