import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@/lib/logger";

import type { PlantListItemDto } from "@/types";
import { listPlants, PlantsApiError } from "@/lib/services/plants/plants-client";

interface UsePlantSearchOptions {
  limit?: number;
  debounceMs?: number;
  minQueryLength?: number;
}

interface UsePlantSearchResult {
  query: string;
  setQuery: (value: string) => void;
  results: PlantListItemDto[];
  isLoading: boolean;
  error?: string;
  clear: () => void;
  refetch: () => void;
}

export const usePlantSearch = ({
  limit = 5,
  debounceMs = 400,
  minQueryLength = 2,
}: UsePlantSearchOptions = {}): UsePlantSearchResult => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlantListItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const abortController = useRef<AbortController | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const executeSearch = useCallback(
    async (searchQuery: string) => {
      const normalizedQuery = searchQuery.trim();
      if (normalizedQuery.length < minQueryLength) {
        abortController.current?.abort();
        setResults([]);
        setIsLoading(false);
        setError(undefined);
        return;
      }

      abortController.current?.abort();

      const controller = new AbortController();
      abortController.current = controller;

      setIsLoading(true);
      setError(undefined);

      try {
        const { data } = await listPlants({ q: normalizedQuery, limit }, { signal: controller.signal });
        setResults(data.items);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof PlantsApiError) {
          setError(err.message);
        } else {
          logger.error("Plant search failed", err);
          setError("Nie udało się pobrać listy roślin.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [limit, minQueryLength]
  );

  const scheduleSearch = useCallback(
    (value: string) => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(() => {
        void executeSearch(value);
      }, debounceMs);
    },
    [debounceMs, executeSearch]
  );

  useEffect(() => {
    scheduleSearch(query);
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      abortController.current?.abort();
    };
  }, [query, scheduleSearch]);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(undefined);
  }, []);

  const refetch = useCallback(() => {
    void executeSearch(query);
  }, [executeSearch, query]);

  return useMemo(
    () => ({
      query,
      setQuery,
      results,
      isLoading,
      error,
      clear,
      refetch,
    }),
    [clear, error, isLoading, query, refetch, results]
  );
};

usePlantSearch.displayName = "usePlantSearch";
