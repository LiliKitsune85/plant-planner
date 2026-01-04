import type { CalendarMonthResponseDto } from '@/types'
import type {
  CalendarTaskStatusFilter,
  CalendarTaskSortField,
  SortOrder,
} from './types'
import { CalendarMonthApiError } from './month-client'

export type CalendarMonthVm = {
  month: string
  status: CalendarTaskStatusFilter
  daysByDate: Record<string, number>
  hasAnyTasks: boolean
}

export type CalendarMonthGridDayVm = {
  date: string
  dayNumber: number
  count: number
  isInCurrentMonth: boolean
  isToday: boolean
  ariaLabel: string
  href: string
}

export type CalendarMonthGridWeekVm = {
  days: CalendarMonthGridDayVm[]
}

export type CalendarMonthGridVm = {
  month: string
  weeks: CalendarMonthGridWeekVm[]
  weekdayLabels: string[]
}

export type CalendarMonthErrorVm = {
  kind:
    | 'validation'
    | 'unauthenticated'
    | 'http'
    | 'network'
    | 'parse'
    | 'unknown'
  message: string
  code?: string
  requestId?: string
  fieldErrors?: Record<string, string[]>
}

export type MonthPickerVmLink = {
  label: string
  month: string
  href: string
}

export type MonthPickerVm = {
  currentMonth: string
  currentLabel: string
  prev: MonthPickerVmLink
  next: MonthPickerVmLink
  today: MonthPickerVmLink & { isCurrentMonth: boolean }
}

export type CalendarStatusFilterOption = {
  value: CalendarTaskStatusFilter
  label: string
  href: string
  isActive: boolean
}

export const CALENDAR_STATUS_VALUES: CalendarTaskStatusFilter[] = [
  'pending',
  'completed',
  'all',
] as const

export const CALENDAR_STATUS_LABELS: Record<CalendarTaskStatusFilter, string> = {
  pending: 'Do zrobienia',
  completed: 'Ukończone',
  all: 'Wszystkie',
}

const calendarMonthRegex = /^\d{4}-(0[1-9]|1[0-2])$/
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

const weekdayFormatter = (locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short' })
const monthFormatter = (locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })

const defaultLocale = 'pl-PL'

const pad = (value: number): string => value.toString().padStart(2, '0')

const formatIsoDate = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())
  return `${year}-${month}-${day}`
}

const formatLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

const toCount = (value: number | null | undefined): number =>
  Number.isFinite(value) && (value as number) > 0 ? Math.floor(value as number) : 0

const parseCalendarMonth = (
  month: string,
): { year: number; monthIndex: number } | null => {
  if (!isValidCalendarMonthString(month)) return null
  const [yearPart, monthPart] = month.split('-')
  const year = Number.parseInt(yearPart, 10)
  const monthIndex = Number.parseInt(monthPart, 10) - 1
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null
  return { year, monthIndex }
}

const shiftMonth = (month: string, delta: number): string => {
  const parsed = parseCalendarMonth(month)
  if (!parsed) return month
  const date = new Date(Date.UTC(parsed.year, parsed.monthIndex, 1))
  date.setUTCMonth(date.getUTCMonth() + delta)
  return formatIsoDate(date).slice(0, 7)
}

export const defaultMonthHrefBuilder = (
  month: string,
  status: CalendarTaskStatusFilter,
): string => {
  const base = `/calendar/${month}`
  return status === 'pending' ? base : `${base}?status=${status}`
}

export const defaultDayHrefBuilder = (
  date: string,
  status: CalendarTaskStatusFilter,
  sort: CalendarTaskSortField = 'due_on',
  order: SortOrder = 'asc',
): string => {
  const base = `/calendar/day/${date}`
  const params = new URLSearchParams()
  if (status !== 'pending') {
    params.set('status', status)
  }
  if (sort !== 'due_on') {
    params.set('sort', sort)
  }
  if (order !== 'asc') {
    params.set('order', order)
  }
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

const buildAriaLabel = (date: string, count: number): string => {
  if (count > 0) {
    const suffix = count === 1 ? 'podlewanie do wykonania' : 'podlewania do wykonania'
    return `${date} — ${count} ${suffix}`
  }
  return `${date} — brak zadań`
}

const extractFieldErrors = (
  details: unknown,
): Record<string, string[]> | undefined => {
  if (!details || typeof details !== 'object') return undefined
  const maybeFields = (details as { fields?: unknown }).fields
  if (!maybeFields || typeof maybeFields !== 'object') return undefined
  const result: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(maybeFields)) {
    if (!Array.isArray(value)) continue
    const filtered = value.filter((entry): entry is string => typeof entry === 'string')
    if (filtered.length > 0) {
      result[key] = filtered
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export const isValidCalendarMonthString = (value: string): boolean =>
  calendarMonthRegex.test(value)

export const isValidIsoDateString = (value: string): boolean => isoDateRegex.test(value)

export const normalizeCalendarStatusFilter = (
  status?: CalendarTaskStatusFilter,
  defaultValue: CalendarTaskStatusFilter = 'pending',
): CalendarTaskStatusFilter =>
  status && CALENDAR_STATUS_VALUES.includes(status) ? status : defaultValue

export const buildStatusFilterOptions = (
  currentStatus: CalendarTaskStatusFilter,
  hrefBuilder: (status: CalendarTaskStatusFilter) => string,
): CalendarStatusFilterOption[] =>
  CALENDAR_STATUS_VALUES.map((value) => ({
    value,
    label: CALENDAR_STATUS_LABELS[value],
    href: hrefBuilder(value),
    isActive: value === currentStatus,
  }))

export const getCalendarMonthCacheKey = (
  month: string,
  status: CalendarTaskStatusFilter,
): string => `${month}:${status}`

export const buildCalendarMonthVm = (
  dto: CalendarMonthResponseDto,
  status: CalendarTaskStatusFilter,
): CalendarMonthVm => {
  const daysByDate: Record<string, number> = {}

  for (const day of dto.days ?? []) {
    if (!day?.date || !isValidIsoDateString(day.date)) continue
    daysByDate[day.date] = toCount(day.count)
  }

  const hasAnyTasks = Object.values(daysByDate).some((count) => count > 0)

  return {
    month: dto.month,
    status,
    daysByDate,
    hasAnyTasks,
  }
}

type BuildCalendarMonthGridOptions = {
  locale?: string
  todayIsoDate?: string
  dayHrefBuilder?: (date: string, status: CalendarTaskStatusFilter) => string
}

export const buildCalendarMonthGridVm = (
  vm: CalendarMonthVm,
  options: BuildCalendarMonthGridOptions = {},
): CalendarMonthGridVm => {
  const locale = options.locale ?? defaultLocale
  const dayHrefBuilder = options.dayHrefBuilder ?? defaultDayHrefBuilder
  const todayIsoDate = options.todayIsoDate ?? formatLocalIsoDate(new Date())

  const parsed = parseCalendarMonth(vm.month)
  if (!parsed) {
    throw new Error(`Invalid calendar month: ${vm.month}`)
  }

  const weekdayLabels = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(Date.UTC(2023, 0, 2 + index)) // 2023-01-02 is Monday
    return weekdayFormatter(locale).format(date)
  })

  const firstDayOfMonth = new Date(Date.UTC(parsed.year, parsed.monthIndex, 1))
  const firstWeekday = (firstDayOfMonth.getUTCDay() + 6) % 7 // Monday = 0
  const gridStartDate = new Date(firstDayOfMonth)
  gridStartDate.setUTCDate(firstDayOfMonth.getUTCDate() - firstWeekday)

  const weeks: CalendarMonthGridWeekVm[] = []

  for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
    const days: CalendarMonthGridDayVm[] = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const offset = weekIndex * 7 + dayIndex
      const cellDate = new Date(gridStartDate)
      cellDate.setUTCDate(gridStartDate.getUTCDate() + offset)

      const isoDate = formatIsoDate(cellDate)
      const count = vm.daysByDate[isoDate] ?? 0
      const isInCurrentMonth = cellDate.getUTCMonth() === parsed.monthIndex
      const isToday = isoDate === todayIsoDate

      days.push({
        date: isoDate,
        dayNumber: cellDate.getUTCDate(),
        count,
        isInCurrentMonth,
        isToday,
        ariaLabel: buildAriaLabel(isoDate, count),
        href: dayHrefBuilder(isoDate, vm.status),
      })
    }

    weeks.push({ days })
  }

  return {
    month: vm.month,
    weeks,
    weekdayLabels,
  }
}

type BuildMonthPickerVmOptions = {
  locale?: string
  todayMonth?: string
  monthHrefBuilder?: (month: string, status: CalendarTaskStatusFilter) => string
}

export const buildMonthPickerVm = (
  vm: CalendarMonthVm,
  options: BuildMonthPickerVmOptions = {},
): MonthPickerVm => {
  const locale = options.locale ?? defaultLocale
  const monthHrefBuilder = options.monthHrefBuilder ?? defaultMonthHrefBuilder
  const todayMonth = options.todayMonth ?? getTodayCalendarMonth()

  const currentLabel = monthFormatter(locale).format(
    new Date(`${vm.month}-01T00:00:00.000Z`),
  )

  const prevMonth = shiftMonth(vm.month, -1)
  const nextMonth = shiftMonth(vm.month, 1)

  return {
    currentMonth: vm.month,
    currentLabel,
    prev: {
      label: monthFormatter(locale).format(new Date(`${prevMonth}-01T00:00:00.000Z`)),
      month: prevMonth,
      href: monthHrefBuilder(prevMonth, vm.status),
    },
    next: {
      label: monthFormatter(locale).format(new Date(`${nextMonth}-01T00:00:00.000Z`)),
      month: nextMonth,
      href: monthHrefBuilder(nextMonth, vm.status),
    },
    today: {
      label: monthFormatter(locale).format(
        new Date(`${todayMonth}-01T00:00:00.000Z`),
      ),
      month: todayMonth,
      href: monthHrefBuilder(todayMonth, vm.status),
      isCurrentMonth: todayMonth === vm.month,
    },
  }
}

type BuildCalendarMonthStatusFilterOptions = {
  monthHrefBuilder?: (month: string, status: CalendarTaskStatusFilter) => string
}

export const buildCalendarMonthStatusFilterOptions = (
  vm: CalendarMonthVm,
  options: BuildCalendarMonthStatusFilterOptions = {},
): CalendarStatusFilterOption[] => {
  const monthHrefBuilder = options.monthHrefBuilder ?? defaultMonthHrefBuilder
  return buildStatusFilterOptions(vm.status, (status) =>
    monthHrefBuilder(vm.month, status),
  )
}

export const buildCalendarMonthErrorVm = (
  error: CalendarMonthApiError,
): CalendarMonthErrorVm => ({
  kind: error.kind,
  message: error.message,
  code: error.code,
  requestId: error.requestId,
  fieldErrors:
    error.kind === 'validation' ? extractFieldErrors(error.details) : undefined,
})

export const buildClientValidationErrorVm = (
  month: string,
): CalendarMonthErrorVm => ({
  kind: 'validation',
  message: 'Niepoprawny miesiąc. Użyj formatu RRRR-MM.',
  code: 'VALIDATION_ERROR',
  fieldErrors: {
    month: [`Niepoprawna wartość: ${month}`],
  },
})

export const getTodayCalendarMonth = (): string => {
  const today = new Date()
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}`
}
