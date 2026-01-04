import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient as BaseSupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types.ts'

export type SupabaseClient = BaseSupabaseClient<Database>

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.SUPABASE_KEY

export const supabaseClient: SupabaseClient = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
)
