import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@/lib/logger";

import type { PlantDeleteErrorVm, PlantDeleteVm } from "@/components/plants/delete/types";
import {
  buildInvalidPlantIdErrorVm,
  buildMissingPlantIdErrorVm,
  buildUnknownPlantDeleteErrorVm,
  isValidPlantId,
  mapPlantDetailDtoToPlantDeleteVm,
  mapPlantsApiErrorToPlantDeleteErrorVm,
} from "@/lib/services/plants/delete-view-model";
import { getPlantDetail, PlantsApiError } from "@/lib/services/plants/plants-client";

interface UsePlantDeleteParams {
  plantId: string;
}

type PlantDeleteStatus = "idle" | "loading" | "success" | "error";

export interface UsePlantDeleteResult {
  status: PlantDeleteStatus;
  data?: PlantDeleteVm;
  error?: PlantDeleteErrorVm;
  requestId?: string;
  reload: () => void;
}

const plantDeleteVmCache = new Map<string, PlantDeleteVm>();
const plantDeleteErrorCache = new Map<string, PlantDeleteErrorVm>();

export const invalidatePlantDeleteCacheById = (plantId: string): void => {
  plantDeleteVmCache.delete(plantId);
  plantDeleteErrorCache.delete(plantId);
};

export const usePlantDelete = ({ plantId }: UsePlantDeleteParams): UsePlantDeleteResult => {
  const [status, setStatus] = useState<PlantDeleteStatus>("idle");
  const [data, setData] = useState<PlantDeleteVm | undefined>(() =>
    plantId ? plantDeleteVmCache.get(plantId) : undefined
  );
  const [error, setError] = useState<PlantDeleteErrorVm | undefined>(() =>
    plantId ? plantDeleteErrorCache.get(plantId) : undefined
  );
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    if (!plantId) {
      const missingError = buildMissingPlantIdErrorVm();
      setStatus("error");
      setData(undefined);
      setError(missingError);
      setRequestId(undefined);
      return;
    }

    if (!isValidPlantId(plantId)) {
      const invalidError = buildInvalidPlantIdErrorVm();
      setStatus("error");
      setData(undefined);
      setError(invalidError);
      setRequestId(undefined);
      return;
    }

    const isInitialLoad = reloadToken === 0;
    const cachedVm = plantDeleteVmCache.get(plantId);
    const cachedError = plantDeleteErrorCache.get(plantId);

    if (isInitialLoad && cachedVm) {
      setStatus("success");
      setData(cachedVm);
      setError(undefined);
      setRequestId(undefined);
      return;
    }

    if (isInitialLoad && cachedError) {
      setStatus("error");
      setData(undefined);
      setError(cachedError);
      setRequestId(undefined);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (cachedVm) {
      setStatus("success");
      setData(cachedVm);
      setError(undefined);
    } else {
      setStatus("loading");
      setData(undefined);
      setError(undefined);
    }

    const fetchPlantDetail = async () => {
      try {
        const { data: dto, requestId: reqId } = await getPlantDetail({ plantId }, { signal: controller.signal });
        const vm = mapPlantDetailDtoToPlantDeleteVm(dto);

        plantDeleteVmCache.set(plantId, vm);
        plantDeleteErrorCache.delete(plantId);

        setStatus("success");
        setData(vm);
        setError(undefined);
        setRequestId(reqId);
      } catch (err) {
        if (controller.signal.aborted) return;

        let mappedError: PlantDeleteErrorVm;
        if (err instanceof PlantsApiError) {
          mappedError = mapPlantsApiErrorToPlantDeleteErrorVm(err);
        } else {
          logger.error("Unexpected error while loading plant delete view", err);
          mappedError = buildUnknownPlantDeleteErrorVm();
        }

        plantDeleteVmCache.delete(plantId);
        plantDeleteErrorCache.set(plantId, mappedError);

        setStatus("error");
        setData(undefined);
        setError(mappedError);
        setRequestId(undefined);
      }
    };

    void fetchPlantDetail();

    return () => {
      controller.abort();
    };
  }, [plantId, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return useMemo(
    () => ({
      status,
      data,
      error,
      requestId,
      reload,
    }),
    [status, data, error, requestId, reload]
  );
};

usePlantDelete.displayName = "usePlantDelete";
