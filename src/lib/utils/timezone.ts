import { logger } from "@/lib/logger";

const getBrowserTimezone = (): string => {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return detected && typeof detected === "string" ? detected : "UTC";
  } catch {
    return "UTC";
  }
};

const extractProfileTimezone = (): string | null => {
  if (typeof window === "undefined") return null;
  const profile = window.__PLANT_PLANNER_PROFILE__;
  if (profile && typeof profile.timezone === "string" && profile.timezone.length > 0) {
    return profile.timezone;
  }
  return null;
};

export const getActiveTimezone = (): string => {
  const profileTimezone = extractProfileTimezone();
  return profileTimezone ?? getBrowserTimezone();
};

const zonedFormatter = (timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

export const formatDateInTimezone = (date: Date, timezone?: string): string => {
  const safeTimezone = timezone ?? getActiveTimezone();
  try {
    return zonedFormatter(safeTimezone).format(date);
  } catch (error) {
    logger.error("formatDateInTimezone failed, falling back to UTC", { error, safeTimezone });
    return zonedFormatter("UTC").format(date);
  }
};

export const getTodayIsoDateInTimezone = (timezone?: string): string => formatDateInTimezone(new Date(), timezone);

export const getTodayMonthInTimezone = (timezone?: string): string => getTodayIsoDateInTimezone(timezone).slice(0, 7);
