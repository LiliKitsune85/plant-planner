import { useCallback, useEffect, useState } from "react";

import { usePlantsList } from "@/components/hooks/use-plants-list";
import { PlantsListControls } from "@/components/plants/list/PlantsListControls";
import { PlantsEmptyState } from "@/components/plants/list/PlantsEmptyState";
import { PlantsErrorState } from "@/components/plants/list/PlantsErrorState";
import { PlantsList } from "@/components/plants/list/PlantsList";
import { PlantsListHeader } from "@/components/plants/list/PlantsListHeader";
import { PlantsListSkeleton } from "@/components/plants/list/PlantsListSkeleton";
import { PlantsLoadMore } from "@/components/plants/list/PlantsLoadMore";
import { PlantsListFlashBanner } from "@/components/plants/list/PlantsListFlashBanner";
import {
  buildPlantsListHref,
  PLANTS_LIST_DEFAULT_LIMIT,
  PLANTS_LIST_DEFAULT_ORDER,
  PLANTS_LIST_DEFAULT_SORT,
  type PlantsListQueryState,
} from "@/lib/services/plants/list-view-model";
import { consumePlantsFlashMessage, type PlantsFlashMessage } from "@/lib/services/plants/delete-flash";

export interface PlantsListViewProps {
  initialQuery: PlantsListQueryState;
}

export const PlantsListView = ({ initialQuery }: PlantsListViewProps) => {
  const [flashMessage, setFlashMessage] = useState<PlantsFlashMessage | null>(null);
  const {
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
  } = usePlantsList({ initialQuery });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const message = consumePlantsFlashMessage();
    if (message) {
      setFlashMessage(message);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextRelative = buildPlantsListHref(query);
    const currentRelative = `${window.location.pathname}${window.location.search}`;
    if (currentRelative !== nextRelative) {
      window.history.replaceState(null, "", nextRelative);
    }
  }, [query]);

  const handleSearchCommit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setQuery({
          q: undefined,
        });
        return;
      }
      setQuery({ q: trimmed });
    },
    [setQuery]
  );

  const handleSortChange = useCallback(
    (sort: PlantsListQueryState["sort"]) => {
      setQuery({ sort });
    },
    [setQuery]
  );

  const handleOrderChange = useCallback(
    (order: PlantsListQueryState["order"]) => {
      setQuery({ order });
    },
    [setQuery]
  );

  const handleSpeciesCommit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      setQuery({ species: trimmed || undefined });
    },
    [setQuery]
  );

  const handleLimitChange = useCallback(
    (limit: number) => {
      setQuery({ limit });
    },
    [setQuery]
  );

  const handleClearFilters = useCallback(() => {
    setQuery({
      q: undefined,
      species: undefined,
      sort: PLANTS_LIST_DEFAULT_SORT,
      order: PLANTS_LIST_DEFAULT_ORDER,
      limit: PLANTS_LIST_DEFAULT_LIMIT,
    });
  }, [setQuery]);

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  const loginHref = `/auth/login?returnTo=${encodeURIComponent(buildPlantsListHref(query))}`;

  const controlsPending = status === "loading" && !hasAnyItems;
  const handleDismissFlash = useCallback(() => setFlashMessage(null), []);

  let content = null;

  const emptyFilterLabel = query.q ?? query.species ?? undefined;

  if (status === "error" && error) {
    content = <PlantsErrorState error={error} onRetry={reload} loginHref={loginHref} resetHref="/plants" />;
  } else if (status === "loading" && !hasAnyItems) {
    content = <PlantsListSkeleton />;
  } else if (!hasAnyItems) {
    content = (
      <PlantsEmptyState
        query={emptyFilterLabel}
        onClearFilters={isFiltered ? handleClearFilters : undefined}
        ctaHref="/plants/new"
      />
    );
  } else {
    content = (
      <div className="space-y-6">
        <PlantsList items={items} />
        <PlantsLoadMore
          canLoadMore={Boolean(nextCursor)}
          pending={isLoadingMore}
          errorMessage={loadMoreError?.message}
          onLoadMore={handleLoadMore}
        />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6" aria-live="polite">
      {flashMessage ? <PlantsListFlashBanner message={flashMessage} onDismiss={handleDismissFlash} /> : null}
      <PlantsListHeader />
      <PlantsListControls
        searchValue={query.q ?? ""}
        speciesValue={query.species ?? ""}
        sort={query.sort}
        order={query.order}
        limit={query.limit}
        pending={controlsPending}
        showReset={isFiltered}
        onSearchCommit={handleSearchCommit}
        onSpeciesCommit={handleSpeciesCommit}
        onSortChange={handleSortChange}
        onOrderChange={handleOrderChange}
        onLimitChange={handleLimitChange}
        onReset={handleClearFilters}
      />
      {content}
      {status === "loading" && hasAnyItems && (
        <p className="text-sm text-muted-foreground" role="status">
          Trwa odświeżanie listy…
        </p>
      )}
      {status === "error" && !error && (
        <p className="text-sm text-destructive">Nieznany błąd podczas wczytywania listy.</p>
      )}
      {status !== "error" && requestId && <p className="text-xs text-muted-foreground">ID żądania: {requestId}</p>}
    </main>
  );
};

PlantsListView.displayName = "PlantsListView";
