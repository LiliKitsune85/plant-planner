import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreatePlantErrorVm } from "@/components/plants/new/types";

interface CreatePlantInlineErrorProps {
  error: CreatePlantErrorVm;
  onRetry?: () => void;
  onDismiss?: () => void;
  loginHref: string;
}

export const CreatePlantInlineError = ({ error, onRetry, onDismiss, loginHref }: CreatePlantInlineErrorProps) => {
  const showRetry =
    error.kind === "network" ||
    error.kind === "conflict" ||
    error.kind === "http" ||
    error.kind === "unknown" ||
    error.kind === "parse";

  const action = (() => {
    if (error.kind === "unauthenticated") {
      return (
        <Button asChild>
          <a href={loginHref}>Przejdź do logowania</a>
        </Button>
      );
    }
    if (showRetry && onRetry) {
      return (
        <Button variant="outline" onClick={onRetry}>
          Spróbuj ponownie
        </Button>
      );
    }
    return null;
  })();

  const showActions = Boolean(action || onDismiss);

  return (
    <Card role="alert" aria-live="assertive" className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-destructive">Nie udało się zapisać rośliny</CardTitle>
        <CardDescription>{error.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error.requestId ? <p className="text-xs text-muted-foreground">ID żądania: {error.requestId}</p> : null}
        {showActions ? (
          <div className="flex flex-wrap gap-3">
            {action}
            {onDismiss ? (
              <Button variant="ghost" onClick={onDismiss}>
                Ukryj komunikat
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

CreatePlantInlineError.displayName = "CreatePlantInlineError";
