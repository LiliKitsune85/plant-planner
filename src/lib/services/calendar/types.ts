export type CalendarTaskStatusFilter = "pending" | "completed" | "all";

export type CalendarTaskSortField = "species_name" | "due_on";

export type SortOrder = "asc" | "desc";

export interface GetCalendarDayFilters {
  date: string;
  status: CalendarTaskStatusFilter;
  sort: CalendarTaskSortField;
  order: SortOrder;
}

export type GetCalendarDayQuery = GetCalendarDayFilters & {
  userId: string;
};

export interface GetCalendarMonthFilters {
  month: string;
  status: CalendarTaskStatusFilter;
}

export type GetCalendarMonthQuery = GetCalendarMonthFilters & {
  userId: string;
};
