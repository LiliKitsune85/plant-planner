import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { PlantsListErrorVm } from '@/lib/services/plants/list-view-model'

type PlantsErrorStateProps = {
  error: PlantsListErrorVm
  onRetry?: () => void
  loginHref?: string
  resetHref?: string
}

const getErrorTitle = (kind: PlantsListErrorVm['kind']): string => {
  switch (kind) {
    case 'unauthenticated':
      return 'Sesja wygasła'
    case 'validation':
      return 'Niepoprawne filtry'
    case 'network':
      return 'Brak połączenia z siecią'
    default:
      return 'Nie udało się wczytać listy roślin'
  }
}

export const PlantsErrorState = ({
  error,
  onRetry,
  loginHref = '/auth/login',
  resetHref = '/plants',
}: PlantsErrorStateProps) => {
  const title = getErrorTitle(error.kind)
  const showRetry = !['validation', 'unauthenticated'].includes(error.kind)

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{error.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {error.status && <p>Kod odpowiedzi: {error.status}</p>}
        {error.code && <p>Kod błędu: {error.code}</p>}
        {error.requestId && <p>ID żądania: {error.requestId}</p>}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {showRetry && onRetry && (
          <Button type="button" onClick={onRetry}>
            Spróbuj ponownie
          </Button>
        )}
        {error.kind === 'unauthenticated' && (
          <Button asChild variant="outline">
            <a href={loginHref}>Zaloguj się ponownie</a>
          </Button>
        )}
        {error.kind === 'validation' && (
          <Button asChild variant="outline">
            <a href={resetHref}>Resetuj filtry</a>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

PlantsErrorState.displayName = 'PlantsErrorState'
