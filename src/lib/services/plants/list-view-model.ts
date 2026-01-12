import type { PlantListDto, PlantListItemDto } from "@/types";

import { PlantsApiError } from "./plants-client";
import type { PlantSortField, SortOrder } from "./types";

export interface PlantsListQueryState {
  q?: string;
  species?: string;
  sort: PlantSortField;
  order: SortOrder;
  limit: number;
}

export interface PlantListItemVm {
  id: string;
  href: string;
  displayName: string;
  nickname?: string | null;
  photoPath?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metaLabel?: string | null;
}

export interface PlantsListVm {
  query: PlantsListQueryState;
  items: PlantListItemVm[];
  nextCursor: string | null;
  hasAnyItems: boolean;
  isFiltered: boolean;
}

export interface PlantsListErrorVm {
  kind: "validation" | "unauthenticated" | "http" | "network" | "parse" | "unknown";
  message: string;
  code?: string;
  status?: number;
  requestId?: string;
}

export const PLANTS_LIST_DEFAULT_SORT: PlantSortField = "species_name";
export const PLANTS_LIST_DEFAULT_ORDER: SortOrder = "asc";
export const PLANTS_LIST_DEFAULT_LIMIT = 20;
export const PLANTS_LIST_MIN_LIMIT = 1;
export const PLANTS_LIST_MAX_LIMIT = 100;
export const PLANTS_LIST_MAX_QUERY_LENGTH = 120;
const PLANTS_LIST_DATE_FORMATTER = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const isPlantSortField = (value: unknown): value is PlantSortField =>
  value === "created_at" || value === "species_name" || value === "updated_at";

const isSortOrder = (value: unknown): value is SortOrder => value === "asc" || value === "desc";

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const normalizePlantsListSort = (value?: PlantSortField | string | null): PlantSortField => {
  if (isPlantSortField(value)) {
    return value;
  }
  return PLANTS_LIST_DEFAULT_SORT;
};

export const normalizePlantsListOrder = (value?: SortOrder | string | null): SortOrder => {
  if (isSortOrder(value)) {
    return value;
  }
  return PLANTS_LIST_DEFAULT_ORDER;
};

export const normalizePlantsListLimit = (value?: unknown): number => {
  const parsed = parseNumeric(value);
  if (parsed === null) {
    return PLANTS_LIST_DEFAULT_LIMIT;
  }
  return clamp(parsed, PLANTS_LIST_MIN_LIMIT, PLANTS_LIST_MAX_LIMIT);
};

const normalizeTextFilter = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > PLANTS_LIST_MAX_QUERY_LENGTH) {
    return trimmed.slice(0, PLANTS_LIST_MAX_QUERY_LENGTH);
  }
  return trimmed;
};

export const normalizePlantsListSearch = (value?: string | null): string | undefined => normalizeTextFilter(value);

export const normalizePlantsListSpecies = (value?: string | null): string | undefined => normalizeTextFilter(value);

export const normalizePlantsListQueryState = (value: PlantsListQueryState): PlantsListQueryState => ({
  q: normalizePlantsListSearch(value.q),
  species: normalizePlantsListSpecies(value.species),
  sort: normalizePlantsListSort(value.sort),
  order: normalizePlantsListOrder(value.order),
  limit: normalizePlantsListLimit(value.limit),
});

export const arePlantsListQueriesEqual = (a: PlantsListQueryState, b: PlantsListQueryState): boolean =>
  a.q === b.q && a.species === b.species && a.sort === b.sort && a.order === b.order && a.limit === b.limit;

export const buildInitialPlantsListQuery = (url: URL): PlantsListQueryState => ({
  q: normalizePlantsListSearch(url.searchParams.get("q")),
  species: normalizePlantsListSpecies(url.searchParams.get("species")),
  sort: normalizePlantsListSort(url.searchParams.get("sort")),
  order: normalizePlantsListOrder(url.searchParams.get("order")),
  limit: normalizePlantsListLimit(url.searchParams.get("limit")),
});

export const buildPlantsListHref = (query: PlantsListQueryState): string => {
  const params = new URLSearchParams();

  if (query.q) {
    params.set("q", query.q);
  }
  if (query.species) {
    params.set("species", query.species);
  }
  if (query.sort !== PLANTS_LIST_DEFAULT_SORT) {
    params.set("sort", query.sort);
  }
  if (query.order !== PLANTS_LIST_DEFAULT_ORDER) {
    params.set("order", query.order);
  }
  if (query.limit !== PLANTS_LIST_DEFAULT_LIMIT) {
    params.set("limit", String(query.limit));
  }

  const search = params.toString();
  return search ? `/plants?${search}` : "/plants";
};

export const mapPlantListItemDtoToVm = (dto: PlantListItemDto): PlantListItemVm => ({
  id: dto.id,
  href: `/plants/${dto.id}`,
  displayName: dto.display_name,
  nickname: dto.nickname,
  photoPath: dto.photo_path,
  createdAt: dto.created_at ?? undefined,
  updatedAt: dto.updated_at ?? undefined,
  metaLabel: buildPlantMetaLabel(dto),
});

export const buildPlantsListVm = (args: {
  query: PlantsListQueryState;
  dto: PlantListDto;
  nextCursor: string | null;
}): PlantsListVm => {
  const items = args.dto.items.map(mapPlantListItemDtoToVm);
  const hasAnyItems = items.length > 0;
  const isFiltered = Boolean(
    (args.query.q && args.query.q.length > 0) || (args.query.species && args.query.species.length > 0)
  );

  return {
    query: args.query,
    items,
    nextCursor: args.nextCursor,
    hasAnyItems,
    isFiltered,
  };
};

export const getPlantsListCacheKey = (query: PlantsListQueryState): string => {
  const normalizeKeyPart = (value?: string): string => (value ? value.trim().toLowerCase() : "");
  return [normalizeKeyPart(query.q), normalizeKeyPart(query.species), query.sort, query.order, query.limit].join("|");
};

const safeDateFromIso = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildPlantMetaLabel = (dto: PlantListItemDto): string | null => {
  const updatedAt = safeDateFromIso(dto.updated_at);
  if (updatedAt) {
    return `Aktualizacja ${PLANTS_LIST_DATE_FORMATTER.format(updatedAt)}`;
  }
  const createdAt = safeDateFromIso(dto.created_at);
  if (createdAt) {
    return `Dodano ${PLANTS_LIST_DATE_FORMATTER.format(createdAt)}`;
  }
  return null;
};

export const buildPlantsListErrorVmFromApiError = (error: PlantsApiError): PlantsListErrorVm => ({
  kind: error.kind,
  message: error.message,
  code: error.code,
  status: error.status,
  requestId: error.requestId,
});

export const buildPlantsListValidationErrorVm = (message: string): PlantsListErrorVm => ({
  kind: "validation",
  message,
  code: "INVALID_QUERY_PARAMS",
});

export const buildUnknownPlantsListErrorVm = (message = "Nie udało się wczytać listy roślin."): PlantsListErrorVm => ({
  kind: "unknown",
  message,
});
