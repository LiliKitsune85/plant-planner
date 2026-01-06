import type { APIRoute } from 'astro'

import type { AiQuotaDto } from '../../../types'
import { HttpError, isHttpError } from '../../../lib/http/errors'
import { getAiQuota } from '../../../lib/services/ai/ai-quota'

export const prerender = false

type ApiEnvelope<TData> = {
  data: TData | null
  error: { code: string; message: string } | null
  meta: Record<string, unknown>
}

const json = <TData>(
  status: number,
  envelope: ApiEnvelope<TData>,
  headers?: HeadersInit,
): Response =>
  new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })

const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get('authorization')
  if (!header) return null

  const match = /^Bearer\s+(.+)$/.exec(header)
  return match?.[1] ?? null
}

const requireUserId = async (locals: App.Locals, request: Request) => {
  const token = getBearerToken(request)
  const { data, error } = token
    ? await locals.supabase.auth.getUser(token)
    : await locals.supabase.auth.getUser()

  if (error || !data.user) {
    throw new HttpError(401, 'Unauthenticated', 'UNAUTHENTICATED')
  }

  return data.user.id
}

const baseHeaders = {
  'Cache-Control': 'no-store',
  // Protect per-user responses when cached by shared proxies.
  Vary: 'Authorization, Cookie',
}

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const userId = await requireUserId(locals, request)
    const quota = await getAiQuota(locals.supabase, { userId })

    return json<AiQuotaDto>(200, { data: quota, error: null, meta: {} }, baseHeaders)
  } catch (error) {
    if (isHttpError(error)) {
      return json(
        error.status,
        {
          data: null,
          error: { code: error.code, message: error.message },
          meta: {},
        },
        baseHeaders,
      )
    }

    console.error('Unhandled error in GET /api/ai/quota', { error })

    return json(
      500,
      {
        data: null,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
        meta: {},
      },
      baseHeaders,
    )
  }
}
