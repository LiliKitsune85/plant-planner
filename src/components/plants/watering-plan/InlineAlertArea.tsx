import type { FC } from "react";

import type { SetPlanErrorVm } from "@/components/plants/watering-plan/types";

interface InlineAlertAreaProps {
  error?: SetPlanErrorVm | null;
  onDismiss?: () => void;
}

const getToneClasses = (kind: SetPlanErrorVm["kind"]) => {
  switch (kind) {
    case "validation":
      return "border-amber-500/40 bg-amber-500/10 text-amber-900";
    case "unauthenticated":
    case "not_found":
    case "http":
    case "network":
    case "parse":
    case "unknown":
    case "conflict":
      return "border-destructive/40 bg-destructive/10 text-destructive-foreground";
    default:
      return "border-border bg-muted text-foreground";
  }
};

export const InlineAlertArea: FC<InlineAlertAreaProps> = ({ error, onDismiss }) => {
  if (!error) return null;
  const tone = getToneClasses(error.kind);
  return (
    <section className={`flex flex-wrap items-start gap-4 rounded-2xl border p-4 text-sm ${tone}`}>
      <div className="space-y-1">
        <p className="font-medium">{error.message}</p>
        {error.requestId ? (
          <p className="text-xs opacity-80">
            Identyfikator żądania: <span className="font-mono">{error.requestId}</span>
          </p>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto rounded-full border border-current/30 px-3 py-1 text-xs uppercase tracking-widest"
        >
          Zamknij
        </button>
      ) : null}
    </section>
  );
};

InlineAlertArea.displayName = "InlineAlertArea";
