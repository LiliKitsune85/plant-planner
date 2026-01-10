import { createServerClient } from "@supabase/ssr";
import { defineMiddleware } from "astro:middleware";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

const PRIVATE_UI_PATHS = ["/calendar", "/plants", "/settings"];

const isPrivatePath = (pathname: string): boolean =>
  PRIVATE_UI_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

const buildLoginRedirectUrl = (baseUrl: URL): URL => {
  const loginUrl = new URL("/auth/login", baseUrl);
  const returnTo = `${baseUrl.pathname}${baseUrl.search}`;
  loginUrl.searchParams.set("returnTo", returnTo);
  return loginUrl;
};

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
  context.locals.user = null;
  context.locals.profileTimezone = null;

  const requestUrl = new URL(context.request.url);
  const pathname = requestUrl.pathname;

  if (isPrivatePath(pathname)) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      const loginUrl = buildLoginRedirectUrl(requestUrl);
      return Response.redirect(loginUrl, 303);
    }

    context.locals.user = user;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("user_id", user.id)
        .maybeSingle();

      context.locals.profileTimezone = profile?.timezone ?? null;
    } catch (profileError) {
      console.error("Failed to load profile timezone", {
        error: profileError,
        userId: user.id,
        path: pathname,
      });
    }
  }

  const response = await next();
  return response;
});
