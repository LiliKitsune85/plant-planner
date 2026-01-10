import type { SupabaseClient } from '../../../db/supabase.client'
import type { Database } from '../../../db/database.types'
import type { MeResponseDto, ProfileDto, SignInCommand } from '../../../types'
import { HttpError } from '../../http/errors'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

const PROFILE_COLUMNS = 'user_id,nickname,timezone'

const toProfileDto = (userId: string, profile: ProfileRow | null): ProfileDto => ({
  user_id: userId,
  nickname: profile?.nickname ?? null,
  timezone: profile?.timezone ?? 'UTC',
})

const mapSignInError = (error: unknown): never => {
  const status = typeof (error as { status?: number } | null)?.status === 'number'
    ? ((error as { status: number }).status)
    : undefined

  if (status === 429) {
    throw new HttpError(
      429,
      'Zbyt wiele prób logowania. Spróbuj ponownie później.',
      'RATE_LIMITED',
    )
  }

  throw new HttpError(
    401,
    'Nieprawidłowy e-mail lub hasło.',
    'INVALID_CREDENTIALS',
  )
}

export const signIn = async (
  supabase: SupabaseClient,
  credentials: SignInCommand,
): Promise<MeResponseDto> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (error || !data.user) {
    mapSignInError(error)
  }

  const user = data.user
  const userEmail = user.email ?? credentials.email

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('signIn profile lookup failed', {
      error: profileError,
      userId: user.id,
    })
  }

  const profile = toProfileDto(user.id, profileRow ?? null)

  return {
    user: {
      id: user.id,
      email: userEmail,
    },
    profile,
  }
}

