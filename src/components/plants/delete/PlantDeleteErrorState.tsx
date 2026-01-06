import type { FC } from 'react'

import type { PlantDeleteErrorVm } from '@/components/plants/delete/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export type PlantDeleteErrorStateProps = {
  error: PlantDeleteErrorVm
  onRetry?: () => void
  onBack: () => void
  loginHref?: string
}

const RETRYABLE_KINDS: PlantDeleteErrorVm['kind'][] = ['network', 'parse', 'http', 'unknown']

export const PlantDeleteErrorState: FC<PlantDeleteErrorStateProps> = ({
  error,
  onRetry,
  onBack,
  loginHref,
}) => {
  const canRetry = Boolean(onRetry && RETRYABLE_KINDS.includes(error.kind))
  const showLogin = Boolean(error.kind === 'unauthenticated' && loginHref)

  return (
    <Card role="status" className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-base text-destructive">Nie udało się wczytać danych</CardTitle>
        <CardDescription className="text-sm text-destructive/80">
          {error.message}
          {error.code ? (
            <span className="mt-2 block text-xs text-destructive/70">Kod: {error.code}</span>
          ) : null}
          {error.requestId ? (
            <span className="mt-1 block text-xs text-destructive/60">ID żądania: {error.requestId}</span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Wróć do poprzedniej strony lub spróbuj ponownie. Jeśli problem będzie się powtarzał, skontaktuj się z
        pomocą techniczną.
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        {canRetry ? (
          <Button variant="outline" onClick={onRetry}>
            Spróbuj ponownie
          </Button>
        ) : null}
        {showLogin ? (
          <Button variant="default" asChild>
            <a href={loginHref}>Zaloguj się ponownie</a>
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onBack}>
          Wróć
        </Button>
      </CardFooter>
    </Card>
  )
}

PlantDeleteErrorState.displayName = 'PlantDeleteErrorState'

