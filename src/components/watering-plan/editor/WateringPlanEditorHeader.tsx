import type { FC } from 'react'

import { Button } from '@/components/ui/button'

export type WateringPlanEditorHeaderProps = {
  onBack?: () => void
  backHref: string
  title?: string
  subtitle?: string
}

export const WateringPlanEditorHeader: FC<WateringPlanEditorHeaderProps> = ({
  onBack,
  backHref,
  title = 'Ustaw plan podlewania',
  subtitle = 'Określ częstotliwość podlewania oraz datę rozpoczęcia harmonogramu.',
}) => {
  const handleBackClick = () => {
    if (onBack) {
      onBack()
      return
    }
    if (typeof window !== 'undefined') {
      window.location.assign(backHref)
    }
  }

  return (
    <header className="flex flex-col gap-4 border-b border-border/60 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
            Plan podlewania
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="max-w-2xl text-base text-muted-foreground">{subtitle}</p>
        </div>
        <Button variant="ghost" type="button" onClick={handleBackClick}>
          Wróć
        </Button>
      </div>
    </header>
  )
}

WateringPlanEditorHeader.displayName = 'WateringPlanEditorHeader'

