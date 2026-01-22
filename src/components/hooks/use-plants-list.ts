import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

import {
  arePlantsListQueriesEqual,
  buildPlantsListErrorVmFromApiError,
  buildUnknownPlantsListErrorVm,
  getPlantsListCacheKey,
  mapPlantListItemDtoToVm,
  normalizePlantsListQueryState,
  type PlantListItemVm,
  type PlantsListErrorVm,
  type PlantsListQueryState,
} from "@/lib/services/plants/list-view-model";
import { listPlants, PlantsApiError } from "@/lib/services/plants/plants-client";

interface UsePlantsListOptions {
  initialQuery: PlantsListQueryState;
}

type PlantsListStatus = "idle" | "loading" | "success" | "error";

interface PlantsListCacheEntry {
  items: PlantListItemVm[];
  nextCursor: string | null;
  requestId?: string;
}

const plantsListCache = new Map<string, PlantsListCacheEntry>();

export const clearPlantsListCache = (): void => {
  plantsListCache.clear();
};

export interface UsePlantsListResult {
  status: PlantsListStatus;
  query: PlantsListQueryState;
  items: PlantListItemVm[];
  nextCursor: string | null;
  error?: PlantsListErrorVm;
  loadMoreError?: PlantsListErrorVm;
  requestId?: string;
  isLoadingMore: boolean;
  hasAnyItems: boolean;
  isFiltered: boolean;
  setQuery: (partial: Partial<PlantsListQueryState>) => void;
  loadMore: () => Promise<void>;
  reload: () => void;
}

export const usePlantsList = ({ initialQuery }: UsePlantsListOptions): UsePlantsListResult => {
  const [query, setQueryState] = useState<PlantsListQueryState>(() => normalizePlantsListQueryState(initialQuery));
  const [status, setStatus] = useState<PlantsListStatus>("idle");
  const [items, setItems] = useState<PlantListItemVm[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<PlantsListErrorVm | undefined>(undefined);
  const [loadMoreError, setLoadMoreError] = useState<PlantsListErrorVm | undefined>(undefined);
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const initialFetchAbortRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      initialFetchAbortRef.current?.abort();
      loadMoreAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    initialFetchAbortRef.current?.abort();

    const controller = new AbortController();
    initialFetchAbortRef.current = controller;

    let isActive = true;
    const cacheKey = getPlantsListCacheKey(query);
    const cachedEntry = reloadToken === 0 ? plantsListCache.get(cacheKey) : undefined;

    setStatus("loading");
    setError(undefined);
    setLoadMoreError(undefined);

    if (cachedEntry) {
      setItems(cachedEntry.items);
      setNextCursor(cachedEntry.nextCursor);
      setRequestId(cachedEntry.requestId);
    } else {
      setItems([]);
      setNextCursor(null);
      setRequestId(undefined);
    }

    const fetchPlants = async () => {
      logger.info("usePlantsList: fetching list", { query, reloadToken, cacheKey, hasCache: Boolean(cachedEntry) });
      try {
        const {
          data,
          nextCursor: cursor,
          requestId: reqId,
        } = await listPlants(
          {
            q: query.q,
            species: query.species,
            sort: query.sort,
            order: query.order,
            limit: query.limit,
          },
          { signal: controller.signal }
        );

        if (!isActive) return;

        const mapped = data.items.map(mapPlantListItemDtoToVm);
        logger.info("usePlantsList: fetch success", {
          count: mapped.length,
          nextCursor: cursor,
          requestId: reqId,
        });
        setItems(mapped);
        setNextCursor(cursor);
        setRequestId(reqId);
        setStatus("success");
        plantsListCache.set(cacheKey, { items: mapped, nextCursor: cursor, requestId: reqId });
      } catch (err) {
        if (!isActive || controller.signal.aborted) return;

        if (err instanceof PlantsApiError) {
          logger.warn("usePlantsList: fetch failed", {
            code: err.code,
            status: err.status,
            requestId: err.requestId,
          });
          setError(buildPlantsListErrorVmFromApiError(err));
        } else {
          logger.error("Unexpected error in usePlantsList", err);
          setError(buildUnknownPlantsListErrorVm());
        }
        setStatus("error");
      }
    };

    void fetchPlants();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [query, reloadToken]);

  const setQuery = useCallback((partial: Partial<PlantsListQueryState>) => {
    setQueryState((prev) => {
      const merged: PlantsListQueryState = {
        ...prev,
        ...partial,
      };
      const normalized = normalizePlantsListQueryState(merged);
      if (arePlantsListQueriesEqual(prev, normalized)) {
        return prev;
      }
      return normalized;
    });
  }, []);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;

    loadMoreAbortRef.current?.abort();
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    setIsLoadingMore(true);
    setLoadMoreError(undefined);

    try {
      logger.info("usePlantsList: loading more", { nextCursor, query });
      const { data, nextCursor: cursor } = await listPlants(
        {
          q: query.q,
          species: query.species,
          sort: query.sort,
          order: query.order,
          limit: query.limit,
          cursor: nextCursor,
        },
        { signal: controller.signal }
      );

      if (controller.signal.aborted) return;

      const mapped = data.items.map(mapPlantListItemDtoToVm);
      logger.info("usePlantsList: load more success", { count: mapped.length, nextCursor: cursor });
      setItems((prev) => [...prev, ...mapped]);
      setNextCursor(cursor);
    } catch (err) {
      if (controller.signal.aborted) return;

      if (err instanceof PlantsApiError) {
        logger.warn("usePlantsList: load more failed", {
          code: err.code,
          status: err.status,
          requestId: err.requestId,
        });
        setLoadMoreError(buildPlantsListErrorVmFromApiError(err));
      } else {
        logger.error("Unexpected error while loading more plants", err);
        setLoadMoreError(buildUnknownPlantsListErrorVm("Nie udało się pobrać kolejnej strony roślin."));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore, nextCursor, query]);

  const hasAnyItems = items.length > 0;
  const isFiltered = Boolean((query.q && query.q.length > 0) || (query.species && query.species.length > 0));

  return {
    status,
    query,
    items,
    nextCursor,
    error,
    loadMoreError,
    requestId,
    isLoadingMore,
    hasAnyItems,
    isFiltered,
    setQuery,
    loadMore,
    reload,
  };
};

usePlantsList.displayName = "usePlantsList";
