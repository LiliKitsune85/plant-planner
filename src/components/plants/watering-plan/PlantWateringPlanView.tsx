import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import type { FC } from "react";

import { Button } from "@/components/ui/button";
import { PlantWateringPlanHeader } from "@/components/plants/watering-plan/PlantWateringPlanHeader";
import { AiSuggestionCard } from "@/components/plants/watering-plan/AiSuggestionCard";
import { AiBlockedState } from "@/components/plants/watering-plan/AiBlockedState";
import { AiErrorState } from "@/components/plants/watering-plan/AiErrorState";
import { AiSkippedState } from "@/components/plants/watering-plan/AiSkippedState";
import { FullScreenState } from "@/components/plants/watering-plan/FullScreenState";
import { WateringPlanEditor } from "@/components/plants/watering-plan/WateringPlanEditor";
import type {
  PlantWateringPlanMode,
  WateringPlanFormValues,
  WateringPlanSourceVm,
  AiSuggestionAvailableVm,
  AiSuggestionRateLimitedVm,
  AiSuggestionStateVm,
} from "@/components/plants/watering-plan/types";
import { useWateringPlanSuggestion } from "@/components/hooks/use-watering-plan-suggestion";
import { useSetWateringPlan } from "@/components/hooks/use-set-watering-plan";
import {
  buildDefaultFormValues,
  buildManualOnlyState,
  formValuesFromSuggestion,
  isValidWateringPlanPlantId,
  sanitizeFormToSetCommand,
} from "@/components/plants/watering-plan/view-model";
import type { AiQuotaDto, WateringSuggestionForCreationDto } from "@/types";
import { consumeCreatePlantResult } from "@/lib/services/plants/create-plant-result-session";
import { getCalendarDay } from "@/lib/services/calendar/day-client";
import { getCalendarMonth } from "@/lib/services/calendar/month-client";
import { fetchAiQuota } from "@/lib/services/ai/ai-quota-client";
import { getPlantDetail } from "@/lib/services/plants/plants-client";
import { getWateringPlanContext, saveWateringPlanContext } from "@/lib/services/plants/watering-plan-context-session";

export interface PlantWateringPlanViewProps {
  plantId: string;
  mode?: PlantWateringPlanMode;
  initialSpeciesName?: string;
}

const getTodayIsoDate = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
};

export const PlantWateringPlanView: FC<PlantWateringPlanViewProps> = ({
  plantId,
  mode = "suggest",
  initialSpeciesName,
}) => {
  const [currentMode, setCurrentMode] = useState<PlantWateringPlanMode>(mode);
  const [speciesName, setSpeciesName] = useState<string | null>(initialSpeciesName ?? null);
  const [creationSuggestion, setCreationSuggestion] = useState<WateringSuggestionForCreationDto | null>(null);
  const [aiEnabled, setAiEnabled] = useState(mode !== "edit");
  const [editorMode, setEditorMode] = useState<"ai_edit" | "manual">(mode === "edit" ? "manual" : "ai_edit");
  const [editorInitialValues, setEditorInitialValues] = useState<WateringPlanFormValues>(buildDefaultFormValues());
  const [editorSource, setEditorSource] = useState<WateringPlanSourceVm>({ type: "manual" });
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isHydratingSpecies, setIsHydratingSpecies] = useState(false);
  const [precheckedRateLimit, setPrecheckedRateLimit] = useState<AiSuggestionRateLimitedVm | null>(null);
  const [precheckedQuota, setPrecheckedQuota] = useState<AiQuotaDto | null>(null);
  const [quotaCheckpoint, setQuotaCheckpoint] = useState<"idle" | "checking" | "ready">("idle");
  const speciesHydrationAttemptRef = useRef<string | null>(null);
  const speciesHydrationController = useRef<AbortController | null>(null);
  const quotaControllerRef = useRef<AbortController | null>(null);

  const {
    state: suggestionState,
    isRunning: isSuggesting,
    run,
    reset,
  } = useWateringPlanSuggestion({
    plantId,
    speciesName,
    enabled: aiEnabled && Boolean(speciesName),
    initialSuggestion: creationSuggestion,
  });
  const { isSaving, error: saveError, save, clearError } = useSetWateringPlan({ plantId });
  const isBusy = isSaving || isRedirecting;
  const isQuotaChecking = quotaCheckpoint === "checking";

  useEffect(() => {
    return () => {
      speciesHydrationController.current?.abort();
      quotaControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!plantId) return;
    const cached = getWateringPlanContext(plantId);
    if (!cached) return;
    if (cached.speciesName) {
      setSpeciesName((prev) => prev ?? cached.speciesName ?? null);
    }
    if (cached.suggestion) {
      setCreationSuggestion((prev) => prev ?? cached.suggestion);
    }
  }, [plantId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = consumeCreatePlantResult();
    if (!payload || payload.plantId !== plantId) return;
    setCreationSuggestion(payload.wateringSuggestion);
    if (payload.speciesName) {
      setSpeciesName((prev) => prev ?? payload.speciesName);
    }
    if (payload.speciesName || payload.wateringSuggestion.status === "available") {
      saveWateringPlanContext(plantId, {
        speciesName: payload.speciesName ?? null,
        suggestion: payload.wateringSuggestion.status === "available" ? payload.wateringSuggestion : undefined,
      });
    }
  }, [plantId]);

  useEffect(() => {
    speciesHydrationAttemptRef.current = null;
  }, [plantId]);

  useEffect(() => {
    if (speciesName) {
      speciesHydrationController.current?.abort();
      setIsHydratingSpecies(false);
      return;
    }
    if (!plantId || !isValidWateringPlanPlantId(plantId)) return;
    if (speciesHydrationAttemptRef.current === plantId) return;

    const controller = new AbortController();
    speciesHydrationController.current = controller;
    speciesHydrationAttemptRef.current = plantId;
    setIsHydratingSpecies(true);

    void (async () => {
      try {
        const { data } = await getPlantDetail({ plantId }, { signal: controller.signal });
        const fetchedSpecies = data.plant.species_name;
        if (fetchedSpecies) {
          setSpeciesName((prev) => prev ?? fetchedSpecies);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        logger.warn("Failed to hydrate species name for watering plan view", { error, plantId });
      } finally {
        if (!controller.signal.aborted) {
          setIsHydratingSpecies(false);
          if (speciesHydrationController.current === controller) {
            speciesHydrationController.current = null;
          }
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [plantId, speciesName]);

  useEffect(() => {
    if (!plantId) return;
    if (!speciesName) return;
    saveWateringPlanContext(plantId, { speciesName });
  }, [plantId, speciesName]);

  useEffect(() => {
    if (!aiEnabled || currentMode !== "suggest" || !speciesName) {
      quotaControllerRef.current?.abort();
      quotaControllerRef.current = null;
      if (quotaCheckpoint !== "idle") {
        setQuotaCheckpoint("idle");
      }
      setPrecheckedRateLimit(null);
      setPrecheckedQuota(null);
      return;
    }

    if (suggestionState.status !== "idle" || precheckedRateLimit) {
      if (quotaCheckpoint !== "ready") {
        setQuotaCheckpoint("ready");
      }
      return;
    }

    if (quotaCheckpoint !== "idle") return;

    const controller = new AbortController();
    quotaControllerRef.current = controller;
    setQuotaCheckpoint("checking");

    void (async () => {
      try {
        const quota = await fetchAiQuota({ signal: controller.signal });
        setPrecheckedQuota(quota);
        if (quota.is_rate_limited) {
          setPrecheckedRateLimit({
            status: "rate_limited",
            unlockAt: quota.unlock_at,
            aiRequestId: null,
          });
        } else {
          setPrecheckedRateLimit(null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        logger.warn("Failed to pre-check AI quota", { error });
        setPrecheckedRateLimit(null);
        setPrecheckedQuota(null);
      } finally {
        if (!controller.signal.aborted) {
          setQuotaCheckpoint("ready");
          if (quotaControllerRef.current === controller) {
            quotaControllerRef.current = null;
          }
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [aiEnabled, currentMode, precheckedRateLimit, quotaCheckpoint, speciesName, suggestionState.status]);

  useEffect(() => {
    if (!aiEnabled) return;
    if (currentMode !== "suggest") return;
    if (!speciesName) return;
    if (suggestionState.status !== "idle") return;
    if (precheckedRateLimit) return;
    if (quotaCheckpoint !== "ready") return;
    run();
  }, [aiEnabled, currentMode, precheckedRateLimit, quotaCheckpoint, run, speciesName, suggestionState.status]);

  useEffect(() => {
    if (!plantId) return;
    if (suggestionState.status !== "available") return;
    const suggestionForCache: WateringSuggestionForCreationDto = {
      status: "available",
      ai_request_id: suggestionState.aiRequestId,
      interval_days: suggestionState.intervalDays,
      horizon_days: suggestionState.horizonDays,
      schedule_basis: suggestionState.scheduleBasis,
      start_from: suggestionState.startFrom,
      custom_start_on: suggestionState.customStartOn ?? null,
      overdue_policy: suggestionState.overduePolicy,
      explanation: suggestionState.explanation,
    };
    saveWateringPlanContext(plantId, {
      speciesName: speciesName ?? null,
      suggestion: suggestionForCache,
    });
  }, [plantId, speciesName, suggestionState]);

  const manualSkippedState = useMemo(() => buildManualOnlyState(), []);
  const suggestionForDisplay: AiSuggestionStateVm = aiEnabled ? suggestionState : manualSkippedState;

  const redirectAfterSave = useCallback(async () => {
    if (typeof window === "undefined") return;
    const todayIso = getTodayIsoDate();
    try {
      const { data } = await getCalendarDay({ date: todayIso, status: "pending" });
      if (data.items.length > 0) {
        window.location.assign(`/calendar/day/${todayIso}`);
        return;
      }
    } catch (error) {
      logger.warn("calendar day lookup failed", error);
    }

    try {
      const monthParam = todayIso.slice(0, 7);
      const { data } = await getCalendarMonth({ month: monthParam, status: "pending" });
      const nextDay = data.days.find((day) => day.count > 0);
      if (nextDay) {
        window.location.assign(`/calendar/day/${nextDay.date}`);
        return;
      }
    } catch (error) {
      logger.warn("calendar month lookup failed", error);
    }

    window.location.assign("/calendar");
  }, []);

  const handlePlanSaved = useCallback(async () => {
    setIsRedirecting(true);
    try {
      await redirectAfterSave();
    } finally {
      setIsRedirecting(false);
    }
  }, [redirectAfterSave]);

  const resetQuotaCheckpoint = useCallback(() => {
    quotaControllerRef.current?.abort();
    quotaControllerRef.current = null;
    setQuotaCheckpoint("idle");
    setPrecheckedRateLimit(null);
    setPrecheckedQuota(null);
  }, []);

  const startManualFlow = useCallback(
    (initial?: WateringPlanFormValues) => {
      setEditorMode("manual");
      setEditorInitialValues(initial ?? buildDefaultFormValues());
      setEditorSource({ type: "manual" });
      setCurrentMode("edit");
      setAiEnabled(false);
      resetQuotaCheckpoint();
      clearError();
    },
    [clearError, resetQuotaCheckpoint]
  );

  const handleManual = useCallback(() => {
    if (isBusy) return;
    startManualFlow();
  }, [isBusy, startManualFlow]);

  const handleRejectToManual = useCallback(() => {
    if (isBusy) return;
    startManualFlow();
  }, [isBusy, startManualFlow]);

  const handleEditSuggestion = useCallback(
    (suggestion: AiSuggestionAvailableVm) => {
      if (isBusy) return;
      setEditorMode("ai_edit");
      setEditorInitialValues(formValuesFromSuggestion(suggestion));
      setEditorSource({
        type: "ai",
        aiRequestId: suggestion.aiRequestId,
        acceptedWithoutChanges: false,
      });
      setCurrentMode("edit");
      clearError();
    },
    [clearError, isBusy]
  );

  const handleBackFromEditor = useCallback(() => {
    if (isBusy) return;
    clearError();
    setCurrentMode("suggest");
  }, [clearError, isBusy]);

  const handleEditorSubmit = useCallback(
    async (values: WateringPlanFormValues) => {
      const command = sanitizeFormToSetCommand(values, editorSource);
      const result = await save(command);
      if (result) {
        await handlePlanSaved();
      }
    },
    [editorSource, handlePlanSaved, save]
  );

  const handleAcceptSuggestion = useCallback(async () => {
    if (isBusy) return;
    if (suggestionState.status !== "available") return;
    const command = sanitizeFormToSetCommand(formValuesFromSuggestion(suggestionState), {
      type: "ai",
      aiRequestId: suggestionState.aiRequestId,
      acceptedWithoutChanges: true,
    });
    const result = await save(command);
    if (result) {
      await handlePlanSaved();
    }
  }, [handlePlanSaved, isBusy, save, suggestionState]);

  const handleQuotaRetry = useCallback(() => {
    if (isBusy) return;
    resetQuotaCheckpoint();
  }, [isBusy, resetQuotaCheckpoint]);

  const handleRetrySuggest = useCallback(() => {
    if (isBusy) return;
    reset();
    resetQuotaCheckpoint();
  }, [isBusy, reset, resetQuotaCheckpoint]);

  const renderSuggestion = () => {
    if (currentMode === "edit") {
      return null;
    }

    if (isHydratingSpecies && !speciesName) {
      return (
        <FullScreenState
          title="Przygotowujemy dane rośliny…"
          description="Pobieramy gatunek rośliny, aby móc poprosić AI o plan."
        />
      );
    }

    if (isQuotaChecking && !precheckedRateLimit && suggestionState.status === "idle" && speciesName) {
      return (
        <FullScreenState
          title="Sprawdzamy limit AI…"
          description="Upewniamy się, że możesz wykorzystać sugestię AI, zanim wyślemy żądanie."
          action={
            <Button variant="ghost" onClick={handleManual} disabled={isBusy}>
              Ustaw ręcznie
            </Button>
          }
        />
      );
    }

    if (precheckedRateLimit) {
      return (
        <AiBlockedState
          status={precheckedRateLimit}
          variant="precheck"
          onManual={handleManual}
          onRetry={handleQuotaRetry}
          quota={precheckedQuota ?? undefined}
        />
      );
    }

    if (suggestionForDisplay.status === "loading" || suggestionForDisplay.status === "idle") {
      return (
        <FullScreenState
          title="Sugerowanie planu…"
          description="To może potrwać do 5 sekund."
          action={
            <Button variant="ghost" onClick={handleManual} disabled={isBusy}>
              Ustaw ręcznie
            </Button>
          }
        />
      );
    }

    if (suggestionForDisplay.status === "available") {
      return (
        <AiSuggestionCard
          suggestion={suggestionForDisplay}
          isSaving={isBusy}
          onAccept={handleAcceptSuggestion}
          onEdit={() => handleEditSuggestion(suggestionForDisplay)}
          onRejectToManual={handleRejectToManual}
        />
      );
    }

    if (suggestionForDisplay.status === "rate_limited") {
      return (
        <AiBlockedState
          status={suggestionForDisplay}
          onManual={handleManual}
          onRetry={handleRetrySuggest}
          quota={precheckedQuota ?? undefined}
        />
      );
    }

    if (
      suggestionForDisplay.status === "timeout" ||
      suggestionForDisplay.status === "provider_error" ||
      suggestionForDisplay.status === "unknown_error" ||
      suggestionForDisplay.status === "unauthenticated" ||
      suggestionForDisplay.status === "not_found"
    ) {
      return (
        <AiErrorState
          error={suggestionForDisplay}
          isRetrying={isSuggesting || isQuotaChecking}
          onRetry={handleRetrySuggest}
          onManual={handleManual}
        />
      );
    }

    if (suggestionForDisplay.status === "skipped") {
      return <AiSkippedState state={suggestionForDisplay} onManual={handleManual} />;
    }

    return null;
  };

  const displayedSpeciesName = speciesName ?? undefined;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6" aria-live="polite">
      <PlantWateringPlanHeader speciesName={displayedSpeciesName} />

      {renderSuggestion()}

      {currentMode === "edit" ? (
        <WateringPlanEditor
          mode={editorMode}
          initialValues={editorInitialValues}
          isSaving={isBusy}
          saveError={saveError}
          onSubmit={handleEditorSubmit}
          onBack={handleBackFromEditor}
          onDismissError={clearError}
        />
      ) : null}
    </main>
  );
};

PlantWateringPlanView.displayName = "PlantWateringPlanView";
