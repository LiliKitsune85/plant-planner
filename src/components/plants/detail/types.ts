export interface PlantDetailVm {
  plant: {
    id: string;
    displayName: string;
    speciesName: string;
    duplicateIndex: number;
    nickname: string | null;
    description: string | null;
    purchaseDate: string | null;
    photoPath: string | null;
  };
  activePlan: PlantDetailActivePlanVm | null;
}

export interface PlantDetailActivePlanVm {
  id: string;
  intervalDays: number;
  horizonDays: number;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  scheduleBasis: "due_on" | "completed_on";
  startFrom: "today" | "purchase_date" | "custom_date";
  customStartOn: string | null;
  overduePolicy: "carry_forward" | "reschedule";
  wasAiSuggested: boolean;
  wasAiAcceptedWithoutChanges: boolean | null;
  aiRequestId: string | null;
}

export interface PlantActionsVm {
  calendarHref: string;
  calendarLabel: string;
  editHref: string;
  changePlanHref: string;
  generateAiHref: string;
  setManualHref: string;
}

export type PlantDetailStatus = "idle" | "loading" | "success" | "error";

export type PlantDetailErrorKind =
  | "validation"
  | "unauthenticated"
  | "notFound"
  | "network"
  | "parse"
  | "http"
  | "unknown";

export interface PlantDetailErrorVm {
  kind: PlantDetailErrorKind;
  message: string;
  code?: string;
  status?: number;
  requestId?: string;
  details?: unknown;
}

export interface PlantDetailMutationErrorVm {
  kind: PlantDetailErrorKind | "conflict";
  message: string;
  code?: string;
  requestId?: string;
  details?: unknown;
  fieldErrors?: Record<string, string[]>;
}
