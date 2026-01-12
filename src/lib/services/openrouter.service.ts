import type { ZodType } from "zod";
import { logger } from "@/lib/logger";

import { HttpError } from "../http/errors";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "xiaomi/mimo-v2-flash:free";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_APP_URL = "https://plant-planner.app";
const DEFAULT_APP_TITLE = "Plant Planner";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4_000;

type ChatRole = "system" | "user" | "assistant";

interface ChatMessagePart {
  type: "text";
  text: string;
}

export type OpenRouterChatMessageInput =
  | { role: ChatRole; content: string }
  | { role: ChatRole; content: ChatMessagePart[] };

export interface OpenRouterChatMessage {
  role: ChatRole;
  content: string;
}

export interface ResponseFormatJsonSchema {
  type: "json_schema";
  json_schema: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
}

export interface ChatModelParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface OpenRouterChatRequest {
  model?: string;
  messages: OpenRouterChatMessageInput[];
  responseFormat?: ResponseFormatJsonSchema;
  modelParams?: ChatModelParams;
}

export interface TokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface OpenRouterChatResponse {
  content: string;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
}

export interface OpenRouterChatJsonResponse<T> {
  data: T;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
}

interface OpenRouterChoice {
  index: number;
  message?: {
    role: ChatRole;
    content: string | ChatMessagePart[];
  };
}

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenRouterResponseBody {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: OpenRouterUsage;
}

interface OpenRouterServiceConfig {
  apiKey: string;
  defaultModel?: string;
  timeoutMs?: number;
  appUrl?: string;
  appTitle?: string;
  fetchImpl?: typeof fetch;
}

type ChatCompletionsPayload = {
  model: string;
  messages: OpenRouterChatMessage[];
  response_format?: ResponseFormatJsonSchema;
} & ChatModelParams;

export class OpenRouterService {
  readonly defaultModel: string;
  readonly timeoutMs: number;

  private readonly apiUrl = OPENROUTER_API_URL;
  private readonly apiKey: string;
  private readonly appUrl: string;
  private readonly appTitle: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenRouterServiceConfig) {
    if (!config.apiKey?.trim()) {
      throw new HttpError(500, "Missing OpenRouter API key", "AI_PROVIDER_CONFIG_MISSING");
    }

    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new HttpError(500, "Invalid OpenRouter timeout", "AI_PROVIDER_CONFIG_INVALID");
    }

    const fetchImpl = config.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new HttpError(500, "Missing fetch implementation", "AI_PROVIDER_CONFIG_INVALID");
    }

    this.apiKey = config.apiKey.trim();
    this.defaultModel = config.defaultModel?.trim() || DEFAULT_MODEL;
    this.timeoutMs = timeoutMs;
    this.appUrl = config.appUrl?.trim() || DEFAULT_APP_URL;
    this.appTitle = config.appTitle?.trim() || DEFAULT_APP_TITLE;
    this.fetchImpl = fetchImpl;
  }

  buildResponseFormatJsonSchema(
    name: string,
    schema: Record<string, unknown>,
    { strict = true }: { strict?: boolean } = {}
  ): ResponseFormatJsonSchema {
    if (!name?.trim()) {
      throw new HttpError(500, "Response format schema name is required", "AI_PROVIDER_CONFIG_INVALID");
    }

    if (!schema || typeof schema !== "object") {
      throw new HttpError(500, "Response format schema object is required", "AI_PROVIDER_CONFIG_INVALID");
    }

    return {
      type: "json_schema",
      json_schema: {
        name: name.trim(),
        strict,
        schema,
      },
    };
  }

  normalizeMessages(messages: OpenRouterChatMessageInput[]): OpenRouterChatMessage[] {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpError(400, "At least one chat message is required", "INVALID_AI_MESSAGES");
    }

    if (messages.length > MAX_MESSAGES) {
      throw new HttpError(400, "Too many chat messages", "INVALID_AI_MESSAGES", {
        max: MAX_MESSAGES,
      });
    }

    return messages.map((message, index) => {
      if (!message || typeof message !== "object") {
        throw new HttpError(400, `Invalid message at index ${index}`, "INVALID_AI_MESSAGES");
      }

      if (message.role !== "system" && message.role !== "user" && message.role !== "assistant") {
        throw new HttpError(400, `Unsupported role at index ${index}`, "INVALID_AI_MESSAGES");
      }

      const normalizedContent = this.normalizeContent(message.content, index);
      return { role: message.role, content: normalizedContent };
    });
  }

  async chat(request: OpenRouterChatRequest): Promise<OpenRouterChatResponse> {
    const normalizedMessages = this.normalizeMessages(request.messages);
    const resolvedModel = request.model?.trim() || this.defaultModel;

    const payload: ChatCompletionsPayload = {
      model: resolvedModel,
      messages: normalizedMessages,
      ...(request.responseFormat ? { response_format: request.responseFormat } : {}),
      ...this.sanitizeModelParams(request.modelParams),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await this.postChatCompletions(payload, controller.signal);
      const latencyMs = Date.now() - startedAt;

      if (!response.choices?.length) {
        throw new HttpError(502, "AI provider returned no choices", "AI_PROVIDER_ERROR");
      }

      const content = this.extractMessageContent(response.choices[0]);

      return {
        content,
        model: response.model ?? resolvedModel,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? null,
          completionTokens: response.usage?.completion_tokens ?? null,
          totalTokens: response.usage?.total_tokens ?? null,
        },
        latencyMs,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new HttpError(408, "AI provider timeout", "AI_TIMEOUT");
      }

      logger.error("Unexpected OpenRouter chat error", { error });
      throw new HttpError(502, "AI provider error", "AI_PROVIDER_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }

  async chatJson<T>(request: OpenRouterChatRequest, schema: ZodType<T>): Promise<OpenRouterChatJsonResponse<T>> {
    if (!request.responseFormat) {
      throw new HttpError(500, "responseFormat is required for chatJson", "AI_PROVIDER_CONFIG_INVALID");
    }

    const chatResponse = await this.chat(request);
    const parsed = this.parseJsonContent(chatResponse.content);
    const data = this.validate(parsed, schema);

    return {
      data,
      model: chatResponse.model,
      usage: chatResponse.usage,
      latencyMs: chatResponse.latencyMs,
    };
  }

  private sanitizeModelParams(params?: ChatModelParams): Partial<ChatModelParams> {
    if (!params) {
      return {};
    }

    const sanitized: Partial<ChatModelParams> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (key === "stop" && Array.isArray(value)) {
        const trimmedStops = value.map((item) => item?.trim()).filter((item) => !!item);
        if (trimmedStops.length) {
          sanitized.stop = trimmedStops;
        }
        continue;
      }

      sanitized[key as keyof ChatModelParams] = value as never;
    }

    return sanitized;
  }

  private normalizeContent(content: OpenRouterChatMessageInput["content"], index: number): string {
    if (typeof content === "string") {
      return this.normalizeContentString(content, index);
    }

    if (Array.isArray(content)) {
      const combined = content
        .filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("");

      return this.normalizeContentString(combined, index);
    }

    throw new HttpError(400, `Unsupported message content at index ${index}`, "INVALID_AI_MESSAGES");
  }

  private normalizeContentString(value: string, index: number): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new HttpError(400, `Empty message content at index ${index}`, "INVALID_AI_MESSAGES");
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(400, `Message too long at index ${index}`, "INVALID_AI_MESSAGES", {
        maxLength: MAX_MESSAGE_LENGTH,
      });
    }

    return trimmed;
  }

  private async postChatCompletions(
    payload: ChatCompletionsPayload,
    signal: AbortSignal
  ): Promise<OpenRouterResponseBody> {
    try {
      const response = await this.fetchImpl(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": this.appUrl,
          "X-Title": this.appTitle,
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        const errorBody = await this.readErrorBody(response);
        logger.error("OpenRouter responded with error", {
          status: response.status,
          body: errorBody.slice(0, 800),
        });

        if (response.status === 408) {
          throw new HttpError(408, "AI provider timeout", "AI_TIMEOUT");
        }

        throw new HttpError(502, "AI provider error", "AI_PROVIDER_ERROR", {
          status: response.status,
        });
      }

      try {
        return (await response.json()) as OpenRouterResponseBody;
      } catch (error) {
        logger.error("Failed to parse OpenRouter success response", { error });
        throw new HttpError(502, "AI provider returned invalid response", "AI_PROVIDER_ERROR");
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new HttpError(408, "AI provider timeout", "AI_TIMEOUT");
      }

      logger.error("OpenRouter fetch failed", { error });
      throw new HttpError(502, "AI provider error", "AI_PROVIDER_ERROR");
    }
  }

  private async readErrorBody(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return "<unreadable>";
    }
  }

  private extractMessageContent(choice: OpenRouterChoice): string {
    const message = choice.message;
    if (!message) {
      throw new HttpError(502, "AI provider returned an empty message", "AI_PROVIDER_ERROR");
    }

    if (typeof message.content === "string") {
      const trimmed = message.content.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    if (Array.isArray(message.content)) {
      const textPart = message.content.find((part) => part.type === "text" && typeof part.text === "string");
      if (textPart?.text?.trim()) {
        return textPart.text.trim();
      }
    }

    throw new HttpError(502, "AI provider response missing text content", "AI_PROVIDER_ERROR");
  }

  private parseJsonContent(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      logger.error("Failed to parse OpenRouter JSON content", {
        snippet: content.slice(0, 200),
        error,
      });
      throw new HttpError(502, "AI provider returned invalid JSON", "AI_PROVIDER_ERROR");
    }
  }

  private validate<T>(parsed: unknown, schema: ZodType<T>): T {
    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      logger.error("OpenRouter response schema validation failed", {
        issues: validation.error.issues,
      });
      throw new HttpError(502, "AI provider returned invalid payload", "AI_PROVIDER_ERROR", {
        issues: validation.error.issues,
      });
    }

    return validation.data;
  }
}
