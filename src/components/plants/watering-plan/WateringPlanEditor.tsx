import { useCallback, useEffect, useMemo, useState } from "react";
import type { FC } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAlertArea } from "@/components/plants/watering-plan/InlineAlertArea";
import { WateringPlanForm } from "@/components/plants/watering-plan/WateringPlanForm";
import type {
  SetPlanErrorVm,
  WateringPlanFormErrors,
  WateringPlanFormValues,
  WateringPlanFormField,
} from "@/components/plants/watering-plan/types";
import { validateWateringPlanForm } from "@/components/plants/watering-plan/view-model";

export type WateringPlanEditorMode = "ai_edit" | "manual";

export interface WateringPlanEditorProps {
  mode: WateringPlanEditorMode;
  initialValues: WateringPlanFormValues;
  isSaving: boolean;
  saveError?: SetPlanErrorVm | null;
  onSubmit: (values: WateringPlanFormValues) => void;
  onBack: () => void;
  onDismissError?: () => void;
}

const DEFAULT_FORM_ERRORS: WateringPlanFormErrors = { fieldErrors: {} };

const SERVER_FIELD_MAP: Record<string, WateringPlanFormField> = {
  interval_days: "interval_days",
  start_from: "start_from",
  custom_start_on: "custom_start_on",
  horizon_days: "horizon_days",
  schedule_basis: "schedule_basis",
  overdue_policy: "overdue_policy",
  form: "form",
};

const mapServerFieldErrors = (source?: Record<string, string[]>): WateringPlanFormErrors["fieldErrors"] => {
  if (!source) return {};
  const mapped: WateringPlanFormErrors["fieldErrors"] = {};
  for (const [field, messages] of Object.entries(source)) {
    if (!Array.isArray(messages) || messages.length === 0) continue;
    const key = SERVER_FIELD_MAP[field] ?? "form";
    const filtered = messages.filter((message): message is string => typeof message === "string");
    if (filtered.length === 0) continue;
    mapped[key] = filtered;
  }
  return mapped;
};

const removeFieldErrorsForPatch = (
  fieldErrors: WateringPlanFormErrors["fieldErrors"],
  patch: Partial<WateringPlanFormValues>
): WateringPlanFormErrors["fieldErrors"] => {
  const keysToClear = new Set(Object.keys(patch));
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(([key]) => !keysToClear.has(key))
  ) as WateringPlanFormErrors["fieldErrors"];
};

export const WateringPlanEditor: FC<WateringPlanEditorProps> = ({
  mode,
  initialValues,
  isSaving,
  saveError,
  onSubmit,
  onBack,
  onDismissError,
}) => {
  const [value, setValue] = useState<WateringPlanFormValues>(initialValues);
  const [errors, setErrors] = useState<WateringPlanFormErrors>(DEFAULT_FORM_ERRORS);

  useEffect(() => {
    setValue(initialValues);
    setErrors(DEFAULT_FORM_ERRORS);
  }, [initialValues]);

  const handleChange = useCallback((patch: Partial<WateringPlanFormValues>) => {
    setValue((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => ({
      fieldErrors: removeFieldErrorsForPatch(prev.fieldErrors, patch),
      formError: undefined,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    const validation = validateWateringPlanForm(value);
    if (Object.keys(validation.fieldErrors).length > 0) {
      setErrors(validation);
      return;
    }
    onSubmit(value);
  }, [onSubmit, value]);

  useEffect(() => {
    if (!saveError) {
      setErrors((prev) =>
        prev.formError
          ? {
              ...prev,
              formError: undefined,
            }
          : prev
      );
      return;
    }

    if (saveError.kind === "validation") {
      setErrors({
        fieldErrors: mapServerFieldErrors(saveError.fieldErrors),
        formError: saveError.message,
      });
    }
  }, [saveError]);

  const title = useMemo(() => {
    return mode === "ai_edit" ? "Edytuj propozycję AI" : "Ustaw plan ręcznie";
  }, [mode]);

  const description = useMemo(() => {
    return mode === "ai_edit"
      ? "Dostosuj szczegóły planu zaproponowanego przez AI, aby dopasować go do swoich potrzeb."
      : "Skonfiguruj plan od podstaw, definiując interwały i zasady dla tej rośliny.";
  }, [mode]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <InlineAlertArea error={saveError ?? undefined} onDismiss={onDismissError} />
        <WateringPlanForm
          value={value}
          errors={errors}
          isSaving={isSaving}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onBack={onBack}
        />
      </CardContent>
    </Card>
  );
};

WateringPlanEditor.displayName = "WateringPlanEditor";
