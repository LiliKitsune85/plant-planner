import { z } from "zod";
import { logger } from "@/lib/logger";

import { InvalidCursorError } from "../../http/errors";
import type { WateringPlanHistoryCursor } from "./types";

const cursorPayloadSchema = z.object({
  valid_from: z.string().datetime(),
  id: z.string().uuid(),
});

type WateringPlanHistoryCursorPayload = z.infer<typeof cursorPayloadSchema>;

const toInternalCursor = (payload: WateringPlanHistoryCursorPayload): WateringPlanHistoryCursor => ({
  validFrom: payload.valid_from,
  id: payload.id,
});

const toPayload = (cursor: WateringPlanHistoryCursor): WateringPlanHistoryCursorPayload => ({
  valid_from: cursor.validFrom,
  id: cursor.id,
});

export const decodeWateringPlanHistoryCursor = (raw: string): WateringPlanHistoryCursor => {
  let decoded: string;

  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch (error) {
    logger.error("Failed to base64url decode watering plan cursor", { error });
    throw new InvalidCursorError("Cursor is not valid base64url string");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decoded);
  } catch (error) {
    logger.error("Failed to parse watering plan cursor JSON", { error });
    throw new InvalidCursorError("Cursor is not valid JSON payload");
  }

  const result = cursorPayloadSchema.safeParse(parsed);

  if (!result.success) {
    throw new InvalidCursorError("Cursor payload is invalid");
  }

  return toInternalCursor(result.data);
};

export const encodeWateringPlanHistoryCursor = (cursor: WateringPlanHistoryCursor): string => {
  const payload = toPayload(cursor);
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};
