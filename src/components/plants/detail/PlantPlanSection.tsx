import type { FC } from 'react'

import type { PlantDetailVm } from '@/components/plants/detail/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { ActivePlanCard } from './ActivePlanCard'
import { NoPlanCard } from './NoPlanCard'

export type PlantPlanSectionProps = {
  activePlan: PlantDetailVm['activePlan']
  changePlanHref: string
  generateAiHref: string
  setManualHref: string
}

export const PlantPlanSection: FC<PlantPlanSectionProps> = ({
  activePlan,
  changePlanHref,
  generateAiHref,
  setManualHref,
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Plan podlewania</CardTitle>
    </CardHeader>
    <CardContent>
      {activePlan ? (
        <ActivePlanCard plan={activePlan} changePlanHref={changePlanHref} />
      ) : (
        <NoPlanCard generateAiHref={generateAiHref} setManualHref={setManualHref} />
      )}
    </CardContent>
  </Card>
)

PlantPlanSection.displayName = 'PlantPlanSection'

