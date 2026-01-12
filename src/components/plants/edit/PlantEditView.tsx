import { useCallback, useEffect, useMemo, useState } from "react";
import type { FC } from "react";

import { usePlantDetail } from "@/components/hooks/use-plant-detail";
import { useUpdatePlant } from "@/components/hooks/use-update-plant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { PlantDetailErrorVm } from "@/components/plants/detail/types";
import { PlantEditErrorState } from "./PlantEditErrorState";
import { PlantEditForm } from "./PlantEditForm";
import { PlantEditSkeleton } from "./PlantEditSkeleton";
import { PlantEditSuccessToast } from "./PlantEditSuccessToast";
import {
  buildUpdatePlantPayload,
  calculatePlantEditDirtyState,
  DEFAULT_PLANT_EDIT_FORM_ERRORS,
  mapPlantDetailToFormValues,
  validatePlantEditValues,
} from "./form-helpers";
import type { PlantEditErrorVm, PlantEditFieldKey, PlantEditFormValues } from "./types";

const mapDetailErrorToEditError = (detailError?: PlantDetailErrorVm): PlantEditErrorVm | undefined => {
  if (!detailError) return undefined;
  return {
    kind: detailError.kind === "http" ? "http" : detailError.kind,
    message: detailError.message,
    code: detailError.code,
    requestId: detailError.requestId,
    details: detailError.details,
  };
};

interface PlantEditViewProps {
  plantId: string;
}

const formFieldToErrorKey: Record<keyof PlantEditFormValues, PlantEditFieldKey | null> = {
  speciesName: null,
  nickname: "nickname",
  description: "description",
  purchaseDate: "purchase_date",
  photoPath: "photo_path",
};

const DEFAULT_DIRTY_STATE = {
  isDirty: false,
  changedFields: [],
} as const;

export const PlantEditView: FC<PlantEditViewProps> = ({ plantId }) => {
  const { status, plant, error: detailError, reload, mutate } = usePlantDetail({ plantId });
  const error = useMemo(() => mapDetailErrorToEditError(detailError), [detailError]);
  const [values, setValues] = useState<PlantEditFormValues | null>(null);
  const [initialValues, setInitialValues] = useState<PlantEditFormValues | null>(null);
  const [formErrors, setFormErrors] = useState(DEFAULT_PLANT_EDIT_FORM_ERRORS);
  const [successOpen, setSuccessOpen] = useState(false);
  const { isSaving, submit } = useUpdatePlant({ plantId });

  useEffect(() => {
    if (!plant) return;
    const mapped = mapPlantDetailToFormValues(plant);
    setValues(mapped);
    setInitialValues(mapped);
    setFormErrors({ fields: {} });
  }, [plant]);

  useEffect(() => {
    if (!successOpen) return;
    if (typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      setSuccessOpen(false);
    }, 4000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successOpen]);

  const dirtyState = useMemo(() => {
    if (!values || !initialValues) return DEFAULT_DIRTY_STATE;
    return calculatePlantEditDirtyState(initialValues, values);
  }, [initialValues, values]);

  const handleChange = useCallback((patch: Partial<PlantEditFormValues>) => {
    setValues((prev) => (prev ? { ...prev, ...patch } : prev));
    setFormErrors((prev) => {
      const keysToClear = new Set<string>();
      for (const key of Object.keys(patch) as (keyof PlantEditFormValues)[]) {
        const errorKey = formFieldToErrorKey[key];
        if (errorKey) {
          keysToClear.add(errorKey);
        }
      }
      if (keysToClear.size === 0) return prev;

      const nextFields = Object.fromEntries(
        Object.entries(prev.fields).filter(([field]) => !keysToClear.has(field))
      ) as typeof prev.fields;

      return { fields: nextFields };
    });
    setSuccessOpen(false);
  }, []);

  const handleCancel = useCallback(() => {
    if (typeof window === "undefined") return;
    if (dirtyState.isDirty) {
      const confirmed = window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz opuścić edycję?");
      if (!confirmed) return;
    }
    window.location.href = "/plants";
  }, [dirtyState.isDirty]);

  const loginHref = useMemo(() => `/auth/login?returnTo=${encodeURIComponent(`/plants/${plantId}/edit`)}`, [plantId]);

  const handleSubmit = useCallback(async () => {
    if (!values || !initialValues) return;

    const validation = validatePlantEditValues(values);
    const hasFieldErrors = Object.values(validation.fields).some((messages) => (messages?.length ?? 0) > 0);
    if (hasFieldErrors) {
      setFormErrors({ ...validation });
      return;
    }

    const payload = buildUpdatePlantPayload(initialValues, values);
    if (Object.keys(payload).length === 0) {
      setFormErrors({
        ...validation,
        form: "Brak zmian do zapisania. Zaktualizuj przynajmniej jedno pole.",
      });
      return;
    }

    const result = await submit(payload, { baseFieldErrors: validation.fields });
    if (!result.ok) {
      if (result.kind === "aborted") return;
      setFormErrors({
        form: result.formError,
        fields: result.fieldErrors,
      });
      return;
    }

    mutate(result.data);
    const mapped = mapPlantDetailToFormValues(result.data);
    setInitialValues(mapped);
    setValues(mapped);
    setFormErrors({ fields: {} });
    setSuccessOpen(true);
  }, [initialValues, mutate, submit, values]);

  if (status === "error" && error) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">edycja rośliny</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Edytuj roślinę</h1>
        </header>
        <PlantEditErrorState error={error} onRetry={reload} loginHref={loginHref} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">edycja rośliny</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {plant?.plant.display_name ?? "Edytuj roślinę"}
            </h1>
          </div>
          <Button variant="ghost" asChild>
            <a href="/plants">← Powrót</a>
          </Button>
        </div>
        <p className="text-base text-muted-foreground">
          Zmieniaj jedynie pola opcjonalne (pseudonim, opis, data zakupu, ścieżka do zdjęcia). Nazwa gatunku pozostaje
          nieedytowalna w tej wersji aplikacji.
        </p>
      </header>

      {status === "loading" || !values || !initialValues ? (
        <PlantEditSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Dane rośliny</CardTitle>
            <CardDescription>
              Uzupełnij dodatkowe informacje, aby łatwiej identyfikować i pielęgnować roślinę.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlantEditForm
              values={values}
              errors={formErrors}
              pending={isSaving}
              dirtyState={dirtyState}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      )}

      <PlantEditSuccessToast open={successOpen} onOpenChange={setSuccessOpen} />
    </main>
  );
};

PlantEditView.displayName = "PlantEditView";
