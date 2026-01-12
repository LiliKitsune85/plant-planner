import type { CreatePlantResultDto } from "@/types";

export interface CreatePlantFormValues {
  species_name: string;
  nickname: string;
  description: string;
  purchase_date: string;
  generate_watering_suggestion: boolean;
}

export type CreatePlantFormField =
  | "species_name"
  | "nickname"
  | "description"
  | "purchase_date"
  | "generate_watering_suggestion"
  | "form";

export interface CreatePlantFormErrors {
  fieldErrors: Partial<Record<CreatePlantFormField, string[]>>;
  formError?: string;
}

export type CreatePlantSubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; result: CreatePlantResultDto }
  | { status: "error"; error: CreatePlantErrorVm };

export interface CreatePlantErrorVm {
  kind: "validation" | "unauthenticated" | "conflict" | "network" | "http" | "parse" | "unknown";
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
  fieldErrors?: Record<string, string[]>;
}

export interface AiRateLimitVm {
  isRateLimited: boolean;
  unlockAt?: string | null;
}

export interface CreatePlantAiToggleVm {
  enabled: boolean;
  isRateLimited: boolean;
  unlockAt?: string | null;
  showLimitInfo: boolean;
  limitText: string;
  isRefreshingQuota: boolean;
  onToggle: (enabled: boolean) => void;
  onRefresh: () => void;
}

export const CREATE_PLANT_FIELD_ORDER: CreatePlantFormField[] = [
  "species_name",
  "nickname",
  "description",
  "purchase_date",
  "generate_watering_suggestion",
];

export const DEFAULT_CREATE_PLANT_FORM_VALUES: CreatePlantFormValues = {
  species_name: "",
  nickname: "",
  description: "",
  purchase_date: "",
  generate_watering_suggestion: true,
};

export const DEFAULT_CREATE_PLANT_FORM_ERRORS: CreatePlantFormErrors = {
  fieldErrors: {},
};
