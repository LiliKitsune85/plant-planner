import type { CalendarDayResponseDto, CalendarTaskSummaryDto } from '@/types'

import type {
  CalendarTaskSortField,
  CalendarTaskStatusFilter,
  SortOrder,
} from './types'
import {
  CALENDAR_STATUS_LABELS,
  CalendarStatusFilterOption,
  CalendarMonthErrorVm,
  buildStatusFilterOptions,
  defaultDayHrefBuilder,
  defaultMonthHrefBuilder,
  isValidIsoDateString,
  normalizeCalendarStatusFilter,
} from './month-view-model'
import { CalendarDayApiError } from './day-client'

export type CalendarDayVm = {
  date: string
  status: CalendarTaskStatusFilter
  sort: CalendarTaskSortField
  order: SortOrder
  items: CalendarDayTaskVm[]
  hasTasks: boolean
}

export type CalendarDayTaskSource = 'scheduled' | 'adhoc'

export type CalendarDayTaskVm = {
  id: string
  plantId: string
  plantDisplayName: string
  plantNickname?: string | null
  note?: string | null
  status: 'pending' | 'completed'
  source: CalendarDayTaskSource
  sourceLabel: string
  completedOn?: string | null
  isAdhoc: boolean
  isScheduled: boolean
}

export type CalendarDayHeaderVm = {
  date: string
  dateLabel: string
  weekdayLabel: string
  monthHref: string
}

export type CalendarDayErrorVm = CalendarMonthErrorVm

export type CalendarDaySortOption = {
  value: CalendarTaskSortField
  label: string
  href: string
  isActive: boolean
}

export type CalendarDayOrderOption = {
  value: SortOrder
  label: string
  href: string
  isActive: boolean
}

const locale = 'pl-PL'

const dateFormatter = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const weekdayFormatter = new Intl.DateTimeFormat(locale, {
  weekday: 'long',
})

const formatIsoDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const sortLabels: Record<CalendarTaskSortField, string> = {
  due_on: 'Termin',
  species_name: 'Gatunek',
}

const orderLabels: Record<SortOrder, string> = {
  asc: 'Rosnąco',
  desc: 'Malejąco',
}

const toTaskSource = (value: string): CalendarDayTaskSource =>
  value === 'adhoc' ? 'adhoc' : 'scheduled'

const taskSourceLabels: Record<CalendarDayTaskSource, string> = {
  scheduled: 'Zaplanowane',
  adhoc: 'Ad hoc',
}

const toTaskVm = (item: CalendarTaskSummaryDto): CalendarDayTaskVm => {
  const source = toTaskSource(item.task.source)
  const isAdhoc = source === 'adhoc'
  return {
    id: item.task.id,
    plantId: item.plant.id,
    plantDisplayName: item.plant.display_name,
    plantNickname: item.plant.nickname,
    note: item.task.note,
    status: item.task.status,
    source,
    sourceLabel: taskSourceLabels[source],
    completedOn: item.task.completed_on,
    isAdhoc,
    isScheduled: !isAdhoc,
  }
}

const extractFieldErrors = (
  details: unknown,
): Record<string, string[]> | undefined => {
  if (!details || typeof details !== 'object') return undefined
  const maybeFields = (details as { fields?: unknown }).fields
  if (!maybeFields || typeof maybeFields !== 'object') return undefined
  const result: Record<string, string[]> = {}
  for (const [field, messages] of Object.entries(maybeFields)) {
    if (!Array.isArray(messages)) continue
    const filtered = messages.filter(
      (message): message is string => typeof message === 'string',
    )
    if (filtered.length > 0) {
      result[field] = filtered
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export const buildCalendarDayVm = (
  dto: CalendarDayResponseDto,
  status: CalendarTaskStatusFilter,
  sort: CalendarTaskSortField,
  order: SortOrder,
): CalendarDayVm => ({
  date: dto.date,
  status,
  sort,
  order,
  items: dto.items.map(toTaskVm),
  hasTasks: dto.items.length > 0,
})

export const buildCalendarDayHeaderVm = (
  vm: CalendarDayVm,
  statusForMonthLink?: CalendarTaskStatusFilter,
): CalendarDayHeaderVm => {
  const parsed = new Date(`${vm.date}T00:00:00`)
  const month = vm.date.slice(0, 7)
  const safeStatus = statusForMonthLink ?? vm.status
  return {
    date: vm.date,
    dateLabel: dateFormatter.format(parsed),
    weekdayLabel: weekdayFormatter.format(parsed),
    monthHref: defaultMonthHrefBuilder(month, safeStatus),
  }
}

export const buildCalendarDayStatusFilterOptions = (
  vm: CalendarDayVm,
  dayHrefBuilder: typeof defaultDayHrefBuilder = defaultDayHrefBuilder,
): CalendarStatusFilterOption[] =>
  buildStatusFilterOptions(vm.status, (status) =>
    dayHrefBuilder(vm.date, status, vm.sort, vm.order),
  )

export const buildCalendarDaySortOptions = (
  vm: CalendarDayVm,
  dayHrefBuilder: typeof defaultDayHrefBuilder = defaultDayHrefBuilder,
): CalendarDaySortOption[] =>
  sortValues.map((value) => ({
    value,
    label: sortLabels[value],
    href: dayHrefBuilder(vm.date, vm.status, value, vm.order),
    isActive: vm.sort === value,
  }))

export const buildCalendarDayOrderOptions = (
  vm: CalendarDayVm,
  dayHrefBuilder: typeof defaultDayHrefBuilder = defaultDayHrefBuilder,
): CalendarDayOrderOption[] =>
  orderValues.map((value) => ({
    value,
    label: orderLabels[value],
    href: dayHrefBuilder(vm.date, vm.status, vm.sort, value),
    isActive: vm.order === value,
  }))

export const buildCalendarDayErrorVm = (
  error: CalendarDayApiError,
): CalendarDayErrorVm => ({
  kind: error.kind,
  message: error.message,
  code: error.code,
  requestId: error.requestId,
  fieldErrors: error.kind === 'validation' ? extractFieldErrors(error.details) : undefined,
})

export const buildCalendarDayValidationErrorVm = (value: string): CalendarDayErrorVm => ({
  kind: 'validation',
  message: 'Niepoprawna data. Użyj formatu RRRR-MM-DD.',
  code: 'VALIDATION_ERROR',
  fieldErrors: {
    date: [`Niepoprawna wartość: ${value || 'brak'}`],
  },
})

export const normalizeCalendarDayStatus = (
  status?: CalendarTaskStatusFilter,
): CalendarTaskStatusFilter => normalizeCalendarStatusFilter(status, 'all')

const sortValues: CalendarTaskSortField[] = ['species_name', 'due_on']
export const normalizeCalendarDaySort = (
  sort?: CalendarTaskSortField,
): CalendarTaskSortField =>
  sort && sortValues.includes(sort) ? sort : 'due_on'

const orderValues: SortOrder[] = ['asc', 'desc']
export const normalizeCalendarDayOrder = (order?: SortOrder): SortOrder =>
  order && orderValues.includes(order) ? order : 'asc'

export const isValidCalendarDate = (value: string): boolean => isValidIsoDateString(value)

export const getTodayCalendarDate = (): string => formatIsoDate(new Date())

export const getCalendarStatusLabel = (status: CalendarTaskStatusFilter): string =>
  CALENDAR_STATUS_LABELS[status]
