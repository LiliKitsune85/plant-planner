import type { APIRoute } from "astro";
import { logger } from "@/lib/logger";

export const prerender = false;

const DEFAULT_RETURN_TO = "/calendar";

const sanitizeReturnTo = (value: unknown): string => {
  if (typeof value !== "string") return DEFAULT_RETURN_TO;
  if (!value.startsWith("/")) return DEFAULT_RETURN_TO;
  if (value.startsWith("//")) return DEFAULT_RETURN_TO;
  return value;
};

const buildRedirectResponse = (returnTo: string): Response =>
  new Response(null, {
    status: 303,
    headers: {
      Location: `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
      "Cache-Control": "no-store",
    },
  });

export const POST: APIRoute = async ({ locals, request, url }) => {
  let candidateReturnTo: string | null = null;

  try {
    const formData = await request.formData();
    const formValue = formData.get("returnTo");
    candidateReturnTo = typeof formValue === "string" ? formValue : null;
  } catch {
    candidateReturnTo = null;
  }

  const fallbackReturnTo = url.searchParams.get("returnTo");
  const returnTo = sanitizeReturnTo(candidateReturnTo ?? fallbackReturnTo);

  try {
    const { error } = await locals.supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error("Failed to sign out user via API", { error });
  }

  return buildRedirectResponse(returnTo);
};
