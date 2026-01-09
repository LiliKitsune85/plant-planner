import type { FC } from 'react'

import type { TasksRegeneratedSummary } from '@/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export type TasksRegeneratedSummaryCardProps = {
  summary: TasksRegeneratedSummary
}

const formatIsoDate = (value: string): string => {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const TasksRegeneratedSummaryCard: FC<TasksRegeneratedSummaryCardProps> = ({ summary }) => {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>Plan zapisany</CardTitle>
        <CardDescription>
          Zregenerowaliśmy zadania w zakresie {formatIsoDate(summary.from)} –{' '}
          {formatIsoDate(summary.to)} (łącznie {summary.count}).
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          Po chwili zostaniesz przeniesiony do kalendarza, aby zobaczyć zaktualizowany harmonogram.
        </p>
      </CardContent>
    </Card>
  )
}

TasksRegeneratedSummaryCard.displayName = 'TasksRegeneratedSummaryCard'

