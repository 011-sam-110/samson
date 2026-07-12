import { describe, it, expect } from 'vitest'
import { CATEGORIES, typeOf, categoryLabel, LEGACY_TYPE_TO_CATEGORY } from './categories.js'

describe('categories', () => {
  it('every category has a key, label and valid type', () => {
    expect(CATEGORIES.length).toBeGreaterThan(0)
    for (const c of CATEGORIES) {
      expect(c.key).toMatch(/^[a-z_]+$/)
      expect(typeof c.label).toBe('string')
      expect(['fixed', 'variable', 'discretionary']).toContain(c.type)
    }
  })

  it('typeOf maps a student category to its engine type', () => {
    expect(typeOf('rent')).toBe('fixed')
    expect(typeOf('groceries')).toBe('variable')
    expect(typeOf('going_out')).toBe('discretionary')
  })

  it('typeOf passes legacy type values straight through', () => {
    expect(typeOf('fixed')).toBe('fixed')
    expect(typeOf('variable')).toBe('variable')
    expect(typeOf('discretionary')).toBe('discretionary')
  })

  it('typeOf defaults unknown categories to discretionary (still counts in run-rate)', () => {
    expect(typeOf('made_up')).toBe('discretionary')
    expect(typeOf(undefined)).toBe('discretionary')
  })

  it('categoryLabel returns the friendly label, with a sane fallback', () => {
    expect(categoryLabel('eating_out')).toBe('Eating out')
    expect(categoryLabel('variable')).toBe('Variable')
    expect(categoryLabel('nonsense')).toBe('Spend')
  })

  it('legacy tags map to a real category for migration', () => {
    expect(LEGACY_TYPE_TO_CATEGORY.fixed).toBe('bills')
    expect(LEGACY_TYPE_TO_CATEGORY.variable).toBe('groceries')
    expect(LEGACY_TYPE_TO_CATEGORY.discretionary).toBe('other')
  })
})
