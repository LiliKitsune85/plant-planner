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

type AiBlockedStateProps = {
  status: AiSuggestionRateLimitedVm
  onManual: () => void
  onBackToPlant?: () => void
}

export const AiBlockedState: FC<AiBlockedStateProps> = ({ status, onManual, onBackToPlant }) => {
  const unlockText = status.unlockAt
    ? `Limit zostanie zresetowany około ${new Date(status.unlockAt).toLocaleString()}.`
    : 'Limit AI został tymczasowo wyczerpany.'

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle>AI jest chwilowo niedostępne</CardTitle>
        <CardDescription>{unlockText}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Możesz kontynuować konfigurację planu ręcznie. Proponowany plan AI zostanie zapisany, gdy
          limit zostanie odblokowany i spróbujesz ponownie.
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button onClick={onManual}>Ustaw ręcznie</Button>
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

