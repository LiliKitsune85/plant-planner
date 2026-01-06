import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

import type { PlantEditErrorVm } from './types'

type PlantEditErrorStateProps = {
  error: PlantEditErrorVm
  onRetry?: () => void
  loginHref?: string
}

const fallbackHref = '/plants'

export const PlantEditErrorState = ({ error, onRetry, loginHref }: PlantEditErrorStateProps) => {
  const showRetry =
    error.kind === 'network' ||
    error.kind === 'http' ||
    error.kind === 'unknown' ||
    error.kind === 'parse'
  const showLogin = error.kind === 'unauthenticated' && loginHref
  const secondaryHref =
    error.kind === 'validation' || error.kind === 'notFound' ? fallbackHref : '/calendar'

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle>Nie udało się załadować widoku edycji</CardTitle>
        <CardDescription>{error.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {error.code ? (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Kod błędu: {error.code}</p>
        ) : null}
        {error.requestId ? (
          <p className="text-xs text-muted-foreground">Identyfikator żądania: {error.requestId}</p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        {showLogin ? (
          <Button asChild>
            <a href={loginHref}>Zaloguj się ponownie</a>
          </Button>
        ) : null}
        {showRetry && onRetry ? (
          <Button onClick={onRetry} variant={showLogin ? 'outline' : 'default'}>
            Spróbuj ponownie
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <a href={secondaryHref}>{error.kind === 'notFound' ? 'Wróć do roślin' : 'Przejdź do kalendarza'}</a>
        </Button>
      </CardFooter>
    </Card>
  )
}

PlantEditErrorState.displayName = 'PlantEditErrorState'
