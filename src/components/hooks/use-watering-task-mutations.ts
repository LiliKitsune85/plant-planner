import { useCallback, useMemo, useRef, useState } from "react";

import type { CalendarDayTaskVm } from "@/lib/services/calendar/day-view-model";
import type { AdhocWateringCommand, UpdateWateringTaskCommand } from "@/types";
import { createAdhocWateringEntry } from "@/lib/services/watering-tasks/adhoc-client";
import {
  deleteWateringTask,
  updateWateringTask,
  WateringTaskApiError,
  type WateringTaskApiErrorKind,
} from "@/lib/services/watering-tasks/watering-task-client";
import { invalidateCalendarDayCacheByDate } from "./use-calendar-day";
import { invalidateCalendarMonthCacheByMonth } from "./use-calendar-month";

type MutationErrorKind = WateringTaskApiErrorKind | "unknown";

export interface WateringTaskMutationError {
  kind: MutationErrorKind;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  details?: unknown;
  taskId?: string;
  plantId?: string;
}

interface UseWateringTaskMutationsParams {
  date: string;
  onReload?: () => void;
}

type PendingMap = Record<string, boolean>;
type OptimisticMap = Record<string, CalendarDayTaskVm>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const collectInvalidationDates = (baseDate: string, ...candidates: (string | null | undefined)[]): string[] => {
  const dates = new Set<string>();
  if (ISO_DATE_PATTERN.test(baseDate)) {
    dates.add(baseDate);
  }
  for (const candidate of candidates) {
    if (typeof candidate === "string" && ISO_DATE_PATTERN.test(candidate)) {
      dates.add(candidate);
    }
  }
  return Array.from(dates);
};

const extractFieldErrors = (details: unknown): Record<string, string[]> | undefined => {
  if (!details || typeof details !== "object") return undefined;
  const issues = (details as { issues?: unknown }).issues;

  if (!Array.isArray(issues)) return undefined;
  const result: Record<string, string[]> = {};
  for (const issue of issues) {
    if (!issue || typeof issue !== "object") continue;
    const path = Array.isArray((issue as { path?: unknown }).path) ? ((issue as { path?: string[] }).path ?? []) : [];
    const key = path.join(".") || (issue as { path?: string }).path || "form";
    const message = (issue as { message?: string }).message;
    if (!message) continue;
    if (!result[key]) {
      result[key] = [];
    }
    result[key]?.push(message);
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

const extractPlantIdFromDetails = (details: unknown): string | undefined => {
  if (!details || typeof details !== "object") return undefined;
  const value = (details as { plant_id?: unknown }).plant_id;
  return typeof value === "string" ? value : undefined;
};

const mapApiError = (
  error: unknown,
  overrides?: Pick<WateringTaskMutationError, "taskId" | "plantId">
): WateringTaskMutationError => {
  if (error instanceof WateringTaskApiError) {
    const detailPlantId = extractPlantIdFromDetails(error.details);
    const mapped: WateringTaskMutationError = {
      kind: error.kind,
      message: error.message,
      code: error.code,
      details: error.details,
      fieldErrors: error.kind === "validation" ? extractFieldErrors(error.details) : undefined,
      ...overrides,
    };
    if (!mapped.plantId && detailPlantId) {
      mapped.plantId = detailPlantId;
    }
    return mapped;
  }

  return {
    kind: "unknown",
    message: error instanceof Error ? error.message : "Unknown error",
    ...overrides,
  };
};

const markTaskCompleted = (task: CalendarDayTaskVm, completedOn: string): CalendarDayTaskVm => ({
  ...task,
  status: "completed",
  completedOn,
});

const markTaskPending = (task: CalendarDayTaskVm): CalendarDayTaskVm => ({
  ...task,
  status: "pending",
  completedOn: null,
});

const clearMonthCachesForDate = (date: string): void => {
  const month = date.slice(0, 7);
  invalidateCalendarMonthCacheByMonth(month);
};

export const useWateringTaskMutations = ({ date, onReload }: UseWateringTaskMutationsParams) => {
  const [pendingByTaskId, setPendingByTaskId] = useState<PendingMap>({});
  const [globalPending, setGlobalPending] = useState(false);
  const [optimisticTasks, setOptimisticTasks] = useState<OptimisticMap>({});
  const [error, setError] = useState<WateringTaskMutationError | null>(null);

  const optimisticSnapshots = useRef(new Map<string, CalendarDayTaskVm>());

  const omitKey = useCallback(<TMap extends Record<string, unknown>>(source: TMap, key: string): TMap => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) return source;
    return Object.fromEntries(Object.entries(source).filter(([entryKey]) => entryKey !== key)) as TMap;
  }, []);

  const setTaskPending = useCallback(
    (taskId: string, isPending: boolean) => {
      setPendingByTaskId((prev) => {
        if (isPending) {
          if (prev[taskId]) return prev;
          return { ...prev, [taskId]: true };
        }

        if (!prev[taskId]) return prev;
        return omitKey(prev as Record<string, unknown>, taskId) as PendingMap;
      });
    },
    [omitKey]
  );

  const applyOptimisticTask = useCallback(
    (taskId: string, nextTask: CalendarDayTaskVm, original: CalendarDayTaskVm) => {
      optimisticSnapshots.current.set(taskId, original);
      setOptimisticTasks((prev) => ({ ...prev, [taskId]: nextTask }));
    },
    []
  );

  const rollbackOptimisticTask = useCallback(
    (taskId: string) => {
      setOptimisticTasks((prev) => {
        if (!prev[taskId]) return prev;
        return omitKey(prev as Record<string, unknown>, taskId) as OptimisticMap;
      });
      optimisticSnapshots.current.delete(taskId);
    },
    [omitKey]
  );

  const clearOptimisticTask = useCallback(
    (taskId: string) => {
      setOptimisticTasks((prev) => {
        if (!prev[taskId]) return prev;
        return omitKey(prev as Record<string, unknown>, taskId) as OptimisticMap;
      });
      optimisticSnapshots.current.delete(taskId);
    },
    [omitKey]
  );

  const acknowledgeServerState = useCallback((tasks: CalendarDayTaskVm[] = []) => {
    if (tasks.length === 0) return;

    setOptimisticTasks((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const idsToClear = new Set(tasks.map((task) => task.id));
      const next = Object.fromEntries(
        Object.entries(prev).filter(([taskId]) => !idsToClear.has(taskId))
      ) as OptimisticMap;
      for (const task of tasks) {
        optimisticSnapshots.current.delete(task.id);
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, []);

  const invalidateCachesForDates = useCallback((dates: string[]) => {
    dates.forEach((targetDate) => {
      invalidateCalendarDayCacheByDate(targetDate);
      clearMonthCachesForDate(targetDate);
    });
  }, []);

  const invalidateCachesAndReload = useCallback(
    (dates: string[] = [date]) => {
      invalidateCachesForDates(dates);
      onReload?.();
    },
    [date, invalidateCachesForDates, onReload]
  );

  const runTaskMutation = useCallback(
    async (
      task: CalendarDayTaskVm,
      executor: () => Promise<unknown>,
      options?: {
        optimistic?: CalendarDayTaskVm;
        rollbackOnError?: boolean;
      }
    ) => {
      const optimistic = options?.optimistic;
      const rollbackOnError = options?.rollbackOnError ?? true;

      setError(null);
      setTaskPending(task.id, true);

      if (optimistic) {
        applyOptimisticTask(task.id, optimistic, task);
      }

      try {
        await executor();
        invalidateCachesAndReload();
      } catch (err) {
        if (optimistic && rollbackOnError) {
          rollbackOptimisticTask(task.id);
        }
        setError(mapApiError(err, { taskId: task.id }));
        throw err;
      } finally {
        setTaskPending(task.id, false);
      }
    },
    [applyOptimisticTask, invalidateCachesAndReload, rollbackOptimisticTask, setTaskPending]
  );

  const confirmTask = useCallback(
    async (task: CalendarDayTaskVm) => {
      if (pendingByTaskId[task.id] || task.status !== "pending") return;

      const optimisticTask = markTaskCompleted(task, date);

      await runTaskMutation(
        task,
        async () => {
          await updateWateringTask(task.id, {
            status: "completed",
            completed_on: date,
          });
        },
        { optimistic: optimisticTask }
      );
    },
    [date, pendingByTaskId, runTaskMutation]
  );

  const undoTask = useCallback(
    async (task: CalendarDayTaskVm) => {
      if (pendingByTaskId[task.id] || task.status !== "completed" || !task.isScheduled) {
        return;
      }

      const optimisticTask = markTaskPending(task);

      await runTaskMutation(
        task,
        async () => {
          await updateWateringTask(task.id, {
            status: "pending",
          });
        },
        { optimistic: optimisticTask }
      );
    },
    [pendingByTaskId, runTaskMutation]
  );

  const editTask = useCallback(
    async (task: CalendarDayTaskVm, command: UpdateWateringTaskCommand) => {
      setError(null);
      setTaskPending(task.id, true);
      try {
        await updateWateringTask(task.id, command);
        const datesToInvalidate = collectInvalidationDates(
          date,
          task.completedOn ?? null,
          command.completed_on ?? null
        );
        invalidateCachesAndReload(datesToInvalidate);
      } catch (err) {
        setError(mapApiError(err, { taskId: task.id }));
        throw err;
      } finally {
        setTaskPending(task.id, false);
      }
    },
    [date, invalidateCachesAndReload, setTaskPending]
  );

  const deleteTaskMutation = useCallback(
    async (task: CalendarDayTaskVm) => {
      setError(null);
      setTaskPending(task.id, true);
      try {
        await deleteWateringTask(task.id);
        invalidateCachesAndReload();
      } catch (err) {
        setError(mapApiError(err, { taskId: task.id }));
        throw err;
      } finally {
        setTaskPending(task.id, false);
      }
    },
    [invalidateCachesAndReload, setTaskPending]
  );

  const createAdhocMutation = useCallback(
    async (plantId: string, command: AdhocWateringCommand) => {
      setError(null);
      setGlobalPending(true);
      try {
        await createAdhocWateringEntry(plantId, command);
        const datesToInvalidate = collectInvalidationDates(date, command.completed_on ?? null);
        invalidateCachesAndReload(datesToInvalidate);
      } catch (err) {
        setError(mapApiError(err, { plantId }));
        throw err;
      } finally {
        setGlobalPending(false);
      }
    },
    [date, invalidateCachesAndReload]
  );

  const clearError = useCallback(() => setError(null), []);

  const optimisticItems = useMemo(() => optimisticTasks, [optimisticTasks]);
  const pendingTaskMap = useMemo(() => pendingByTaskId, [pendingByTaskId]);

  return {
    pendingByTaskId: pendingTaskMap,
    globalPending,
    optimisticTasks: optimisticItems,
    error,
    confirmTask,
    undoTask,
    editTask,
    deleteTask: deleteTaskMutation,
    createAdhoc: createAdhocMutation,
    clearError,
    acknowledgeServerState,
    clearOptimisticTask,
  };
};

useWateringTaskMutations.displayName = "useWateringTaskMutations";
