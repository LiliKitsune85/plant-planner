import { createClient } from '@supabase/supabase-js'

import type { SupabaseClient } from './supabase.client'
import type { Database } from './database.types'

let cachedAdminClient: SupabaseClient | null = null

export const createAdminClient = (): SupabaseClient => {
  if (cachedAdminClient) return cachedAdminClient

  const supabaseUrl = import.meta.env.SUPABASE_URL
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not configured')
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  cachedAdminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cachedAdminClient
}

