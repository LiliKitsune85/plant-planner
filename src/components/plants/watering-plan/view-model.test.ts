import { describe, expect, it } from 'vitest'

import { SetWateringPlanApiError } from '@/lib/services/watering-plans/set-plan-client'

import type { WateringPlanFormValues, WateringPlanSourceVm } from './types'
import { buildSetPlanErrorVm, sanitizeFormToSetCommand, validateWateringPlanForm } from './view-model'

const baseValues: WateringPlanFormValues = {
  interval_days: '7',
  start_from: 'today',
  custom_start_on: '',
  horizon_days: '90',
  schedule_basis: 'completed_on',
  overdue_policy: 'carry_forward',
}

const manualSource: WateringPlanSourceVm = { type: 'manual' }

describe('sanitizeFormToSetCommand', () => {
  it('keeps custom date when start_from is custom_date', () => {
    const result = sanitizeFormToSetCommand(
      {
        ...baseValues,
        start_from: 'custom_date',
        custom_start_on: '2026-01-15',
      },
      manualSource,
    )

    expect(result.start_from).toBe('custom_date')
    expect(result.custom_start_on).toBe('2026-01-15')
  })

  it('clears custom date when start_from is not custom_date', () => {
    for (const start of ['today', 'purchase_date'] as const) {
      const result = sanitizeFormToSetCommand(
        {
          ...baseValues,
          start_from: start,
          custom_start_on: '2026-01-15',
        },
        manualSource,
      )

      expect(result.start_from).toBe(start)
      expect(result.custom_start_on).toBeNull()
    }
  })

  it('builds AI source metadata when required', () => {
    const aiSource: WateringPlanSourceVm = {
      type: 'ai',
      aiRequestId: 'req-123',
      acceptedWithoutChanges: true,
    }

    const result = sanitizeFormToSetCommand(
      {
        ...baseValues,
        interval_days: '30',
        horizon_days: '120',
      },
      aiSource,
    )

    expect(result.interval_days).toBe(30)
    expect(result.horizon_days).toBe(120)
    expect(result.source).toEqual({
      type: 'ai',
      ai_request_id: 'req-123',
      accepted_without_changes: true,
    })
  })
})

describe('validateWateringPlanForm', () => {
  it('returns no errors for a valid payload', () => {
    const result = validateWateringPlanForm(baseValues)
    expect(result.fieldErrors).toEqual({})
    expect(result.formError).toBeUndefined()
  })

  it('requires custom date when start_from equals custom_date', () => {
    const result = validateWateringPlanForm({
      ...baseValues,
      start_from: 'custom_date',
      custom_start_on: '',
    })

    expect(result.fieldErrors.custom_start_on).toEqual(['Wybierz datę rozpoczęcia.'])
    expect(result.formError).toBeDefined()
  })

  it('rejects custom date when start_from differs', () => {
    const result = validateWateringPlanForm({
      ...baseValues,
      start_from: 'today',
      custom_start_on: '2026-02-01',
    })

    expect(result.fieldErrors.custom_start_on).toEqual([
      'Data niestandardowa jest dostępna tylko przy wyborze opcji „Niestandardowa data”.',
    ])
  })
})

describe('buildSetPlanErrorVm', () => {
  it('maps validation errors with field details', () => {
    const apiError = new SetWateringPlanApiError('VALIDATION_ERROR', 'Invalid form', {
      kind: 'validation',
      details: { fields: { interval_days: ['Zakres dozwolony to 1–365 dni.'] } },
      requestId: 'req-validation',
    })

    const vm = buildSetPlanErrorVm(apiError)
    expect(vm.kind).toBe('validation')
    expect(vm.fieldErrors?.interval_days).toEqual(['Zakres dozwolony to 1–365 dni.'])
    expect(vm.requestId).toBe('req-validation')
  })

  it('maps unauthenticated error', () => {
    const apiError = new SetWateringPlanApiError('UNAUTHENTICATED', 'Please log in', {
      kind: 'unauthenticated',
    })
    const vm = buildSetPlanErrorVm(apiError)
    expect(vm.kind).toBe('unauthenticated')
    expect(vm.message).toBe('Please log in')
  })

  it('falls back to unknown error type', () => {
    const apiError = new SetWateringPlanApiError('HTTP_ERROR', 'Server failed')
    const vm = buildSetPlanErrorVm(apiError)
    expect(vm.kind).toBe('unknown')
    expect(vm.message).toBe('Server failed')
  })
})


