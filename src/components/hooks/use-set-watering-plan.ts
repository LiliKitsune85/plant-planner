import { useCallback, useState } from "react";
import { logger } from "@/lib/logger";

import type { SetPlanErrorVm } from "@/components/plants/watering-plan/types";
import { buildSetPlanErrorVm, buildUnknownSetPlanError } from "@/components/plants/watering-plan/view-model";
import { setWateringPlan, SetWateringPlanApiError } from "@/lib/services/watering-plans/set-plan-client";
import type { SetWateringPlanCommand, SetWateringPlanResultDto } from "@/types";

interface UseSetWateringPlanParams {
  plantId: string;
}

interface UseSetWateringPlanResult {
  isSaving: boolean;
  error: SetPlanErrorVm | null;
  lastResult?: SetWateringPlanResultDto;
  requestId?: string;
  save: (command: SetWateringPlanCommand) => Promise<SetWateringPlanResultDto | null>;
  clearError: () => void;
}

export const useSetWateringPlan = ({ plantId }: UseSetWateringPlanParams): UseSetWateringPlanResult => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<SetPlanErrorVm | null>(null);
  const [lastResult, setLastResult] = useState<SetWateringPlanResultDto | undefined>(undefined);
  const [requestId, setRequestId] = useState<string | undefined>(undefined);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const save = useCallback(
    async (command: SetWateringPlanCommand) => {
      setIsSaving(true);
      setError(null);
      setRequestId(undefined);

      try {
        const { data, requestId: reqId } = await setWateringPlan(plantId, command);
        setLastResult(data);
        setRequestId(reqId);
        return data;
      } catch (err) {
        if (err instanceof SetWateringPlanApiError) {
          const mapped = buildSetPlanErrorVm(err);
          setError(mapped);
          setRequestId(err.requestId);
        } else {
          logger.error("Unexpected error while saving watering plan", err);
          setError(buildUnknownSetPlanError());
        }
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [plantId]
  );

  return {
    isSaving,
    error,
    lastResult,
    requestId,
    save,
    clearError,
  };
};

useSetWateringPlan.displayName = "useSetWateringPlan";
