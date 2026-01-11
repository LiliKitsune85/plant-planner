import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn utility', () => {
  it('merges class names and filters falsy values', () => {
    const result = cn('p-4', undefined, 'text-sm', null && 'hidden')
    expect(result).toBe('p-4 text-sm')
  })

  it('prefers the last conflicting Tailwind class', () => {
    const result = cn('p-2', 'p-4', ['text-xs', ['text-base']])
    expect(result).toBe('p-4 text-base')
  })

  it('handles conditional objects from clsx inputs', () => {
    const result = cn({ hidden: false, flex: true }, 'items-center')
    expect(result).toBe('flex items-center')
  })
})
