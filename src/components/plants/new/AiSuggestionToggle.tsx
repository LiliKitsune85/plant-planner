import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export type AiSuggestionToggleProps = {
  checked: boolean
  disabled?: boolean
  showLimitInfo: boolean
  limitText: string
  rateLimit?: { unlockAt?: string } | null
  onCheckedChange: (checked: boolean) => void
}

export const AiSuggestionToggle = ({
  checked,
  disabled,
  showLimitInfo,
  limitText,
  rateLimit,
  onCheckedChange,
}: AiSuggestionToggleProps) => {
  return (
    <section className="rounded-xl border border-border/70 bg-muted/30 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label htmlFor="create-plant-ai-toggle" className="text-base font-medium text-foreground">
            Generuj plan AI
          </Label>
          <p className="text-sm text-muted-foreground">
            Automatycznie wygeneruj wstępny plan podlewania zaraz po dodaniu rośliny.
          </p>
        </div>
        <Switch
          id="create-plant-ai-toggle"
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-describedby={rateLimit ? 'create-plant-ai-limit' : undefined}
          data-testid="create-plant-ai-toggle"
        />
      </div>
      {showLimitInfo ? (
        <p className="mt-3 text-sm text-muted-foreground" id="create-plant-ai-limit">
          {limitText}
        </p>
      ) : null}
      {rateLimit ? (
        <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Limit został osiągnięty. Możesz kontynuować dodawanie rośliny bez AI.{' '}
          {rateLimit.unlockAt
            ? `Kolejna prośba będzie możliwa po ${rateLimit.unlockAt}.`
            : 'Wróć za chwilę, aby ponownie włączyć AI.'}
        </p>
      ) : null}
    </section>
  )
}

AiSuggestionToggle.displayName = 'AiSuggestionToggle'
