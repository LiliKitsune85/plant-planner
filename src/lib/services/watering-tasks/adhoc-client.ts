import type { AdhocWateringCommand, AdhocWateringResultDto } from '../../../types'

import { requestWateringTaskApi } from './watering-task-client'

type CreateAdhocWateringOptions = {
  signal?: AbortSignal
}

type CreateAdhocWateringPayload = Pick<AdhocWateringCommand, 'completed_on' | 'note'>

export const createAdhocWateringEntry = async (
  plantId: string,
  payload: CreateAdhocWateringPayload,
  options: CreateAdhocWateringOptions = {},
): Promise<{ data: AdhocWateringResultDto; requestId?: string }> =>
  requestWateringTaskApi<AdhocWateringResultDto>(
    `/api/plants/${plantId}/watering/adhoc`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal,
    },
  )

