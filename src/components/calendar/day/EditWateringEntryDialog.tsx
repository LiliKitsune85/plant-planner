import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import type { CalendarDayTaskVm } from "@/lib/services/calendar/day-view-model";
import type { UpdateWateringTaskCommand } from "@/types";

interface EditWateringEntryDialogProps {
  open: boolean;
  task: CalendarDayTaskVm;
  dateContext: string;
  pending?: boolean;
  error?: {
    message: string;
    fieldErrors?: Record<string, string[]>;
  } | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (command: UpdateWateringTaskCommand) => Promise<void> | void;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type FieldErrors = Record<string, string[]>;

export const EditWateringEntryDialog = ({
  open,
  task,
  dateContext,
  pending,
  error,
  onOpenChange,
  onSubmit,
}: EditWateringEntryDialogProps) => {
  const titleId = useId();
  const statusId = useId();
  const completedOnId = useId();
  const noteId = useId();
  const [status, setStatus] = useState<"pending" | "completed">(task.status);
  const [completedOn, setCompletedOn] = useState<string>(
    task.completedOn ?? (task.status === "completed" ? dateContext : "")
  );
  const [note, setNote] = useState<string>(task.note ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus(task.status);
    setCompletedOn(task.completedOn ?? (task.status === "completed" ? dateContext : ""));
    setNote(task.note ?? "");
    setFieldErrors({});
    setFormError(null);
  }, [dateContext, open, task.completedOn, task.note, task.status]);

  useEffect(() => {
    if (error?.fieldErrors) {
      setFieldErrors(error.fieldErrors);
    }
  }, [error]);

  const canSetPending = !task.isAdhoc;

  const hasChanges = useMemo(() => {
    const trimmedNote = note.trim();
    const normalizedNote = trimmedNote === "" ? null : trimmedNote;

    if (status !== task.status) return true;
    if ((task.completedOn ?? null) !== (status === "completed" ? completedOn : null)) return true;
    if ((task.note ?? null) !== normalizedNote) return true;
    return false;
  }, [completedOn, note, status, task.completedOn, task.note, task.status]);

  const validate = (): boolean => {
    const nextFieldErrors: FieldErrors = {};
    let nextFormError: string | null = null;

    if (!canSetPending && status === "pending") {
      nextFormError = "Wpis ad hoc musi pozostać oznaczony jako ukończony.";
    }

    if (status === "completed") {
      if (!completedOn || !ISO_DATE_REGEX.test(completedOn)) {
        nextFieldErrors.completed_on = ["Podaj poprawną datę w formacie RRRR-MM-DD."];
      }
    } else if (completedOn && status === "pending") {
      nextFieldErrors.completed_on = ['Nie podawaj daty wykonania dla statusu "Do wykonania".'];
    }

    const trimmedNote = note.trim();
    if (trimmedNote.length > 500) {
      nextFieldErrors.note = ["Notatka nie może przekraczać 500 znaków."];
    }

    if (!hasChanges) {
      nextFormError = "Wprowadź co najmniej jedną zmianę, aby zapisać.";
    }

    setFieldErrors(nextFieldErrors);
    setFormError(nextFormError);

    return Object.keys(nextFieldErrors).length === 0 && !nextFormError;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    const command: UpdateWateringTaskCommand = {};

    if (status !== task.status) {
      command.status = status;
    }

    if (status === "completed") {
      command.completed_on = completedOn;
    }

    const trimmedNote = note.trim();
    const normalizedNote = trimmedNote === "" ? null : trimmedNote;
    if ((task.note ?? null) !== normalizedNote) {
      command.note = normalizedNote;
    }

    await onSubmit(command);
  };

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} labelledBy={titleId}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <ModalHeader>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Edycja wpisu</p>
            <h2 id={titleId} className="text-2xl font-semibold">
              {task.plantDisplayName}
            </h2>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          {error && !error.fieldErrors && <p className="text-sm text-destructive">{error.message}</p>}
        </ModalHeader>

        <ModalBody>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor={statusId}>
              Status
            </label>
            <select
              id={statusId}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as "pending" | "completed")}
              disabled={!canSetPending || pending}
            >
              <option value="completed">Ukończone</option>
              <option value="pending" disabled={!canSetPending}>
                Do wykonania
              </option>
            </select>
            {fieldErrors.status && <p className="text-sm text-destructive">{fieldErrors.status.join(" ")}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor={completedOnId}>
              Data wykonania
            </label>
            <input
              id={completedOnId}
              type="date"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={completedOn ?? ""}
              onChange={(event) => setCompletedOn(event.target.value)}
              disabled={status === "pending" || pending}
            />
            {fieldErrors.completed_on && (
              <p className="text-sm text-destructive">{fieldErrors.completed_on.join(" ")}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor={noteId}>
              Notatka
            </label>
            <textarea
              id={noteId}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={4}
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">Pozostało {500 - note.length} znaków</p>
            {fieldErrors.note && <p className="text-sm text-destructive">{fieldErrors.note.join(" ")}</p>}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Anuluj
          </Button>
          <Button type="submit" disabled={pending}>
            Zapisz zmiany
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

EditWateringEntryDialog.displayName = "EditWateringEntryDialog";
