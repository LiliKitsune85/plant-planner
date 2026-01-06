import { z } from 'zod'

import type { WateringPlanConfigFields } from '../../../types'
import { HttpError } from '../../http/errors'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openrouter/auto'
const DEFAULT_TIMEOUT_MS = 5000
const EXPLANATION_MAX_LENGTH = 800

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'system' | 'user' | 'assistant'
      content: Array<{ type: 'text'; text: string }>
    }

type OpenRouterChoice = {
  index: number
  message?: ChatMessage
}

type OpenRouterUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

type OpenRouterResponseBody = {
  id: string
  model: string
  choices: OpenRouterChoice[]
  usage?: OpenRouterUsage
}

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.toISOString().slice(0, 10) === value
}

const isoDateSchema = z
  .string()
  .trim()
  .refine(isValidIsoDate, { message: 'Invalid custom_start_on date (expected YYYY-MM-DD)' })

const suggestionSchema = z
  .object({
    interval_days: z.number().int().min(1).max(365),
    horizon_days: z.number().int().min(1).max(365),
    schedule_basis: z.enum(['due_on', 'completed_on']),
    start_from: z.enum(['today', 'purchase_date', 'custom_date']),
    custom_start_on: z.union([isoDateSchema, z.null()]).optional(),
    overdue_policy: z.enum(['carry_forward', 'reschedule']),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.start_from === 'custom_date' && !value.custom_start_on) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['custom_start_on'],
        message: 'custom_start_on is required when start_from is custom_date',
      })
    }

    if (value.start_from !== 'custom_date' && value.custom_start_on) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['custom_start_on'],
        message: 'custom_start_on must be null unless start_from is custom_date',
      })
    }
  })

const responseSchema = z
  .object({
    suggestion: suggestionSchema,
    explanation: z
      .string()
      .trim()
      .min(1, 'explanation is required')
      .max(EXPLANATION_MAX_LENGTH, `explanation must be <= ${EXPLANATION_MAX_LENGTH} characters`),
  })
  .strict()

export type OpenRouterWateringPlanResult = {
  suggestion: WateringPlanConfigFields
  explanation: string
  model: string
  usage: {
    promptTokens: number | null
    completionTokens: number | null
    totalTokens: number | null
  }
  latencyMs: number
}

type SuggestionParams = {
  apiKey: string
  speciesName: string
  model?: string
  timeoutMs?: number
}

const toWateringPlanConfig = (value: z.infer<typeof suggestionSchema>): WateringPlanConfigFields => ({
  interval_days: value.interval_days,
  horizon_days: value.horizon_days,
  schedule_basis: value.schedule_basis,
  start_from: value.start_from,
  custom_start_on: value.custom_start_on ?? null,
  overdue_policy: value.overdue_policy,
})

const buildMessages = (speciesName: string): ChatMessage[] => [
  {
    role: 'system',
    content:
      'You are a horticulture assistant that suggests concise watering schedules. ' +
      'Always respond with JSON that matches the provided schema. ' +
      'Base your recommendation only on the user supplied species name.',
  },
  {
    role: 'user',
    content: `Provide a watering plan suggestion for the following plant species:\n\n${speciesName}`,
  },
]

const buildResponseFormat = () => ({
  type: 'json_schema',
  json_schema: {
    name: 'watering_plan_suggestion',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['suggestion', 'explanation'],
      properties: {
        suggestion: {
          type: 'object',
          additionalProperties: false,
          required: [
            'interval_days',
            'horizon_days',
            'schedule_basis',
            'start_from',
            'custom_start_on',
            'overdue_policy',
          ],
          properties: {
            interval_days: { type: 'integer', minimum: 1, maximum: 365 },
            horizon_days: { type: 'integer', minimum: 1, maximum: 365 },
            schedule_basis: { type: 'string', enum: ['due_on', 'completed_on'] },
            start_from: { type: 'string', enum: ['today', 'purchase_date', 'custom_date'] },
            custom_start_on: {
              anyOf: [
                { type: 'string', format: 'date' },
                { type: 'null' },
              ],
            },
            overdue_policy: { type: 'string', enum: ['carry_forward', 'reschedule'] },
          },
        },
        explanation: { type: 'string', minLength: 1, maxLength: EXPLANATION_MAX_LENGTH },
      },
    },
  },
})

const extractMessageContent = (choice: OpenRouterChoice): string => {
  const message = choice.message
  if (!message) {
    throw new HttpError(502, 'AI provider returned an empty message', 'AI_PROVIDER_ERROR')
  }

  if (typeof message.content === 'string') {
    return message.content
  }

  if (Array.isArray(message.content)) {
    const textPart = message.content.find((part) => part.type === 'text')
    if (textPart?.text) {
      return textPart.text
    }
  }

  throw new HttpError(502, 'AI provider response missing text content', 'AI_PROVIDER_ERROR')
}

const parseResponsePayload = (raw: OpenRouterResponseBody): z.infer<typeof responseSchema> => {
  if (!raw.choices?.length) {
    throw new HttpError(502, 'AI provider returned no choices', 'AI_PROVIDER_ERROR')
  }

  const content = extractMessageContent(raw.choices[0])

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    console.error('Failed to parse OpenRouter JSON response', { content })
    throw new HttpError(502, 'AI provider returned invalid JSON', 'AI_PROVIDER_ERROR')
  }

  const validation = responseSchema.safeParse(parsed)
  if (!validation.success) {
    console.error('OpenRouter response failed validation', {
      issues: validation.error.issues,
      parsed,
    })
    throw new HttpError(502, 'AI provider returned invalid payload', 'AI_PROVIDER_ERROR', {
      issues: validation.error.issues,
    })
  }

  return validation.data
}

const readErrorBody = async (response: Response): Promise<string> => {
  try {
    return await response.text()
  } catch {
    return '<unreadable>'
  }
}

export const requestWateringPlanSuggestion = async ({
  apiKey,
  speciesName,
  model = DEFAULT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: SuggestionParams): Promise<OpenRouterWateringPlanResult> => {
  if (!apiKey) {
    throw new HttpError(500, 'Missing OpenRouter API key', 'AI_PROVIDER_CONFIG_MISSING')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': import.meta.env.APP_BASE_URL ?? 'https://plant-planner.app',
        'X-Title': 'Plant Planner',
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(speciesName),
        response_format: buildResponseFormat(),
      }),
      signal: controller.signal,
    })

    const latencyMs = Date.now() - startedAt

    if (!response.ok) {
      const errorBody = await readErrorBody(response)
      console.error('OpenRouter request failed', {
        status: response.status,
        body: errorBody,
      })

      if (response.status === 408) {
        throw new HttpError(408, 'AI provider timeout', 'AI_TIMEOUT')
      }

      throw new HttpError(502, 'AI provider error', 'AI_PROVIDER_ERROR', {
        status: response.status,
      })
    }

    let payload: OpenRouterResponseBody
    try {
      payload = (await response.json()) as OpenRouterResponseBody
    } catch (error) {
      console.error('Failed to parse OpenRouter response JSON', { error })
      throw new HttpError(502, 'AI provider returned invalid response', 'AI_PROVIDER_ERROR')
    }

    const parsed = parseResponsePayload(payload)

    return {
      suggestion: toWateringPlanConfig(parsed.suggestion),
      explanation: parsed.explanation,
      model: payload.model ?? model,
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? null,
        completionTokens: payload.usage?.completion_tokens ?? null,
        totalTokens: payload.usage?.total_tokens ?? null,
      },
      latencyMs,
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new HttpError(408, 'AI provider timeout', 'AI_TIMEOUT')
    }

    console.error('Unexpected error calling OpenRouter', { error })
    throw new HttpError(502, 'AI provider error', 'AI_PROVIDER_ERROR')
  } finally {
    clearTimeout(timeout)
  }
}

