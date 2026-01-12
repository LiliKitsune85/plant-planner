import { useEffect, useMemo, useState } from "react";

import {
  consumeCreatePlantResult,
  peekCreatePlantResult,
  type CreatePlantResultSessionPayload,
} from "@/lib/services/plants/create-plant-result-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface WateringPlanLandingViewProps {
  plantId: string;
}

const buildStatusDescription = (context: CreatePlantResultSessionPayload | null) => {
  if (!context) {
    return {
      title: "Brak danych AI",
      description: "Nie znaleziono kontekstu nowo utworzonej rośliny. Możesz kontynuować konfigurację planu ręcznie.",
      tone: "default",
    } as const;
  }

  switch (context.wateringSuggestion.status) {
    case "available":
      return {
        title: "Plan AI jest gotowy",
        description: "Możesz przejrzeć proponowany przez AI plan podlewania i w razie potrzeby go edytować.",
        tone: "success",
      } as const;
    case "rate_limited":
      return {
        title: "AI jest chwilowo niedostępne",
        description: context.wateringSuggestion.unlock_at
          ? `Plan AI będzie dostępny po ${new Date(
              context.wateringSuggestion.unlock_at
            ).toLocaleString()}. W międzyczasie możesz ustawić plan ręcznie.`
          : "Plan AI nie został wygenerowany z powodu limitu. Spróbuj ponownie za kilka minut lub ustaw plan ręcznie.",
        tone: "warning",
      } as const;
    case "error":
    case "skipped":
    default:
      return {
        title: "AI pominęło generowanie planu",
        description:
          context.wateringSuggestion.explanation ??
          "Nie udało się utworzyć planu AI. Ustaw plan ręcznie, aby kontynuować.",
        tone: "muted",
      } as const;
  }
};

export const WateringPlanLandingView = ({ plantId }: WateringPlanLandingViewProps) => {
  const [creationContext, setCreationContext] = useState<CreatePlantResultSessionPayload | null>(null);

  useEffect(() => {
    const payload = peekCreatePlantResult();
    if (payload && payload.plantId === plantId) {
      setCreationContext(payload);
      consumeCreatePlantResult();
    } else {
      setCreationContext(null);
    }
  }, [plantId]);

  const status = useMemo(() => buildStatusDescription(creationContext), [creationContext]);

  const cardToneClass =
    status.tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : status.tone === "warning"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border bg-muted/30";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Plan podlewania</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Konfiguracja planu</h1>
        <p className="text-base text-muted-foreground">
          Ten widok pozwoli Ci przejrzeć i zaakceptować zalecenia AI lub ustawić plan własnoręcznie.
        </p>
      </header>

      <Card className={cardToneClass}>
        <CardHeader>
          <CardTitle>{status.title}</CardTitle>
          <CardDescription>{status.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="default" disabled>
            Wkrótce: edytor planu
          </Button>
          <Button asChild variant="outline">
            <a href={`/plants/${plantId}`}>Przejdź do szczegółów rośliny</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
};

WateringPlanLandingView.displayName = "WateringPlanLandingView";
