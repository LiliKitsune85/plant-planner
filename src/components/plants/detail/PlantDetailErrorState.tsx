import type { FC } from 'react'

import type { PlantDetailErrorVm } from '@/components/plants/detail/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type PlantDetailErrorStateProps = {
  error: PlantDetailErrorVm
  onRetry?: () => void
  loginHref?: string
  backHref?: string
}

const getPrimaryAction = (
  error: PlantDetailErrorVm,
  loginHref?: string,
  backHref?: string,
): { label: string; href?: string } | null => {
  if (error.kind === 'unauthenticated') {
    return { label: 'Przejdź do logowania', href: loginHref ?? '/auth/login' }
  }

  if (error.kind === 'validation' || error.kind === 'notFound') {
    return { label: 'Wróć do listy roślin', href: backHref ?? '/plants' }
  }

  return null
}

export const PlantDetailErrorState: FC<PlantDetailErrorStateProps> = ({
  error,
  onRetry,
  loginHref,
  backHref,
}) => {
  const primaryAction = getPrimaryAction(error, loginHref, backHref)

  return (
    <Card role="alert">
      <CardHeader>
        <CardTitle>Nie udało się wczytać danych rośliny</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base text-muted-foreground">{error.message}</p>
        {error.requestId ? (
          <p className="text-xs text-muted-foreground/80">ID żądania: {error.requestId}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {primaryAction?.href ? (
            <Button asChild>
              <a href={primaryAction.href}>{primaryAction.label}</a>
            </Button>
          ) : null}
          {onRetry && error.kind !== 'validation' && error.kind !== 'notFound' ? (
            <Button variant="outline" onClick={onRetry}>
              Spróbuj ponownie
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

PlantDetailErrorState.displayName = 'PlantDetailErrorState'

