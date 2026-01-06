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
import type { AiSuggestionAvailableVm } from '@/components/plants/watering-plan/types'

type AiSuggestionCardProps = {
  suggestion: AiSuggestionAvailableVm
  isSaving: boolean
  onAccept: () => void
  onEdit: () => void
  onRejectToManual: () => void
}

export const AiSuggestionCard: FC<AiSuggestionCardProps> = ({
  suggestion,
  isSaving,
  onAccept,
  onEdit,
  onRejectToManual,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proponowany plan AI</CardTitle>
        <CardDescription>
          Sugestia oparta o gatunek rośliny i ostatnie działania. Możesz ją zaakceptować lub
          dostosować poniżej.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm uppercase text-muted-foreground">Częstotliwość</p>
          <p className="text-2xl font-semibold">{`Podlewaj co ${suggestion.intervalDays} dni`}</p>
        </div>
        {suggestion.explanation ? (
          <div className="space-y-1 rounded-2xl border border-muted-foreground/20 bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Uzasadnienie AI</p>
            <p>{suggestion.explanation}</p>
          </div>
        ) : null}
        <dl className="grid gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Horyzont</dt>
            <dd className="font-medium">{suggestion.horizonDays} dni</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rozpocznij od</dt>
            <dd className="font-medium">
              {suggestion.startFrom === 'today'
                ? 'Dziś'
                : suggestion.startFrom === 'purchase_date'
                  ? 'Daty zakupu'
                  : suggestion.customStartOn
                    ? new Date(suggestion.customStartOn).toLocaleDateString()
                    : 'Ustalona data'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Podstawa harmonogramu</dt>
            <dd className="font-medium">
              {suggestion.scheduleBasis === 'completed_on' ? 'Data ukończenia' : 'Data terminu'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Zaległości</dt>
            <dd className="font-medium">
              {suggestion.overduePolicy === 'carry_forward'
                ? 'Przenoś na kolejny termin'
                : 'Przelicz harmonogram'}
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button disabled={isSaving} onClick={onAccept}>
          Akceptuj
        </Button>
        <Button variant="outline" disabled={isSaving} onClick={onEdit}>
          Edytuj i zapisz
        </Button>
        <Button variant="ghost" disabled={isSaving} onClick={onRejectToManual}>
          Ustaw ręcznie
        </Button>
      </CardFooter>
    </Card>
  )
}

AiSuggestionCard.displayName = 'AiSuggestionCard'

