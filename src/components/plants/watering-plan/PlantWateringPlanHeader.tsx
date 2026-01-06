import type { FC } from 'react'

type PlantWateringPlanHeaderProps = {
  speciesName?: string
}

export const PlantWateringPlanHeader: FC<PlantWateringPlanHeaderProps> = ({ speciesName }) => {
  return (
    <header className="space-y-2">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Plan podlewania</p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Ustaw plan podlewania</h1>
      {speciesName ? (
        <p className="text-base text-muted-foreground">
          Na podstawie preferencji gatunku: <span className="font-medium">{speciesName}</span>
        </p>
      ) : (
        <p className="text-base text-muted-foreground">
          Skonfiguruj częstotliwość i zasady podlewania dla tej rośliny.
        </p>
      )}
    </header>
  )
}

PlantWateringPlanHeader.displayName = 'PlantWateringPlanHeader'

