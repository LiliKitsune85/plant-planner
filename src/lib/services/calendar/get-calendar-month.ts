import type { SupabaseClient } from '../../../db/supabase.client'
import type { CalendarMonthResponseDto } from '../../../types'
import { HttpError } from '../../http/errors'
import type {
  CalendarTaskStatusFilter,
  GetCalendarMonthQuery,
} from './types'
import { monthToDateRange } from '../../utils/date'

type PersistedTaskStatus = Exclude<CalendarTaskStatusFilter, 'all'>

type CalendarMonthAggregateRow = {
  due_on: string
  count: number | null
}

const buildStatusFilter = (
  status: CalendarTaskStatusFilter,
): PersistedTaskStatus[] => {
  if (status === 'all') {
    return ['pending', 'completed']
  }

  return [status]
}

export const getCalendarMonthSummary = async (
  supabase: SupabaseClient,
  query: GetCalendarMonthQuery,
): Promise<CalendarMonthResponseDto> => {
  const { userId, month, status } = query
  const { rangeStart, rangeEnd } = monthToDateRange(month)
  const statusFilter = buildStatusFilter(status)

  const { data, error } = await supabase
    .from('watering_tasks')
    .select<CalendarMonthAggregateRow>('due_on, count:count()')
    .eq('user_id', userId)
    .gte('due_on', rangeStart)
    .lt('due_on', rangeEnd)
    .in('status', statusFilter)
    .group('due_on')
    .order('due_on', { ascending: true })

  if (error || !data) {
    console.error('getCalendarMonthSummary query failed', {
      error,
      userId,
      month,
      status,
      rangeStart,
      rangeEnd,
    })
    throw new HttpError(
      500,
      'Failed to load calendar month',
      'CALENDAR_MONTH_QUERY_FAILED',
    )
  }

  const days = data.map((row) => {
    if (!row.due_on) {
      throw new HttpError(
        500,
        'Missing due_on value in calendar aggregation',
        'CALENDAR_MONTH_ROW_INVALID',
      )
    }

    return {
      date: row.due_on,
      count: row.count ?? 0,
    }
  })

  return {
    month,
    days,
  }
}

