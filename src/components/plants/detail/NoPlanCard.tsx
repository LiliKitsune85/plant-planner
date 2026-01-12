import type { FC } from "react";

import { Button } from "@/components/ui/button";

interface NoPlanCardProps {
  generateAiHref: string;
  setManualHref: string;
}

export const NoPlanCard: FC<NoPlanCardProps> = ({ generateAiHref, setManualHref }) => (
  <div className="space-y-4">
    <div>
      <p className="text-sm uppercase tracking-widest text-amber-600">Brak aktywnego planu</p>
      <h3 className="text-2xl font-semibold text-foreground">Ustaw harmonogram podlewania</h3>
      <p className="text-sm text-muted-foreground">
        Ta roślina nie ma aktywnego planu. Skorzystaj z sugestii AI lub ustaw plan ręcznie.
      </p>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button asChild>
        <a href={generateAiHref}>Wygeneruj plan AI</a>
      </Button>
      <Button variant="outline" asChild>
        <a href={setManualHref}>Ustaw ręcznie</a>
      </Button>
    </div>
  </div>
);

NoPlanCard.displayName = "NoPlanCard";
