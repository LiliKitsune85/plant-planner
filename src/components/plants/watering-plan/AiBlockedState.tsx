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
import type { AiSuggestionRateLimitedVm } from '@/components/plants/watering-plan/types'
import type { AiQuotaDto } from '@/types'

type AiBlockedStateVariant = 'live' | 'precheck'

type AiBlockedStateProps = {
  status: AiSuggestionRateLimitedVm
  onManual: () => void
  onBackToPlant?: () => void
  onRetry?: () => void
  variant?: AiBlockedStateVariant
  quota?: AiQuotaDto
}

const buildDescription = (status: AiSuggestionRateLimitedVm, variant: AiBlockedStateVariant) => {
  const unlockText = status.unlockAt
    ? `Limit zostanie zresetowany około ${new Date(status.unlockAt).toLocaleString()}.`
    : 'Limit AI został tymczasowo wyczerpany.'
  if (variant === 'precheck') {
    return `Nie wysyłamy żądania do AI, bo limit jest nadal zablokowany. ${unlockText}`
  }
  return unlockText
}

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Nieznany'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Nieznany'
  return date.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

export const AiBlockedState: FC<AiBlockedStateProps> = ({
  status,
  onManual,
  onBackToPlant,
  onRetry,
  variant = 'live',
  quota,
}) => {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle>AI jest chwilowo niedostępne</CardTitle>
        <CardDescription>{buildDescription(status, variant)}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Możesz kontynuować konfigurację planu ręcznie. Proponowany plan AI zostanie zapisany, gdy
          limit zostanie odblokowany i spróbujesz ponownie.
        </p>
        {quota ? (
          <dl className="mt-4 space-y-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900">
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-amber-950">Pozostałe wywołania</dt>
              <dd className="font-semibold text-amber-950">
                {quota.remaining} / {quota.limit_per_hour}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-amber-950">Reset limitu</dt>
              <dd className="font-semibold text-amber-950">
                {formatDateTime(quota.window_resets_at)}
              </dd>
            </div>
          </dl>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button onClick={onManual}>Ustaw ręcznie</Button>
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            Sprawdź limit ponownie
          </Button>
        ) : null}
        {onBackToPlant ? (
          <Button variant="ghost" onClick={onBackToPlant}>
            Wróć do rośliny
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}

AiBlockedState.displayName = 'AiBlockedState'

