import { createServerClient } from "@supabase/ssr";
import { defineMiddleware } from "astro:middleware";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
    global: {
      headers: context.request.headers.get("authorization")
        ? {
            Authorization: context.request.headers.get("authorization") as string,
          }
        : undefined,
    },
    cookies: {
      getAll: () => {
        if (typeof context.cookies.getAll === "function") {
          return context.cookies.getAll().map(({ name, value }) => ({ name, value }));
        }

        const cookieHeader = context.request.headers.get("cookie") ?? "";
        return cookieHeader
          .split(";")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => {
            const [name, ...rest] = entry.split("=");
            return { name, value: rest.join("=") };
          });
      },
      setAll: (cookies) => {
        cookies.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, options);
        });
      },
    },
  });

  context.locals.supabase = supabase;

  const response = await next();
  return response;
});
