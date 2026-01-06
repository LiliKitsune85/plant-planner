import type { FC } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AiSuggestionErrorVm } from '@/components/plants/watering-plan/types'

type AiErrorStateProps = {
  error: AiSuggestionErrorVm
  isRetrying: boolean
  onRetry: () => void
  onManual: () => void
}

const buildTitle = (status: AiSuggestionErrorVm['status']) => {
  switch (status) {
    case 'timeout':
      return 'AI nie odpowiedziało na czas'
    case 'provider_error':
      return 'Wystąpił błąd dostawcy AI'
    case 'unauthenticated':
      return 'Sesja wygasła'
    case 'not_found':
      return 'Nie znaleziono rośliny'
    default:
      return 'Nie udało się pobrać sugestii AI'
  }
}

export const AiErrorState: FC<AiErrorStateProps> = ({ error, isRetrying, onRetry, onManual }) => {
  const title = buildTitle(error.status)
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{error.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        {error.requestId ? (
          <p>
            Identyfikator żądania: <span className="font-mono text-xs">{error.requestId}</span>
          </p>
        ) : null}
        {error.code ? <p>Kod błędu: {error.code}</p> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button variant="outline" disabled={isRetrying} onClick={onRetry}>
          Spróbuj ponownie
        </Button>
        <Button disabled={isRetrying} onClick={onManual}>
          Ustaw ręcznie
        </Button>
      </CardFooter>
    </Card>
  )
}

AiErrorState.displayName = 'AiErrorState'

