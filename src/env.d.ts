/// <reference types="astro/client" />

import type { SupabaseClient } from './db/supabase.client.ts'
import type { User } from '@supabase/supabase-js'

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient
      user: User | null
      profileTimezone?: string | null
    }
  }

  interface Window {
    __PLANT_PLANNER_PROFILE__?: {
      timezone?: string | null
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly OPENROUTER_API_KEY?: string;
  readonly OPENROUTER_MODEL?: string;
  readonly APP_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
