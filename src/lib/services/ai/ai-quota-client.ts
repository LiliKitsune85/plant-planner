import type { AiQuotaDto } from "@/types";

interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

export class AiQuotaApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.status = options.status;
    this.code = options.code;
  }
}

interface FetchAiQuotaOptions {
  signal?: AbortSignal;
}

export const fetchAiQuota = async (options: FetchAiQuotaOptions = {}): Promise<AiQuotaDto> => {
  let response: Response;
  try {
    response = await fetch("/api/ai/quota", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: options.signal,
    });
  } catch {
    throw new AiQuotaApiError("Nie udało się pobrać limitu AI.", { code: "NETWORK_ERROR" });
  }

  let envelope: ApiEnvelope<AiQuotaDto>;
  try {
    envelope = (await response.json()) as ApiEnvelope<AiQuotaDto>;
  } catch {
    throw new AiQuotaApiError("Nie udało się zinterpretować odpowiedzi AI quota.", {
      status: response.status,
      code: "PARSE_ERROR",
    });
  }

  if (!response.ok || envelope.error || !envelope.data) {
    throw new AiQuotaApiError(envelope.error?.message ?? "Limit AI jest chwilowo niedostępny.", {
      status: response.status,
      code: envelope.error?.code ?? "HTTP_ERROR",
    });
  }

  return envelope.data;
};
