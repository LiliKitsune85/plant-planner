import { InvalidCursorError } from "../../http/errors";
import type { ListPlantsCursorContext, ListPlantsCursorPayload, PlantSortField, SortOrder } from "./types";

const CURSOR_VERSION = 1 as const;

type CursorEnvelope = ListPlantsCursorPayload & {
  version: typeof CURSOR_VERSION;
};

const encodeBase64Url = (value: string): string =>
  Buffer.from(value, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");

const decodeBase64Url = (value: string): string => {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (normalized.length % 4)) % 4;
    const base64 = normalized + "=".repeat(padding);

    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    throw new InvalidCursorError("Malformed cursor encoding");
  }
};

const isPlantSortField = (value: unknown): value is PlantSortField =>
  value === "created_at" || value === "species_name" || value === "updated_at";

const isSortOrder = (value: unknown): value is SortOrder => value === "asc" || value === "desc";

const parseCursorEnvelope = (cursor: string): CursorEnvelope => {
  const decoded = decodeBase64Url(cursor);

  let payload: Partial<CursorEnvelope>;
  try {
    payload = JSON.parse(decoded);
  } catch {
    throw new InvalidCursorError("Cursor payload is not valid JSON");
  }

  if (!payload || typeof payload !== "object") {
    throw new InvalidCursorError("Cursor payload is empty");
  }

  if (payload.version !== CURSOR_VERSION) {
    throw new InvalidCursorError("Unsupported cursor version");
  }

  if (!payload.userId || typeof payload.userId !== "string") {
    throw new InvalidCursorError("Cursor is missing user context");
  }

  if (!isPlantSortField(payload.sort)) {
    throw new InvalidCursorError("Cursor sort field is not supported");
  }

  if (!isSortOrder(payload.order)) {
    throw new InvalidCursorError("Cursor order is not supported");
  }

  if (!payload.id || typeof payload.id !== "string") {
    throw new InvalidCursorError("Cursor is missing record identifier");
  }

  if (typeof payload.sortValue !== "string") {
    throw new InvalidCursorError("Cursor is missing sort value");
  }

  return {
    userId: payload.userId,
    sort: payload.sort,
    order: payload.order,
    sortValue: payload.sortValue,
    id: payload.id,
    version: CURSOR_VERSION,
  };
};

export const encodeListPlantsCursor = (payload: ListPlantsCursorPayload): string => {
  const envelope: CursorEnvelope = {
    ...payload,
    version: CURSOR_VERSION,
  };

  return encodeBase64Url(JSON.stringify(envelope));
};

export const decodeListPlantsCursor = (cursor: string, context: ListPlantsCursorContext): ListPlantsCursorPayload => {
  const payload = parseCursorEnvelope(cursor);

  if (payload.userId !== context.userId) {
    throw new InvalidCursorError("Cursor belongs to a different user");
  }

  if (payload.sort !== context.sort || payload.order !== context.order) {
    throw new InvalidCursorError("Cursor does not match the requested sort");
  }

  return payload;
};
