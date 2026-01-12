import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

import type { DeletePlantMutationErrorVm } from "@/components/plants/delete/types";
import {
  buildUnknownDeletePlantMutationErrorVm,
  mapPlantsApiErrorToDeletePlantMutationErrorVm,
} from "@/lib/services/plants/delete-view-model";
import { deletePlant as deletePlantRequest, PlantsApiError } from "@/lib/services/plants/plants-client";
import type { DeletePlantResultDto } from "@/types";

import { invalidateCalendarDayCache } from "./use-calendar-day";
import { invalidateCalendarMonthCache } from "./use-calendar-month";
import { invalidatePlantDetailCacheById } from "./use-plant-detail";
import { invalidatePlantDeleteCacheById } from "./use-plant-delete";
import { clearPlantsListCache } from "./use-plants-list";

interface MutationSuccess {
  ok: true;
  data: DeletePlantResultDto;
  requestId?: string;
}
interface MutationAborted {
  ok: false;
  kind: "aborted";
}
interface MutationFailure {
  ok: false;
  kind: "error";
  error: DeletePlantMutationErrorVm;
}

export type DeletePlantMutationResult = MutationSuccess | MutationAborted | MutationFailure;

interface UseDeletePlantMutationParams {
  plantId: string;
}

export interface UseDeletePlantMutationResult {
  pending: boolean;
  error: DeletePlantMutationErrorVm | null;
  requestId?: string;
  deletePlant: () => Promise<DeletePlantMutationResult>;
  resetError: () => void;
  cancel: () => void;
}

export const useDeletePlantMutation = ({ plantId }: UseDeletePlantMutationParams): UseDeletePlantMutationResult => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<DeletePlantMutationErrorVm | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    []
  );

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const deletePlant = useCallback(async (): Promise<DeletePlantMutationResult> => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setPending(true);
    setError(null);

    try {
      const { data, requestId: reqId } = await deletePlantRequest(plantId, {
        signal: controller.signal,
      });

      setRequestId(reqId);
      invalidateCalendarDayCache();
      invalidateCalendarMonthCache();
      clearPlantsListCache();
      invalidatePlantDetailCacheById(plantId);
      invalidatePlantDeleteCacheById(plantId);

      return { ok: true, data, requestId: reqId };
    } catch (err) {
      if (controller.signal.aborted) {
        return { ok: false, kind: "aborted" };
      }

      let mutationError: DeletePlantMutationErrorVm;
      if (err instanceof PlantsApiError) {
        mutationError = mapPlantsApiErrorToDeletePlantMutationErrorVm(err);
      } else {
        logger.error("Unexpected error while deleting plant", err);
        mutationError = buildUnknownDeletePlantMutationErrorVm();
      }

      setError(mutationError);
      setRequestId(undefined);

      return { ok: false, kind: "error", error: mutationError };
    } finally {
      setPending(false);
    }
  }, [plantId]);

  return {
    pending,
    error,
    requestId,
    deletePlant,
    resetError,
    cancel,
  };
};

useDeletePlantMutation.displayName = "useDeletePlantMutation";
