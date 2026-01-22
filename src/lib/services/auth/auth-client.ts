import type { MeResponseDto, SignInCommand, SignUpCommand, SignUpResultDto } from "@/types";

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

type FieldErrors = Record<string, string[]>;

export type AuthApiErrorKind =
  | "validation"
  | "invalidCredentials"
  | "rateLimited"
  | "unauthenticated"
  | "http"
  | "network"
  | "parse"
  | "unknown";

interface AuthApiErrorOptions {
  status?: number;
  requestId?: string;
  details?: unknown;
  fieldErrors?: FieldErrors;
  kind?: AuthApiErrorKind;
  cause?: unknown;
}

export class AuthApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly fieldErrors?: FieldErrors;
  readonly kind: AuthApiErrorKind;

  constructor(code: string, message: string, options: AuthApiErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.code = code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.details = options.details;
    this.fieldErrors = options.fieldErrors;
    this.kind = options.kind ?? "unknown";
  }
}

const mapIssuesToFieldErrors = (issues: unknown[]): FieldErrors | undefined => {
  if (!issues.length) return undefined;
  return issues.reduce<FieldErrors>((acc, issue) => {
    if (!issue || typeof issue !== "object") return acc;
    const pathValue = (issue as { path?: unknown }).path;
    const messageValue = (issue as { message?: unknown }).message;
    const path =
      Array.isArray(pathValue) && pathValue.length
        ? pathValue.join(".")
        : typeof pathValue === "string" && pathValue.length
          ? pathValue
          : "form";
    const message = typeof messageValue === "string" && messageValue.length ? messageValue : "Niepoprawna wartość.";
    if (acc[path]) {
      acc[path] = [...acc[path], message];
    } else {
      acc[path] = [message];
    }
    return acc;
  }, {});
};

const extractFieldErrors = (details: unknown): FieldErrors | undefined => {
  if (!details || typeof details !== "object") return undefined;

  const maybeFieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (maybeFieldErrors && typeof maybeFieldErrors === "object") {
    const entries = Object.entries(maybeFieldErrors as Record<string, unknown>);
    const normalized = entries.reduce<FieldErrors>((acc, [key, value]) => {
      if (!Array.isArray(value)) return acc;
      const messages = value.filter((item): item is string => typeof item === "string" && item.length);
      if (messages.length) {
        acc[key] = messages;
      }
      return acc;
    }, {});
    if (Object.keys(normalized).length) {
      return normalized;
    }
  }

  const issues = (details as { issues?: unknown }).issues;
  if (Array.isArray(issues)) {
    return mapIssuesToFieldErrors(issues);
  }

  return undefined;
};

const detectRequestId = (meta?: Record<string, unknown> | null): string | undefined => {
  if (!meta) return undefined;
  const value = (meta as { request_id?: unknown }).request_id;
  return typeof value === "string" ? value : undefined;
};

const determineErrorKind = (status?: number, code?: string): AuthApiErrorKind => {
  if (code === "VALIDATION_ERROR" || status === 422) return "validation";
  if (code === "INVALID_CREDENTIALS") return "invalidCredentials";
  if (code === "RATE_LIMITED" || status === 429) return "rateLimited";
  if (code === "UNAUTHENTICATED" || status === 401) return "unauthenticated";
  if (status && status >= 400) return "http";
  return "unknown";
};

interface RequestAuthApiResult<TData> {
  response: Response;
  envelope: ApiEnvelope<TData>;
}

const requestAuthApi = async <TData>(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<RequestAuthApiResult<TData>> => {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    throw new AuthApiError("NETWORK_ERROR", "Nie udało się połączyć z serwerem.", {
      kind: "network",
      cause: error,
    });
  }

  let envelope: ApiEnvelope<TData>;
  try {
    envelope = (await response.json()) as ApiEnvelope<TData>;
  } catch (error) {
    throw new AuthApiError("PARSE_ERROR", "Nie udało się przetworzyć odpowiedzi serwera.", {
      status: response.status,
      kind: "parse",
      cause: error,
    });
  }

  return { response, envelope };
};

interface SignInOptions {
  signal?: AbortSignal;
}

export const signIn = async (credentials: SignInCommand, options: SignInOptions = {}): Promise<MeResponseDto> => {
  const { response, envelope } = await requestAuthApi<MeResponseDto>("/api/auth/sign-in", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
    signal: options.signal,
  });

  const requestId = detectRequestId(envelope.meta ?? null);

  if (!response.ok || envelope.error || !envelope.data) {
    const errorPayload = envelope.error ?? {
      code: "HTTP_ERROR",
      message: `Żądanie nie powiodło się (status ${response.status}).`,
    };

    const fieldErrors = extractFieldErrors(errorPayload.details);

    throw new AuthApiError(errorPayload.code, errorPayload.message, {
      status: response.status,
      requestId,
      details: errorPayload.details,
      fieldErrors,
      kind: determineErrorKind(response.status, errorPayload.code),
    });
  }

  return envelope.data;
};

interface SignUpOptions {
  signal?: AbortSignal;
}

type SignUpPayload = SignUpCommand & { returnTo?: string };

export const signUp = async (payload: SignUpPayload, options: SignUpOptions = {}): Promise<SignUpResultDto> => {
  const { response, envelope } = await requestAuthApi<SignUpResultDto>("/api/auth/sign-up", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  const requestId = detectRequestId(envelope.meta ?? null);

  if (!response.ok || envelope.error || !envelope.data) {
    const errorPayload = envelope.error ?? {
      code: "HTTP_ERROR",
      message: `Żądanie nie powiodło się (status ${response.status}).`,
    };

    const fieldErrors = extractFieldErrors(errorPayload.details);

    throw new AuthApiError(errorPayload.code, errorPayload.message, {
      status: response.status,
      requestId,
      details: errorPayload.details,
      fieldErrors,
      kind: determineErrorKind(response.status, errorPayload.code),
    });
  }

  return envelope.data;
};
