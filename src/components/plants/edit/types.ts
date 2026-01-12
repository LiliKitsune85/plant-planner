import type { UpdatePlantCommand } from "@/types";

export interface PlantEditFormValues {
  speciesName: string;
  nickname: string;
  description: string;
  purchaseDate: string;
  photoPath: string;
}

export type PlantEditFieldKey = "nickname" | "description" | "purchase_date" | "photo_path" | "form";

export type PlantEditFormFieldErrors = Partial<Record<PlantEditFieldKey, string[]>>;

export interface PlantEditFormErrors {
  form?: string;
  fields: PlantEditFormFieldErrors;
}

export type PlantEditErrorKind =
  | "validation"
  | "unauthenticated"
  | "notFound"
  | "network"
  | "http"
  | "parse"
  | "unknown";

export interface PlantEditErrorVm {
  kind: PlantEditErrorKind;
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
  fieldErrors?: Record<string, string[]>;
}

export interface PlantEditDirtyState {
  isDirty: boolean;
  changedFields: (keyof UpdatePlantCommand)[];
}

export type PlantEditViewStatus = "idle" | "loading" | "success" | "error";
