import type { WateringTaskListItemDto } from '../../../types'

export type WateringTaskSortField = 'due_on' | 'created_at'

export type WateringTaskSortOrder = 'asc' | 'desc'

export type WateringTaskStatusFilter = 'pending' | 'completed'

export type WateringTaskSourceFilter = 'scheduled' | 'adhoc'

export type GetWateringTasksFilters = {
  from?: string
  to?: string
  plantId?: string
  status?: WateringTaskStatusFilter
  source?: WateringTaskSourceFilter
  sort: WateringTaskSortField
  order: WateringTaskSortOrder
  limit: number
  cursor?: string
}

export type GetWateringTasksQuery = GetWateringTasksFilters & {
  userId: string
}

export type ListWateringTasksResult = {
  items: WateringTaskListItemDto[]
  nextCursor: string | null
}

export type ListWateringTasksCursorFiltersSnapshot = {
  from: string | null
  to: string | null
  plantId: string | null
  status: WateringTaskStatusFilter | null
  source: WateringTaskSourceFilter | null
  limit: number
}

export type ListWateringTasksCursorPayload = {
  userId: string
  sort: WateringTaskSortField
  order: WateringTaskSortOrder
  sortValue: string
  id: string
  filters: ListWateringTasksCursorFiltersSnapshot
}

export type ListWateringTasksCursorContext = {
  userId: string
  sort: WateringTaskSortField
  order: WateringTaskSortOrder
  filters: ListWateringTasksCursorFiltersSnapshot
}

export type ListWateringTasksServiceContext = {
  requestId?: string
}
