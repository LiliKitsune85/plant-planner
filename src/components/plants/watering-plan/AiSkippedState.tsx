import type { FC } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiSuggestionSkippedVm } from "@/components/plants/watering-plan/types";

interface AiSkippedStateProps {
  state: AiSuggestionSkippedVm;
  onManual: () => void;
}

export const AiSkippedState: FC<AiSkippedStateProps> = ({ state, onManual }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nie można wygenerować sugestii AI</CardTitle>
        <CardDescription>
          {state.reason ?? "Brakuje wymaganych informacji o roślinie. Możesz skonfigurować plan ręcznie."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          Aby w przyszłości korzystać z sugestii AI, upewnij się, że roślina ma określony gatunek lub spróbuj ponownie
          po uzupełnieniu danych.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={onManual}>Przejdź do edytora</Button>
      </CardFooter>
    </Card>
  );
};

AiSkippedState.displayName = "AiSkippedState";
