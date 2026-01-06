import type { FC } from 'react'

import type { PlantDetailActivePlanVm } from '@/components/plants/detail/types'
import { Button } from '@/components/ui/button'

type ActivePlanCardProps = {
  plan: PlantDetailActivePlanVm
  changePlanHref: string
}

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const formatDate = (value: string | null): string | null => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return dateFormatter.format(parsed)
}

const intervalLabel = (intervalDays: number): string => {
  if (!Number.isFinite(intervalDays) || intervalDays <= 0) return 'co kilka dni'
  if (intervalDays === 1) return 'codziennie'
  return `co ${intervalDays} dni`
}

const scheduleBasisLabels: Record<PlantDetailActivePlanVm['scheduleBasis'], string> = {
  due_on: 'według terminu',
  completed_on: 'według wykonania',
}

const startFromLabels: Record<PlantDetailActivePlanVm['startFrom'], string> = {
  today: 'od dzisiaj',
  purchase_date: 'od daty zakupu',
  custom_date: 'od własnej daty',
}

const overduePolicyLabels: Record<PlantDetailActivePlanVm['overduePolicy'], string> = {
  carry_forward: 'przenoś zaległe',
  reschedule: 'planuj ponownie',
}

export const ActivePlanCard: FC<ActivePlanCardProps> = ({ plan, changePlanHref }) => (
  <div className="space-y-4">
    <div className="space-y-1">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Aktywny plan</p>
      <h3 className="text-2xl font-semibold text-foreground">
        Podlewaj {intervalLabel(plan.intervalDays)}
      </h3>
      <p className="text-sm text-muted-foreground">
        Horyzont planu: {plan.horizonDays} dni • Harmonogram {scheduleBasisLabels[plan.scheduleBasis]}
      </p>
      <p className="text-sm text-muted-foreground">
        Start: {startFromLabels[plan.startFrom]}
        {plan.startFrom === 'custom_date' && plan.customStartOn ? ` (${plan.customStartOn})` : ''}
      </p>
      <p className="text-sm text-muted-foreground">
        Zaległości: {overduePolicyLabels[plan.overduePolicy]}
      </p>
      <p className="text-xs text-muted-foreground">
        Ważny od {formatDate(plan.validFrom) ?? 'utworzenia'}
        {plan.validTo ? ` do ${formatDate(plan.validTo)}` : ''}
      </p>
      {plan.wasAiSuggested ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          AI
          {plan.wasAiAcceptedWithoutChanges
            ? 'zaakceptowano bez zmian'
            : 'dostosowano przed zapisem'}
        </span>
      ) : null}
    </div>
    <Button asChild variant="outline">
      <a href={changePlanHref}>Zmień plan</a>
    </Button>
  </div>
)

ActivePlanCard.displayName = 'ActivePlanCard'

