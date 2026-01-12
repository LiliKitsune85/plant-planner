import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

import type { PlantDetailMutationErrorVm } from "@/components/plants/detail/types";
import {
  buildPlantDetailMutationErrorFromPlantsApi,
  buildPlantDetailMutationErrorFromWateringApi,
  buildPlantDetailMutationUnknownError,
  clampWateringNote,
  getTodayIsoDate,
} from "@/lib/services/plants/detail-view-model";
import { deletePlant as deletePlantApi, PlantsApiError } from "@/lib/services/plants/plants-client";
import { createAdhocWateringEntry } from "@/lib/services/watering-tasks/adhoc-client";
import { WateringTaskApiError } from "@/lib/services/watering-tasks/watering-task-client";
import type { DeletePlantResultDto } from "@/types";

import { invalidateCalendarDayCacheByDate } from "./use-calendar-day";
import { invalidateCalendarMonthCacheByMonth } from "./use-calendar-month";
import { invalidatePlantDetailCacheById } from "./use-plant-detail";

interface MutationSuccess<TData = void> {
  ok: true;
  data?: TData;
}
interface MutationAborted {
  ok: false;
  kind: "aborted";
}
interface MutationFailure {
  ok: false;
  kind: "error";
  error: PlantDetailMutationErrorVm;
}

export type PlantDetailMutationResult<TData = void> = MutationSuccess<TData> | MutationAborted | MutationFailure;

interface UsePlantDetailMutationsParams {
  plantId: string;
}

export interface UsePlantDetailMutationsResult {
  pendingWaterToday: boolean;
  pendingDelete: boolean;
  waterError: PlantDetailMutationErrorVm | null;
  deleteError: PlantDetailMutationErrorVm | null;
  waterToday: (note?: string | null) => Promise<PlantDetailMutationResult>;
  deletePlant: () => Promise<PlantDetailMutationResult<DeletePlantResultDto>>;
  clearWaterError: () => void;
  clearDeleteError: () => void;
  cancelWaterToday: () => void;
  cancelDelete: () => void;
}

const extractMonthFromDate = (date: string): string => date.slice(0, 7);

export const usePlantDetailMutations = ({ plantId }: UsePlantDetailMutationsParams): UsePlantDetailMutationsResult => {
  const [pendingWaterToday, setPendingWaterToday] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [waterError, setWaterError] = useState<PlantDetailMutationErrorVm | null>(null);
  const [deleteError, setDeleteError] = useState<PlantDetailMutationErrorVm | null>(null);

  const waterControllerRef = useRef<AbortController | null>(null);
  const deleteControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      waterControllerRef.current?.abort();
      deleteControllerRef.current?.abort();
    },
    []
  );

  const clearWaterError = useCallback(() => setWaterError(null), []);
  const clearDeleteError = useCallback(() => setDeleteError(null), []);

  const cancelWaterToday = useCallback(() => {
    waterControllerRef.current?.abort();
  }, []);

  const cancelDelete = useCallback(() => {
    deleteControllerRef.current?.abort();
  }, []);

  const waterToday = useCallback(
    async (note?: string | null): Promise<PlantDetailMutationResult> => {
      waterControllerRef.current?.abort();
      const controller = new AbortController();
      waterControllerRef.current = controller;

      setPendingWaterToday(true);
      setWaterError(null);

      const completedOn = getTodayIsoDate();
      const normalizedNote = clampWateringNote(note);

      try {
        await createAdhocWateringEntry(
          plantId,
          { completed_on: completedOn, note: normalizedNote },
          { signal: controller.signal }
        );

        invalidateCalendarDayCacheByDate(completedOn);
        invalidateCalendarMonthCacheByMonth(extractMonthFromDate(completedOn));
        invalidatePlantDetailCacheById(plantId);

        return { ok: true };
      } catch (err) {
        if (controller.signal.aborted) {
          return { ok: false, kind: "aborted" };
        }

        let mutationError: PlantDetailMutationErrorVm;
        if (err instanceof WateringTaskApiError) {
          mutationError = buildPlantDetailMutationErrorFromWateringApi(err);
        } else if (err instanceof PlantsApiError) {
          mutationError = buildPlantDetailMutationErrorFromPlantsApi(err);
        } else {
          logger.error("Unexpected error while creating adhoc watering entry", err);
          mutationError = buildPlantDetailMutationUnknownError();
        }

        setWaterError(mutationError);
        return { ok: false, kind: "error", error: mutationError };
      } finally {
        setPendingWaterToday(false);
      }
    },
    [plantId]
  );

  const deletePlant = useCallback(async (): Promise<PlantDetailMutationResult<DeletePlantResultDto>> => {
    deleteControllerRef.current?.abort();
    const controller = new AbortController();
    deleteControllerRef.current = controller;

    setPendingDelete(true);
    setDeleteError(null);

    try {
      const { data } = await deletePlantApi(plantId, { signal: controller.signal });
      invalidatePlantDetailCacheById(plantId);
      return { ok: true, data };
    } catch (err) {
      if (controller.signal.aborted) {
        return { ok: false, kind: "aborted" };
      }

      let mutationError: PlantDetailMutationErrorVm;
      if (err instanceof PlantsApiError) {
        mutationError = buildPlantDetailMutationErrorFromPlantsApi(err);
      } else {
        logger.error("Unexpected error while deleting plant", err);
        mutationError = buildPlantDetailMutationUnknownError();
      }

      setDeleteError(mutationError);
      return { ok: false, kind: "error", error: mutationError };
    } finally {
      setPendingDelete(false);
    }
  }, [plantId]);

  return {
    pendingWaterToday,
    pendingDelete,
    waterError,
    deleteError,
    waterToday,
    deletePlant,
    clearWaterError,
    clearDeleteError,
    cancelWaterToday,
    cancelDelete,
  };
};

usePlantDetailMutations.displayName = "usePlantDetailMutations";
