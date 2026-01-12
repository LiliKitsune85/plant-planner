import type { SupabaseClient } from "../../../db/supabase.client";
import { logger } from "@/lib/logger";
import type { AiQuotaDto } from "../../../types";
import { HttpError } from "../../http/errors";

export const AI_LIMIT_PER_HOUR = 20;
const ONE_HOUR_MS = 60 * 60 * 1000;

interface GetAiQuotaOptions {
  userId: string;
  now?: Date;
}

const getHourlyWindow = (now: Date): { start: Date; end: Date } => {
  if (Number.isNaN(now.getTime())) {
    throw new HttpError(500, "Invalid date value for AI quota", "AI_QUOTA_INVALID_DATE");
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));

  return { start, end: new Date(start.getTime() + ONE_HOUR_MS) };
};

export const getAiQuota = async (
  supabase: SupabaseClient,
  { userId, now = new Date() }: GetAiQuotaOptions
): Promise<AiQuotaDto> => {
  if (!userId) {
    throw new HttpError(500, "Missing userId for AI quota", "AI_QUOTA_USER_MISSING");
  }

  const { start, end } = getHourlyWindow(now);
  const windowStartIso = start.toISOString();
  const windowEndIso = end.toISOString();

  const { count, error } = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("requested_at", windowStartIso)
    .lt("requested_at", windowEndIso);

  if (error) {
    logger.error("getAiQuota supabase count failed", { error, userId });
    throw new HttpError(500, "Failed to read AI quota", "AI_QUOTA_LOOKUP_FAILED");
  }

  const used = Math.max(0, count ?? 0);
  const remaining = Math.max(0, AI_LIMIT_PER_HOUR - used);
  const isRateLimited = used >= AI_LIMIT_PER_HOUR;

  const quota: AiQuotaDto = {
    limit_per_hour: AI_LIMIT_PER_HOUR,
    used_in_current_window: used,
    remaining,
    window_resets_at: windowEndIso,
    is_rate_limited: isRateLimited,
    unlock_at: isRateLimited ? windowEndIso : null,
  };

  return quota;
};

export const ensureAiQuotaAvailable = async (
  supabase: SupabaseClient,
  options: GetAiQuotaOptions
): Promise<AiQuotaDto> => {
  const quota = await getAiQuota(supabase, options);

  if (quota.is_rate_limited) {
    throw new HttpError(429, "AI rate limit exceeded", "AI_RATE_LIMITED", {
      unlock_at: quota.unlock_at,
      limit_per_hour: quota.limit_per_hour,
      used_in_current_window: quota.used_in_current_window,
    });
  }

  return quota;
};
