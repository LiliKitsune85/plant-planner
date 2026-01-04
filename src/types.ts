import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from './db/database.types'

type AiRequestRow = Tables<'ai_requests'>
type PlantRow = Tables<'plants'>
type ProfileRow = Tables<'profiles'>
type WateringPlanRow = Tables<'watering_plans'>
type WateringTaskRow = Tables<'watering_tasks'>

type IsoDate = WateringTaskRow['due_on']
type IsoDateTime = PlantRow['created_at']

type WateringPlanConfigFields = Pick<
  WateringPlanRow,
  | 'interval_days'
  | 'horizon_days'
  | 'schedule_basis'
  | 'start_from'
  | 'custom_start_on'
  | 'overdue_policy'
>

type WateringPlanAiMetaFields = Pick<
  WateringPlanRow,
  'was_ai_suggested' | 'was_ai_accepted_without_changes' | 'ai_request_id'
>

type WateringPlanStateFields = Pick<
  WateringPlanRow,
  'id' | 'is_active' | 'valid_from' | 'valid_to'
>

type WateringPlanSummaryFields = WateringPlanStateFields &
  WateringPlanConfigFields &
  WateringPlanAiMetaFields

type WateringTaskSummaryFields = Pick<
  WateringTaskRow,
  'id' | 'due_on' | 'status' | 'source' | 'note' | 'completed_at' | 'completed_on'
>

// Cursor pagination metadata (e.g., next_cursor) lives in the response meta envelope.
export type PaginatedListDto<TItem> = {
  items: TItem[]
}

export type DeletionResultDto<IdType> = {
  deleted: true
  target_id?: IdType
}

export type AuthUserSummary = {
  id: ProfileRow['user_id']
  email: string
}

export type ProfileDto = Pick<ProfileRow, 'user_id' | 'nickname' | 'timezone'>

export type SignUpCommand = {
  email: string
  password: string
} & Pick<ProfileRow, 'timezone'> &
  Partial<Pick<ProfileRow, 'nickname'>>

export type SignUpResultDto = {
  user: AuthUserSummary
  profile: ProfileDto
}

export type SignInCommand = {
  email: string
  password: string
}

export type SignInResultDto = {
  access_token: string
  refresh_token: string
  expires_in: number
}

export type MeResponseDto = {
  user: AuthUserSummary
  profile: ProfileDto
}

export type UpdateProfileCommand = Partial<
  Pick<ProfileRow, 'nickname' | 'timezone'>
>

export type PlantSummaryDto = Pick<
  PlantRow,
  | 'id'
  | 'species_name'
  | 'duplicate_index'
  | 'nickname'
  | 'description'
  | 'purchase_date'
  | 'photo_path'
  | 'created_source'
  | 'created_at'
  | 'updated_at'
> & {
  display_name: string
}

export type PlantListItemDto = PlantSummaryDto

export type PlantListDto = PaginatedListDto<PlantListItemDto>

export type CreatePlantCommand = Pick<
  TablesInsert<'plants'>,
  'species_name' | 'nickname' | 'description' | 'purchase_date' | 'photo_path'
> & {
  generate_watering_suggestion?: boolean
}

type WateringSuggestionBase = {
  ai_request_id: AiRequestRow['id']
}

type WateringSuggestionAvailable = WateringSuggestionBase &
  WateringPlanConfigFields & {
    status: 'available'
    explanation: string
  }

type WateringSuggestionRateLimited = WateringSuggestionBase & {
  status: 'rate_limited'
  unlock_at: AiRequestRow['requested_at']
}

type WateringSuggestionError = {
  status: 'error' | 'skipped'
  ai_request_id: AiRequestRow['id'] | null
  explanation?: string | null
}

export type WateringSuggestionForCreationDto =
  | WateringSuggestionAvailable
  | WateringSuggestionRateLimited
  | WateringSuggestionError

export type CreatePlantResultDto = {
  plant: PlantSummaryDto
  watering_suggestion: WateringSuggestionForCreationDto
}

type PlantDetailCore = Pick<
  PlantRow,
  'id' | 'species_name' | 'duplicate_index' | 'nickname' | 'description' | 'purchase_date' | 'photo_path'
> & {
  display_name: string
}

export type PlantDetailDto = {
  plant: PlantDetailCore
  active_watering_plan: WateringPlanSummaryDto | null
}

export type UpdatePlantCommand = Partial<
  Pick<TablesUpdate<'plants'>, 'nickname' | 'description' | 'purchase_date' | 'photo_path'>
>

export type DeletePlantResultDto = DeletionResultDto<PlantRow['id']> & {
  plant_id: PlantRow['id']
}

export type PlantPhotoUploadCommand = {
  content_type: string
  filename: string
}

export type PlantPhotoUploadResultDto = {
  upload: {
    method: 'PUT'
    url: string
    headers: Record<string, string>
    expires_in: number
  }
  photo_path: NonNullable<PlantRow['photo_path']>
}

export type AiQuotaDto = {
  limit_per_hour: number
  used_in_current_window: number
  remaining: number
  window_resets_at: AiRequestRow['requested_at']
  is_rate_limited: boolean
  unlock_at: AiRequestRow['requested_at'] | null
}

export type SuggestWateringPlanCommand = {
  context: Pick<PlantRow, 'species_name'>
}

export type WateringPlanSuggestionDto = {
  ai_request_id: AiRequestRow['id']
  suggestion: WateringPlanConfigFields | null
  explanation?: string | null
}

export type WateringPlanSummaryDto = Pick<
  WateringPlanSummaryFields,
  | 'id'
  | 'is_active'
  | 'valid_from'
  | 'valid_to'
  | 'interval_days'
  | 'horizon_days'
  | 'schedule_basis'
  | 'start_from'
  | 'custom_start_on'
  | 'overdue_policy'
  | 'was_ai_suggested'
  | 'was_ai_accepted_without_changes'
  | 'ai_request_id'
>

export type WateringPlanHistoryItemDto = WateringPlanSummaryDto

export type WateringPlanSourceCommand =
  | {
      type: 'ai'
      ai_request_id: AiRequestRow['id']
      accepted_without_changes: boolean
    }
  | {
      type: 'manual'
      ai_request_id?: null
      accepted_without_changes?: never
    }

export type SetWateringPlanCommand = WateringPlanConfigFields & {
  source: WateringPlanSourceCommand
}

export type TasksRegeneratedSummary = {
  from: IsoDate
  to: IsoDate
  count: number
}

export type SetWateringPlanResultDto = {
  plan: WateringPlanSummaryDto
  tasks_regenerated: TasksRegeneratedSummary
}

export type CalendarMonthDayDto = {
  date: IsoDate
  count: number
}

export type CalendarMonthResponseDto = {
  month: string
  days: CalendarMonthDayDto[]
}

export type CalendarTaskPlantDto = Pick<PlantRow, 'id' | 'nickname'> & {
  display_name: string
}

export type CalendarTaskSummaryDto = {
  task: WateringTaskSummaryFields
  plant: CalendarTaskPlantDto
}

export type CalendarDayResponseDto = {
  date: IsoDate
  items: CalendarTaskSummaryDto[]
}

export type WateringTaskListItemDto = Pick<
  WateringTaskRow,
  | 'id'
  | 'plant_id'
  | 'plan_id'
  | 'due_on'
  | 'status'
  | 'source'
  | 'note'
  | 'completed_at'
  | 'completed_on'
  | 'created_at'
  | 'updated_at'
>

export type WateringTaskListDto = PaginatedListDto<WateringTaskListItemDto>

export type UpdateWateringTaskCommand = Partial<
  Pick<WateringTaskRow, 'status' | 'completed_on' | 'note'>
>

export type ScheduleEffectDto = {
  tasks_regenerated: boolean
  reason: string | null
}

export type UpdateWateringTaskResultDto = {
  task: WateringTaskSummaryFields
  schedule_effect: ScheduleEffectDto
}

export type AdhocWateringCommand = Pick<
  WateringTaskRow,
  'completed_on' | 'note'
>

export type AdhocWateringResultDto = {
  task: WateringTaskSummaryFields & Pick<WateringTaskRow, 'plant_id'>
}

export type DeleteWateringTaskResultDto =
  DeletionResultDto<WateringTaskRow['id']> & {
    task_id: WateringTaskRow['id']
  }

export type AccountDeleteIntentCommand = {
  password: string
  confirmation: string
}

export type AccountDeleteIntentResultDto = {
  intent_id: string
  expires_at: ProfileRow['created_at']
}

export type AccountDeletionResultDto = DeletionResultDto<ProfileRow['user_id']>
