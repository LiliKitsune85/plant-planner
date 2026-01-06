import { useCallback, useEffect, useRef, useState } from 'react'

import type { PlantDetailDto, UpdatePlantCommand } from '@/types'
import { PlantsApiError, updatePlant } from '@/lib/services/plants/plants-client'

import { mergePlantEditFieldErrorsFromDetails } from '../plants/edit/form-helpers'
import type { PlantEditFormErrors } from '../plants/edit/types'

type UseUpdatePlantArgs = {
  plantId: string
}

type UpdatePlantSubmitOptions = {
  baseFieldErrors?: PlantEditFormErrors['fields']
}

type UpdatePlantSuccessResult = {
  ok: true
  data: PlantDetailDto
}

type UpdatePlantAbortedResult = {
  ok: false
  kind: 'aborted'
}

type UpdatePlantFailureResult = {
  ok: false
  kind: 'validation' | 'api'
  formError: string
  fieldErrors: PlantEditFormErrors['fields']
  code?: string
  requestId?: string
}

export type UpdatePlantSubmitResult =
  | UpdatePlantSuccessResult
  | UpdatePlantFailureResult
  | UpdatePlantAbortedResult

export type UseUpdatePlantResult = {
  isSaving: boolean
  submit: (
    payload: UpdatePlantCommand,
    options?: UpdatePlantSubmitOptions,
  ) => Promise<UpdatePlantSubmitResult>
  cancel: () => void
}

const DEFAULT_FORM_ERROR = 'Nie udało się zapisać zmian. Spróbuj ponownie później.'

export const useUpdatePlant = ({ plantId }: UseUpdatePlantArgs): UseUpdatePlantResult => {
  const [isSaving, setIsSaving] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const submit = useCallback(
    async (
      payload: UpdatePlantCommand,
      options: UpdatePlantSubmitOptions = {},
    ): Promise<UpdatePlantSubmitResult> => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsSaving(true)

      try {
        const { data } = await updatePlant({ plantId, payload }, { signal: controller.signal })
        return { ok: true, data }
      } catch (error) {
        if (controller.signal.aborted) {
          return { ok: false, kind: 'aborted' }
        }

        if (error instanceof PlantsApiError) {
          const isValidation = error.kind === 'validation' || error.code === 'IMMUTABLE_FIELD'
          const fieldErrors = isValidation
            ? mergePlantEditFieldErrorsFromDetails(options.baseFieldErrors ?? {}, error.details)
            : options.baseFieldErrors ?? {}

          return {
            ok: false,
            kind: isValidation ? 'validation' : 'api',
            formError: error.message ?? DEFAULT_FORM_ERROR,
            fieldErrors,
            code: error.code,
            requestId: error.requestId,
          }
        }

        console.error('Unexpected error while updating plant', error)
        return {
          ok: false,
          kind: 'api',
          formError: DEFAULT_FORM_ERROR,
          fieldErrors: options.baseFieldErrors ?? {},
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSaving(false)
        }
      }
    },
    [plantId],
  )

  return { isSaving, submit, cancel }
}

useUpdatePlant.displayName = 'useUpdatePlant'
