import type { FC } from "react";

import { Button } from "@/components/ui/button";
import type { PlantsFlashMessage } from "@/lib/services/plants/delete-flash";

interface PlantsListFlashBannerProps {
  message: PlantsFlashMessage;
  onDismiss: () => void;
}

export const PlantsListFlashBanner: FC<PlantsListFlashBannerProps> = ({ message, onDismiss }) => {
  if (message.kind !== "plantDeleted") return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
      <div>
        <p className="font-medium">Roślina „{message.plantName}” została pomyślnie usunięta.</p>
        {message.requestId ? <p className="text-xs text-emerald-800/70">ID żądania: {message.requestId}</p> : null}
      </div>
      <Button size="sm" variant="outline" onClick={onDismiss}>
        Zamknij
      </Button>
    </div>
  );
};

PlantsListFlashBanner.displayName = "PlantsListFlashBanner";
