import type {
  PlantActionsVm,
  PlantDetailErrorVm,
  PlantDetailMutationErrorVm,
  PlantDetailVm,
} from "@/components/plants/detail/types";
import type { PlantDetailDto, WateringPlanSummaryDto } from "@/types";

import { PlantsApiError } from "./plants-client";
import { WateringTaskApiError } from "../watering-tasks/watering-task-client";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MS_PER_DAY = 86_400_000;

const formatIsoDate = (date: Date): string => date.toISOString().slice(0, 10);
const todayFormatter = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short" });
const longDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * MS_PER_DAY);

const parseIsoDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeNote = (note?: string | null): string | null => {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  if (!trimmed) return null;
  return trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;
};

const buildFieldErrorsFromDetails = (details: unknown): Record<string, string[]> | undefined => {
  if (!details || typeof details !== "object") return undefined;

  const fields = (details as { fields?: unknown }).fields;
  if (fields && typeof fields === "object") {
    const result: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(fields)) {
      if (!Array.isArray(messages)) continue;
      const filtered = messages.filter((message): message is string => typeof message === "string");
      if (filtered.length > 0) {
        result[field] = filtered;
      }
    }
    if (Object.keys(result).length > 0) {
      return result;
    }
  }

  const issues = (details as { issues?: unknown }).issues;
  if (Array.isArray(issues)) {
    const result: Record<string, string[]> = {};
    for (const issue of issues) {
      if (!issue || typeof issue !== "object") continue;
      const path = (issue as { path?: unknown }).path;
      const pathString = Array.isArray(path) ? (path as string[]).join(".") : typeof path === "string" ? path : "form";
      const message = (issue as { message?: unknown }).message;
      if (typeof message !== "string" || !message) continue;
      if (!result[pathString]) {
        result[pathString] = [];
      }
      result[pathString]?.push(message);
    }
    if (Object.keys(result).length > 0) {
      return result;
    }
  }

  return undefined;
};

const mapActivePlan = (plan: WateringPlanSummaryDto | null): PlantDetailVm["activePlan"] => {
  if (!plan) return null;
  return {
    id: plan.id,
    intervalDays: plan.interval_days,
    horizonDays: plan.horizon_days,
    isActive: plan.is_active,
    validFrom: plan.valid_from ?? null,
    validTo: plan.valid_to ?? null,
    scheduleBasis: plan.schedule_basis,
    startFrom: plan.start_from,
    customStartOn: plan.custom_start_on ?? null,
    overduePolicy: plan.overdue_policy,
    wasAiSuggested: plan.was_ai_suggested,
    wasAiAcceptedWithoutChanges: plan.was_ai_accepted_without_changes ?? null,
    aiRequestId: plan.ai_request_id ?? null,
  };
};

export const mapPlantDetailDtoToVm = (dto: PlantDetailDto): PlantDetailVm => ({
  plant: {
    id: dto.plant.id,
    displayName: dto.plant.display_name,
    speciesName: dto.plant.species_name,
    duplicateIndex: dto.plant.duplicate_index,
    nickname: dto.plant.nickname ?? null,
    description: dto.plant.description ?? null,
    purchaseDate: dto.plant.purchase_date ?? null,
    photoPath: dto.plant.photo_path ?? null,
  },
  activePlan: mapActivePlan(dto.active_watering_plan),
});

export const isValidPlantId = (value: string): boolean => UUID_REGEX.test(value);

export const buildMissingPlantIdErrorVm = (): PlantDetailErrorVm => ({
  kind: "validation",
  message: "Brakuje parametru plantId w adresie URL.",
  code: "MISSING_PLANT_ID",
});

export const buildInvalidPlantIdErrorVm = (): PlantDetailErrorVm => ({
  kind: "validation",
  message: "Niepoprawny identyfikator rośliny.",
  code: "INVALID_PLANT_ID",
});

export const buildPlantNotFoundErrorVm = (): PlantDetailErrorVm => ({
  kind: "notFound",
  message: "Nie znaleziono tej rośliny lub została usunięta.",
  code: "PLANT_NOT_FOUND",
});

export const buildUnknownPlantDetailErrorVm = (): PlantDetailErrorVm => ({
  kind: "unknown",
  message: "Nie udało się pobrać danych rośliny. Spróbuj ponownie później.",
  code: "UNKNOWN_ERROR",
});

export const buildPlantDetailErrorVmFromApiError = (error: PlantsApiError): PlantDetailErrorVm => ({
  kind: error.kind === "conflict" ? "http" : error.kind,
  message: error.message ?? "Nie udało się pobrać danych rośliny.",
  code: error.code,
  status: error.status,
  requestId: error.requestId,
  details: error.details,
});

export const buildPlantDetailMutationErrorFromPlantsApi = (error: PlantsApiError): PlantDetailMutationErrorVm => ({
  kind: error.kind === "conflict" ? "conflict" : error.kind,
  message: error.message ?? "Operacja nie powiodła się. Spróbuj ponownie.",
  code: error.code,
  requestId: error.requestId,
  details: error.details,
  fieldErrors: buildFieldErrorsFromDetails(error.details),
});

export const buildPlantDetailMutationErrorFromWateringApi = (
  error: WateringTaskApiError
): PlantDetailMutationErrorVm => {
  if (error.code === "TASK_ALREADY_EXISTS") {
    return {
      kind: "conflict",
      message: "Na dzisiaj istnieje już wpis podlewania dla tej rośliny.",
      code: error.code,
      requestId: error.requestId,
      details: error.details,
      fieldErrors: buildFieldErrorsFromDetails(error.details),
    };
  }

  return {
    kind: error.kind === "conflict" ? "conflict" : error.kind,
    message: error.message ?? "Nie udało się zapisać wpisu podlewania.",
    code: error.code,
    requestId: error.requestId,
    details: error.details,
    fieldErrors: buildFieldErrorsFromDetails(error.details),
  };
};

export const buildPlantDetailMutationUnknownError = (
  message = "Operacja nie powiodła się. Spróbuj ponownie później."
): PlantDetailMutationErrorVm => ({
  kind: "unknown",
  message,
});

const buildPlanHref = (plantId: string, params?: Record<string, string | null | undefined>): string => {
  const search = new URLSearchParams();
  search.set("source", "detail");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, value);
      }
    }
  }
  const query = search.toString();
  return query ? `/plants/${plantId}/watering-plan?${query}` : `/plants/${plantId}/watering-plan`;
};

const clampIntervalDays = (interval: number): number => {
  if (!Number.isFinite(interval) || interval <= 0) return 1;
  return Math.floor(interval);
};

const determinePlanStart = (vm: PlantDetailVm, plan = vm.activePlan): Date | null => {
  if (!plan) return null;
  if (plan.validFrom) {
    const validFromDate = parseIsoDate(plan.validFrom);
    if (validFromDate) return validFromDate;
  }
  switch (plan.startFrom) {
    case "purchase_date":
      return parseIsoDate(vm.plant.purchaseDate) ?? startOfUtcDay(new Date());
    case "custom_date":
      return parseIsoDate(plan.customStartOn) ?? startOfUtcDay(new Date());
    case "today":
    default:
      return startOfUtcDay(new Date());
  }
};

const computeNextWateringDate = (vm: PlantDetailVm): string | null => {
  const plan = vm.activePlan;
  if (!plan) return null;

  const interval = clampIntervalDays(plan.intervalDays);
  const today = startOfUtcDay(new Date());
  let cursor = determinePlanStart(vm, plan) ?? today;
  const horizonLimit =
    plan.horizonDays > 0 ? addDays(cursor, plan.horizonDays) : plan.validTo ? parseIsoDate(plan.validTo) : null;

  let safety = 0;
  while (cursor < today && safety < 500) {
    cursor = addDays(cursor, interval);
    safety += 1;
  }

  if (horizonLimit && cursor > horizonLimit) {
    cursor = horizonLimit;
  }

  return formatIsoDate(cursor);
};

const buildCalendarLabel = (targetDate: string, todayIso: string): string => {
  if (targetDate === todayIso) {
    return `dziś • ${todayFormatter.format(new Date(`${targetDate}T00:00:00Z`))}`;
  }
  return longDateFormatter.format(new Date(`${targetDate}T00:00:00Z`));
};

export const buildPlantActionsVm = (vm: PlantDetailVm): PlantActionsVm => {
  const today = getTodayIsoDate();
  const nextDate = computeNextWateringDate(vm) ?? today;
  const calendarHref = `/calendar/day/${nextDate}`;
  const calendarLabel = buildCalendarLabel(nextDate, today);

  const changePlanParams: Record<string, string | undefined> = {
    mode: "edit",
    planId: vm.activePlan?.id,
    aiRequestId: vm.activePlan?.aiRequestId ?? undefined,
  };

  const generateAiParams: Record<string, string | undefined> = {
    mode: "ai",
    aiRequestId: vm.activePlan?.aiRequestId ?? undefined,
  };

  const manualParams: Record<string, string | undefined> = {
    mode: "manual",
    planId: vm.activePlan?.id,
  };

  return {
    calendarHref,
    calendarLabel,
    editHref: `/plants/${vm.plant.id}/edit`,
    changePlanHref: buildPlanHref(vm.plant.id, changePlanParams),
    generateAiHref: buildPlanHref(vm.plant.id, generateAiParams),
    setManualHref: buildPlanHref(vm.plant.id, manualParams),
  };
};

export const getTodayIsoDate = (): string => formatIsoDate(startOfUtcDay(new Date()));

export const clampWateringNote = normalizeNote;
