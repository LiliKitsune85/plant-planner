import { useEffect, useId, useRef } from "react";
import type { FC } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { WateringPlanMutationError } from "./types";

export interface WateringPlanEditorErrorBannerProps {
  error: WateringPlanMutationError;
  pending: boolean;
  loginHref?: string;
  onRetry?: () => void;
}

const buildTitleByKind = (kind: WateringPlanMutationError["kind"]): string => {
  switch (kind) {
    case "unauthenticated":
      return "Sesja wygasła";
    case "notFound":
      return "Nie znaleziono rośliny";
    case "conflict":
      return "Plan został zmieniony równolegle";
    case "network":
      return "Brak połączenia z serwerem";
    case "http":
    case "parse":
      return "Błąd serwera";
    default:
      return "Nie udało się zapisać planu";
  }
};

export const WateringPlanEditorErrorBanner: FC<WateringPlanEditorErrorBannerProps> = ({
  error,
  pending,
  loginHref,
  onRetry,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    cardRef.current?.focus();
  }, [error]);

  return (
    <Card
      ref={cardRef}
      role="alert"
      aria-live="assertive"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      className="border-destructive/30 bg-destructive/5 text-destructive-foreground"
    >
      <CardHeader>
        <CardTitle id={titleId}>{buildTitleByKind(error.kind)}</CardTitle>
        <CardDescription id={descriptionId} className="text-base text-destructive-foreground/90">
          {error.message}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-destructive-foreground/80">
        {error.requestId ? (
          <p className="text-xs uppercase tracking-wider text-destructive-foreground/70">
            ID żądania: <span className="font-mono text-[11px]">{error.requestId}</span>
          </p>
        ) : null}
        {error.details && error.kind === "http" ? (
          <pre className="max-h-32 overflow-auto rounded-lg bg-background/40 p-3 text-xs">
            {JSON.stringify(error.details, null, 2)}
          </pre>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        {onRetry ? (
          <Button type="button" onClick={onRetry} disabled={pending}>
            Spróbuj ponownie
          </Button>
        ) : null}
        {loginHref ? (
          <Button type="button" asChild variant="outline" disabled={pending}>
            <a href={loginHref}>Przejdź do logowania</a>
          </Button>
        ) : null}
        {error.kind === "notFound" ? (
          <Button type="button" asChild variant="ghost" disabled={pending}>
            <a href="/plants">Lista roślin</a>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
};

WateringPlanEditorErrorBanner.displayName = "WateringPlanEditorErrorBanner";
