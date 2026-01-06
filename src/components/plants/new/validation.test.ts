import { describe, expect, it } from 'vitest'

import type { CreatePlantFormValues } from './types'
import { sanitizeCreatePlantValues, validateCreatePlant } from './validation'

const buildValues = (overrides: Partial<CreatePlantFormValues> = {}): CreatePlantFormValues => ({
  species_name: 'Epipremnum aureum',
  nickname: '',
  description: '',
  purchase_date: '',
  generate_watering_suggestion: true,
  ...overrides,
})

describe('validateCreatePlant', () => {
  it('requires species_name', () => {
    const result = validateCreatePlant(buildValues({ species_name: '   ' }))
    expect(result.fieldErrors.species_name).toBeDefined()
  })

  it('rejects nickname longer than 80 characters', () => {
    const nickname = 'a'.repeat(81)
    const result = validateCreatePlant(buildValues({ nickname }))
    expect(result.fieldErrors.nickname?.[0]).toContain('80')
  })

  it('validates ISO date format', () => {
    const result = validateCreatePlant(buildValues({ purchase_date: '2024-13-40' }))
    expect(result.fieldErrors.purchase_date?.[0]).toContain('RRRR-MM-DD')
  })
})

describe('sanitizeCreatePlantValues', () => {
  it('trims optional fields to null when empty', () => {
    const sanitized = sanitizeCreatePlantValues(
      buildValues({
        nickname: ' ',
        description: '  ',
        purchase_date: ' ',
      }),
    )
    expect(sanitized.nickname).toBeNull()
    expect(sanitized.description).toBeNull()
    expect(sanitized.purchase_date).toBeNull()
  })

  it('keeps valid ISO date intact', () => {
    const sanitized = sanitizeCreatePlantValues(buildValues({ purchase_date: '2024-02-10' }))
    expect(sanitized.purchase_date).toBe('2024-02-10')
  })
})
