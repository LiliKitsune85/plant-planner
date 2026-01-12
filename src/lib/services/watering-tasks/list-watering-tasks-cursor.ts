import { InvalidCursorError } from "../../http/errors";
import type {
  GetWateringTasksFilters,
  ListWateringTasksCursorContext,
  ListWateringTasksCursorFiltersSnapshot,
  ListWateringTasksCursorPayload,
  WateringTaskSortField,
  WateringTaskSortOrder,
  WateringTaskSourceFilter,
  WateringTaskStatusFilter,
} from "./types";

const CURSOR_VERSION = 1 as const;

type CursorEnvelope = ListWateringTasksCursorPayload & {
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

const isSortField = (value: unknown): value is WateringTaskSortField => value === "due_on" || value === "created_at";

const isSortOrder = (value: unknown): value is WateringTaskSortOrder => value === "asc" || value === "desc";

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

const isNullableStatus = (value: unknown): value is WateringTaskStatusFilter | null =>
  value === null || value === "pending" || value === "completed";

const isNullableSource = (value: unknown): value is WateringTaskSourceFilter | null =>
  value === null || value === "scheduled" || value === "adhoc";

const isFiltersSnapshot = (value: unknown): value is ListWateringTasksCursorFiltersSnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<ListWateringTasksCursorFiltersSnapshot>;

  return (
    isNullableString(snapshot.from ?? null) &&
    isNullableString(snapshot.to ?? null) &&
    isNullableString(snapshot.plantId ?? null) &&
    isNullableStatus(snapshot.status ?? null) &&
    isNullableSource(snapshot.source ?? null) &&
    typeof snapshot.limit === "number" &&
    Number.isFinite(snapshot.limit)
  );
};

const filtersEqual = (
  left: ListWateringTasksCursorFiltersSnapshot,
  right: ListWateringTasksCursorFiltersSnapshot
): boolean =>
  left.from === right.from &&
  left.to === right.to &&
  left.plantId === right.plantId &&
  left.status === right.status &&
  left.source === right.source &&
  left.limit === right.limit;

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

  if (!isSortField(payload.sort)) {
    throw new InvalidCursorError("Cursor sort field is not supported");
  }

  if (!isSortOrder(payload.order)) {
    throw new InvalidCursorError("Cursor sort order is not supported");
  }

  if (!payload.id || typeof payload.id !== "string") {
    throw new InvalidCursorError("Cursor is missing record identifier");
  }

  if (typeof payload.sortValue !== "string") {
    throw new InvalidCursorError("Cursor is missing sort value");
  }

  if (!isFiltersSnapshot(payload.filters)) {
    throw new InvalidCursorError("Cursor filters are invalid");
  }

  return {
    userId: payload.userId,
    sort: payload.sort,
    order: payload.order,
    sortValue: payload.sortValue,
    id: payload.id,
    filters: payload.filters,
    version: CURSOR_VERSION,
  };
};

export const buildListWateringTasksCursorFiltersSnapshot = (
  filters: GetWateringTasksFilters
): ListWateringTasksCursorFiltersSnapshot => ({
  from: filters.from ?? null,
  to: filters.to ?? null,
  plantId: filters.plantId ?? null,
  status: filters.status ?? null,
  source: filters.source ?? null,
  limit: filters.limit,
});

export const encodeListWateringTasksCursor = (payload: ListWateringTasksCursorPayload): string => {
  const envelope: CursorEnvelope = {
    ...payload,
    version: CURSOR_VERSION,
  };

  return encodeBase64Url(JSON.stringify(envelope));
};

export const decodeListWateringTasksCursor = (
  cursor: string,
  context: ListWateringTasksCursorContext
): ListWateringTasksCursorPayload => {
  const envelope = parseCursorEnvelope(cursor);

  if (envelope.userId !== context.userId) {
    throw new InvalidCursorError("Cursor belongs to a different user");
  }

  if (envelope.sort !== context.sort || envelope.order !== context.order) {
    throw new InvalidCursorError("Cursor does not match the requested sort");
  }

  if (!filtersEqual(envelope.filters, context.filters)) {
    throw new InvalidCursorError("Cursor filters do not match the current request");
  }

  return {
    userId: envelope.userId,
    sort: envelope.sort,
    order: envelope.order,
    sortValue: envelope.sortValue,
    id: envelope.id,
    filters: envelope.filters,
  };
};
