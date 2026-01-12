import type { CalendarDayTaskVm } from "@/lib/services/calendar/day-view-model";

import { WateringTaskRow } from "./WateringTaskRow";

interface CalendarDayTaskListProps {
  items: CalendarDayTaskVm[];
  pendingByTaskId?: Record<string, boolean>;
  highlightPlantId?: string;
  onConfirm?: (task: CalendarDayTaskVm) => void;
  onUndo?: (task: CalendarDayTaskVm) => void;
  onEdit?: (task: CalendarDayTaskVm) => void;
  onDelete?: (task: CalendarDayTaskVm) => void;
}

const EMPTY_PENDING_MAP: Record<string, boolean> = {};

export const CalendarDayTaskList = ({
  items,
  pendingByTaskId = EMPTY_PENDING_MAP,
  highlightPlantId,
  onConfirm,
  onUndo,
  onEdit,
  onDelete,
}: CalendarDayTaskListProps) => (
  <ul className="space-y-4">
    {items.map((task) => (
      <WateringTaskRow
        key={task.id}
        task={task}
        isPending={Boolean(pendingByTaskId[task.id])}
        isHighlighted={Boolean(highlightPlantId && task.plantId === highlightPlantId)}
        onConfirm={onConfirm}
        onUndo={onUndo}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ))}
  </ul>
);

CalendarDayTaskList.displayName = "CalendarDayTaskList";
