import type { Tables } from "../../../db/database.types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "../../../db/supabase.client";
import type {
  ScheduleEffectDto,
  UpdateWateringTaskCommand,
  UpdateWateringTaskResultDto,
  WateringTaskSummaryFields,
} from "../../../types";
import { HttpError } from "../../http/errors";
import { loadActivePlanForPlant, regenerateTasksForPlan } from "./plan-regeneration";

type WateringTaskRow = Tables<"watering_tasks">;

interface ServiceContext {
  requestId?: string;
}

interface UpdateWateringTaskClients {
  supabaseUser: SupabaseClient;
  supabaseAdmin: SupabaseClient;
}

interface UpdateWateringTaskParams {
  userId: string;
  taskId: string;
  command: UpdateWateringTaskCommand;
  context?: ServiceContext;
}

type RegenerationReason = "TASK_COMPLETED" | "TASK_UNDONE" | "COMPLETION_DATE_CHANGED" | "ADHOC_COMPLETION_CHANGED";

const WATERING_TASK_COLUMNS = [
  "id",
  "plant_id",
  "plan_id",
  "due_on",
  "status",
  "source",
  "note",
  "completed_at",
  "completed_on",
].join(",");

const isPostgresError = (error: unknown, code: string): boolean =>
  Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === code);

const mapTaskToSummary = (row: WateringTaskRow): WateringTaskSummaryFields => ({
  id: row.id,
  due_on: row.due_on,
  status: row.status,
  source: row.source,
  note: row.note,
  completed_at: row.completed_at,
  completed_on: row.completed_on,
});

const loadTask = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
  taskId: string,
  context?: ServiceContext
): Promise<WateringTaskRow> => {
  const { data, error } = await supabaseAdmin
    .from("watering_tasks")
    .select<WateringTaskRow>(WATERING_TASK_COLUMNS)
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("updateWateringTask: task lookup failed", { error, userId, taskId, context });
    throw new HttpError(500, "Failed to load watering task", "TASK_LOOKUP_FAILED");
  }

  if (!data) {
    throw new HttpError(404, "Watering task not found", "WATERING_TASK_NOT_FOUND");
  }

  return data;
};

export const updateWateringTask = async (
  { supabaseUser, supabaseAdmin }: UpdateWateringTaskClients,
  { userId, taskId, command, context }: UpdateWateringTaskParams
): Promise<UpdateWateringTaskResultDto> => {
  const task = await loadTask(supabaseAdmin, userId, taskId, context);

  const nextStatus = command.status ?? task.status;
  const completedOnInput = command.completed_on;
  let nextCompletedOn = completedOnInput !== undefined ? completedOnInput : task.completed_on;

  if (task.source === "adhoc" && nextStatus !== "completed") {
    throw new HttpError(409, "Adhoc tasks must remain completed", "CONSTRAINT_VIOLATION");
  }

  if (completedOnInput !== undefined && nextStatus !== "completed") {
    throw new HttpError(422, "completed_on can only be provided for completed tasks", "VALIDATION_ERROR");
  }

  if (nextStatus === "pending") {
    nextCompletedOn = null;
  }

  if (nextStatus === "completed" && !nextCompletedOn) {
    throw new HttpError(422, "completed_on is required when status is completed", "VALIDATION_ERROR");
  }

  if (task.source === "scheduled" && !task.plan_id) {
    throw new HttpError(409, "Scheduled task is missing an associated plan", "CONSTRAINT_VIOLATION");
  }

  const statusChanged = task.status !== nextStatus;
  const completedOnChanged =
    nextStatus === "completed" && completedOnInput !== undefined && nextCompletedOn !== task.completed_on;

  let regenerationReason: RegenerationReason | null = null;
  if (task.source === "scheduled") {
    if (statusChanged && nextStatus === "completed") {
      regenerationReason = "TASK_COMPLETED";
    } else if (statusChanged && nextStatus === "pending") {
      regenerationReason = "TASK_UNDONE";
    } else if (completedOnChanged) {
      regenerationReason = "COMPLETION_DATE_CHANGED";
    }
  } else if (task.source === "adhoc" && completedOnChanged) {
    regenerationReason = "ADHOC_COMPLETION_CHANGED";
  }

  const updatePayload: Partial<WateringTaskRow> = {};
  const nowIso = new Date().toISOString();

  if (statusChanged) {
    updatePayload.status = nextStatus;
  }

  if (command.note !== undefined) {
    updatePayload.note = command.note;
  }

  if (nextStatus === "pending") {
    updatePayload.completed_on = null;
    updatePayload.completed_at = null;
  } else if (statusChanged && nextStatus === "completed") {
    updatePayload.completed_on = nextCompletedOn;
    updatePayload.completed_at = nowIso;
  } else if (completedOnChanged) {
    updatePayload.completed_on = nextCompletedOn;
  }

  if (task.source === "adhoc" && updatePayload.completed_on !== undefined) {
    updatePayload.due_on = nextCompletedOn;
  }

  updatePayload.updated_at = nowIso;

  const { data: updatedTask, error: updateError } = await supabaseAdmin
    .from("watering_tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .eq("user_id", userId)
    .select<WateringTaskRow>(WATERING_TASK_COLUMNS)
    .single();

  if (updateError || !updatedTask) {
    if (isPostgresError(updateError, "23505") || isPostgresError(updateError, "23514")) {
      throw new HttpError(409, "Update violates task constraints", "CONSTRAINT_VIOLATION");
    }

    logger.error("updateWateringTask: update failed", {
      error: updateError,
      userId,
      taskId,
      requestId: context?.requestId,
    });
    throw new HttpError(500, "Failed to update watering task", "UPDATE_WATERING_TASK_FAILED");
  }

  let scheduleEffect: ScheduleEffectDto = {
    tasks_regenerated: false,
    reason: null,
  };

  if (regenerationReason) {
    const plan = await loadActivePlanForPlant(supabaseUser, userId, task.plant_id, context);

    if (!plan) {
      if (task.source === "scheduled") {
        throw new HttpError(409, "Active watering plan not found for plant", "WATERING_PLAN_NOT_FOUND");
      }
    } else if (plan.schedule_basis === "completed_on") {
      await regenerateTasksForPlan(supabaseUser, userId, plan, context);
      scheduleEffect = {
        tasks_regenerated: true,
        reason: regenerationReason,
      };
    }
  }

  return {
    task: mapTaskToSummary(updatedTask),
    schedule_effect: scheduleEffect,
  };
};
