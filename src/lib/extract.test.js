import { describe, it, expect } from 'vitest'
import { parseTransactions } from './extract.js'

describe('parseTransactions', () => {
  it('parses a clean JSON array', () => {
    const out = parseTransactions('[{"date":"11 Jul","merchant":"Tesco","amount":-34.2}]')
    expect(out).toEqual([{ date: '11 Jul', merchant: 'Tesco', amount: -34.2 }])
  })

  it('strips markdown code fences the model sometimes adds', () => {
    const out = parseTransactions('```json\n[{"date":"1 Jan","merchant":"Netflix","amount":-10.99}]\n```')
    expect(out).toHaveLength(1)
    expect(out[0].merchant).toBe('Netflix')
  })

  it('ignores surrounding prose and grabs the array', () => {
    const out = parseTransactions('Here you go:\n[{"merchant":"Pret","amount":-4.85}]\nHope that helps!')
    expect(out[0]).toMatchObject({ merchant: 'Pret', amount: -4.85 })
  })

  it('drops rows without an amount', () => {
    const out = parseTransactions('[{"merchant":"Tesco","amount":-5},{"merchant":"Broken"}]')
    expect(out).toHaveLength(1)
  })

  it('returns [] on unparseable text', () => {
    expect(parseTransactions('sorry, I cannot read this image')).toEqual([])
    expect(parseTransactions('')).toEqual([])
  })
})
