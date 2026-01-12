import { useCallback, useEffect } from "react";

import { useCreatePlant } from "@/components/hooks/use-create-plant";
import { CreatePlantForm } from "@/components/plants/new/CreatePlantForm";
import { CreatePlantInlineError } from "@/components/plants/new/CreatePlantInlineError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CREATE_PLANT_LOGIN_RETURN = "/plants/new";

export const CreatePlantView = () => {
  const { value, errors, isSubmitting, submitState, aiToggleVm, handleChange, handleSubmit, resetError } =
    useCreatePlant();

  useEffect(() => {
    if (submitState.status !== "success") return;
    if (typeof window === "undefined") return;
    const nextHref = `/plants/${submitState.result.plant.id}/watering-plan`;
    window.location.assign(nextHref);
  }, [submitState]);

  const handleCancel = useCallback(() => {
    if (typeof window === "undefined") return;
    window.location.href = "/calendar";
  }, []);

  const handleRetry = useCallback(() => {
    resetError();
    handleSubmit();
  }, [handleSubmit, resetError]);

  const loginHref = `/auth/login?returnTo=${encodeURIComponent(CREATE_PLANT_LOGIN_RETURN)}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground uppercase tracking-widest">nowa roślina</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dodaj roślinę</h1>
        <p className="text-base text-muted-foreground">
          Wypełnij podstawowe informacje o roślinie, aby rozpocząć plan pielęgnacji. Minimalnie wymagana jest nazwa
          gatunku.
        </p>
      </header>
      {submitState.status === "error" ? (
        <CreatePlantInlineError
          error={submitState.error}
          onRetry={handleRetry}
          onDismiss={resetError}
          loginHref={loginHref}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Podstawowe informacje</CardTitle>
          <CardDescription>W każdej chwili możesz wrócić i uzupełnić szczegóły.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreatePlantForm
            value={value}
            errors={errors}
            isSubmitting={isSubmitting}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            ai={aiToggleVm}
          />
        </CardContent>
      </Card>
    </main>
  );
};

CreatePlantView.displayName = "CreatePlantView";
