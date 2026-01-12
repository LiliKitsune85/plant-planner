import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@/lib/logger";

import type { AiSuggestionStateVm } from "@/components/plants/watering-plan/types";
import {
  buildRateLimitedVm,
  buildSkippedState,
  buildSuggestionErrorVm,
  isValidWateringPlanPlantId,
  mapCreationSuggestionToState,
  mapSuggestionDtoToVm,
  normalizeSpeciesNameForSuggest,
} from "@/components/plants/watering-plan/view-model";
import { suggestWateringPlan, SuggestWateringPlanApiError } from "@/lib/services/watering-plans/suggest-client";
import type { WateringSuggestionForCreationDto } from "@/types";

interface UseWateringPlanSuggestionParams {
  plantId: string;
  speciesName?: string | null;
  enabled?: boolean;
  initialSuggestion?: WateringSuggestionForCreationDto | null;
}

interface UseWateringPlanSuggestionResult {
  state: AiSuggestionStateVm;
  requestId?: string;
  responseTimeBudgetMs?: number;
  isRunning: boolean;
  run: () => void;
  reset: () => void;
}

const DEFAULT_STATE: AiSuggestionStateVm = { status: "idle" };

const deriveInitialState = (suggestion?: WateringSuggestionForCreationDto | null): AiSuggestionStateVm => {
  if (!suggestion) return DEFAULT_STATE;
  return mapCreationSuggestionToState(suggestion);
};

export const useWateringPlanSuggestion = ({
  plantId,
  speciesName,
  enabled = true,
  initialSuggestion,
}: UseWateringPlanSuggestionParams): UseWateringPlanSuggestionResult => {
  const [state, setState] = useState<AiSuggestionStateVm>(() => deriveInitialState(initialSuggestion));
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [responseTimeBudgetMs, setResponseTimeBudgetMs] = useState<number | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const normalizedSpeciesName = useMemo(() => normalizeSpeciesNameForSuggest(speciesName), [speciesName]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(DEFAULT_STATE);
    setRequestId(undefined);
    setResponseTimeBudgetMs(undefined);
    setIsRunning(false);
  }, []);

  const run = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRequestId(undefined);
    setResponseTimeBudgetMs(undefined);

    if (!enabled) {
      setState(buildSkippedState("Sugestie AI są obecnie wyłączone. Ustaw plan ręcznie, aby kontynuować."));
      return;
    }

    if (!plantId || !isValidWateringPlanPlantId(plantId)) {
      setState(buildSkippedState("Niepoprawny identyfikator rośliny."));
      return;
    }

    if (!normalizedSpeciesName) {
      setState(buildSkippedState("Brakuje nazwy gatunku. Ustaw plan ręcznie."));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setState({ status: "loading" });

    const command = {
      context: { species_name: normalizedSpeciesName },
    };

    void (async () => {
      try {
        const {
          data,
          requestId: reqId,
          responseTimeBudgetMs: budget,
        } = await suggestWateringPlan(plantId, command, { signal: controller.signal });
        const vm = mapSuggestionDtoToVm(data);
        setState(vm);
        setRequestId(reqId);
        setResponseTimeBudgetMs(budget);
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (error instanceof SuggestWateringPlanApiError) {
          if (error.kind === "rate_limited") {
            setState(buildRateLimitedVm(error));
          } else {
            setState(buildSuggestionErrorVm(error));
          }
          setRequestId(error.requestId);
          setResponseTimeBudgetMs(undefined);
          return;
        }

        logger.error("Unexpected error while requesting watering plan suggestion", error);
        setState(
          buildSuggestionErrorVm(
            new SuggestWateringPlanApiError("UNKNOWN_ERROR", "Nieznany błąd sugestii AI.", {
              kind: "unknown",
            })
          )
        );
        setRequestId(undefined);
        setResponseTimeBudgetMs(undefined);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsRunning(false);
      }
    })();
  }, [enabled, normalizedSpeciesName, plantId]);

  useEffect(() => {
    if (!initialSuggestion) return;
    setState(deriveInitialState(initialSuggestion));
  }, [initialSuggestion]);

  return {
    state,
    requestId,
    responseTimeBudgetMs,
    isRunning,
    run,
    reset,
  };
};

useWateringPlanSuggestion.displayName = "useWateringPlanSuggestion";
