import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  PlantDetailErrorVm,
  PlantDetailVm,
  PlantDetailStatus,
} from '@/components/plants/detail/types'
import {
  buildInvalidPlantIdErrorVm,
  buildMissingPlantIdErrorVm,
  buildPlantDetailErrorVmFromApiError,
  buildUnknownPlantDetailErrorVm,
  isValidPlantId,
  mapPlantDetailDtoToVm,
} from '@/lib/services/plants/detail-view-model'
import { getPlantDetail, PlantsApiError } from '@/lib/services/plants/plants-client'
import type { PlantDetailDto } from '@/types'

export type PlantDetailInitialState = {
  plant?: PlantDetailDto
  viewModel?: PlantDetailVm
  error?: PlantDetailErrorVm
  status?: PlantDetailStatus
}

type UsePlantDetailParams = {
  plantId: string
  initial?: PlantDetailInitialState
}

type UsePlantDetailResult = {
  status: PlantDetailStatus
  plant?: PlantDetailDto
  viewModel?: PlantDetailVm
  error?: PlantDetailErrorVm
  requestId?: string
  reload: () => void
  mutate: (next: PlantDetailDto) => void
}

const normalizeInitialState = (
  input: PlantDetailInitialState | undefined,
  plantId: string,
): PlantDetailInitialState | undefined => {
  if (!input) return undefined
  const hasPlant = Boolean(input.plant)
  const hasError = Boolean(input.error)
  if (!hasPlant && !hasError) return undefined
  if (input.plant && plantId && input.plant.plant.id !== plantId) {
    return undefined
  }
  return input
}

const plantDetailDtoCache = new Map<string, PlantDetailDto>()
const plantDetailVmCache = new Map<string, PlantDetailVm>()
const plantDetailErrorCache = new Map<string, PlantDetailErrorVm>()

export const invalidatePlantDetailCacheById = (plantId: string): void => {
  plantDetailDtoCache.delete(plantId)
  plantDetailVmCache.delete(plantId)
  plantDetailErrorCache.delete(plantId)
}

export const usePlantDetail = ({
  plantId,
  initial,
}: UsePlantDetailParams): UsePlantDetailResult => {
  const normalizedInitial = normalizeInitialState(initial, plantId)
  const initialRef = useRef<PlantDetailInitialState | undefined>(normalizedInitial)

  const getInitialStatus = (): PlantDetailStatus => {
    if (initialRef.current?.status) return initialRef.current.status
    if (initialRef.current?.plant) return 'success'
    if (initialRef.current?.error) return 'error'
    return 'idle'
  }

  const [status, setStatus] = useState<PlantDetailStatus>(getInitialStatus)
  const [plant, setPlant] = useState<PlantDetailDto | undefined>(() => {
    if (initialRef.current?.plant) {
      return initialRef.current.plant
    }
    return plantId ? plantDetailDtoCache.get(plantId) : undefined
  })
  const [viewModel, setViewModel] = useState<PlantDetailVm | undefined>(() => {
    if (initialRef.current?.viewModel && initialRef.current?.plant) {
      return initialRef.current.viewModel
    }
    if (initialRef.current?.plant) {
      return mapPlantDetailDtoToVm(initialRef.current.plant)
    }
    return plantId ? plantDetailVmCache.get(plantId) : undefined
  })
  const [error, setError] = useState<PlantDetailErrorVm | undefined>(() => {
    if (initialRef.current?.error) {
      return initialRef.current.error
    }
    return plantId ? plantDetailErrorCache.get(plantId) : undefined
  })
  const [requestId, setRequestId] = useState<string | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const mutate = useCallback((next: PlantDetailDto) => {
    const vm = mapPlantDetailDtoToVm(next)
    setPlant(next)
    setViewModel(vm)
    setError(undefined)
    setStatus('success')
    setRequestId(undefined)

    const cacheKey = next.plant.id
    plantDetailDtoCache.set(cacheKey, next)
    plantDetailVmCache.set(cacheKey, vm)
    plantDetailErrorCache.delete(cacheKey)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (!plantId) {
      const missingError = buildMissingPlantIdErrorVm()
      setStatus('error')
      setPlant(undefined)
      setViewModel(undefined)
      setRequestId(undefined)
      setError(missingError)
      return
    }

    if (!isValidPlantId(plantId)) {
      const invalidError = buildInvalidPlantIdErrorVm()
      setStatus('error')
      setPlant(undefined)
      setViewModel(undefined)
      setRequestId(undefined)
      setError(invalidError)
      return
    }

    const isInitialRender = reloadToken === 0
    const initialSnapshot = initialRef.current

    if (isInitialRender && initialSnapshot?.plant) {
      const vm = initialSnapshot.viewModel ?? mapPlantDetailDtoToVm(initialSnapshot.plant)
      setPlant(initialSnapshot.plant)
      setViewModel(vm)
      setError(undefined)
      setRequestId(undefined)
      setStatus(initialSnapshot.status ?? 'success')
      if (plantId) {
        plantDetailDtoCache.set(plantId, initialSnapshot.plant)
        plantDetailVmCache.set(plantId, vm)
        plantDetailErrorCache.delete(plantId)
      }
      initialRef.current = undefined
      return
    }

    if (isInitialRender && initialSnapshot?.error) {
      setPlant(undefined)
      setViewModel(undefined)
      setRequestId(undefined)
      setError(initialSnapshot.error)
      setStatus(initialSnapshot.status ?? 'error')
      if (plantId) {
        plantDetailDtoCache.delete(plantId)
        plantDetailVmCache.delete(plantId)
        plantDetailErrorCache.set(plantId, initialSnapshot.error)
      }
      initialRef.current = undefined
      return
    }

    const cachedPlant = plantDetailDtoCache.get(plantId)
    const cachedVm = plantDetailVmCache.get(plantId)
    const cachedError = plantDetailErrorCache.get(plantId)

    if (isInitialRender && cachedPlant) {
      setPlant(cachedPlant)
      setViewModel(cachedVm ?? mapPlantDetailDtoToVm(cachedPlant))
      setError(undefined)
      setRequestId(undefined)
      setStatus('success')
      return
    }

    if (isInitialRender && cachedError) {
      setPlant(undefined)
      setError(cachedError)
      setViewModel(undefined)
      setRequestId(undefined)
      setStatus('error')
      return
    }

    if (cachedPlant) {
      setPlant(cachedPlant)
      setViewModel(cachedVm ?? mapPlantDetailDtoToVm(cachedPlant))
      setStatus('success')
    } else {
      setPlant(undefined)
      setViewModel(undefined)
      setStatus('loading')
    }
    setError(undefined)

    const controller = new AbortController()
    abortRef.current = controller

    const fetchDetail = async () => {
      try {
        const { data, requestId: reqId } = await getPlantDetail(
          { plantId },
          { signal: controller.signal },
        )
        const vm = mapPlantDetailDtoToVm(data)
        plantDetailDtoCache.set(plantId, data)
        plantDetailVmCache.set(plantId, vm)
        plantDetailErrorCache.delete(plantId)
        setPlant(data)
        setViewModel(vm)
        setRequestId(reqId)
        setError(undefined)
        setStatus('success')
      } catch (err) {
        if (controller.signal.aborted) return

        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }

        let mappedError: PlantDetailErrorVm
        if (err instanceof PlantsApiError) {
          mappedError = buildPlantDetailErrorVmFromApiError(err)
        } else {
          console.error('Unexpected error while loading plant detail', err)
          mappedError = buildUnknownPlantDetailErrorVm()
        }

        plantDetailDtoCache.delete(plantId)
        plantDetailVmCache.delete(plantId)
        plantDetailErrorCache.set(plantId, mappedError)
        setPlant(undefined)
        setViewModel(undefined)
        setRequestId(undefined)
        setError(mappedError)
        setStatus('error')
      }
    }

    void fetchDetail()

    return () => {
      controller.abort()
    }
  }, [plantId, reloadToken])

  const reload = useCallback(() => {
    abortRef.current?.abort()
    setReloadToken((token) => token + 1)
  }, [])

  return useMemo(
    () => ({
      status,
      plant,
      viewModel,
      error,
      requestId,
      reload,
      mutate,
    }),
    [status, plant, viewModel, error, requestId, reload, mutate],
  )
}

usePlantDetail.displayName = 'usePlantDetail'
