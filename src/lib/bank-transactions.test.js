import { describe, it, expect } from 'vitest'
import { mapBankTransaction, mapBankTransactions, bankTransactionDedupeKey } from './bank-transactions.js'

describe('mapBankTransaction', () => {
  it('maps an outgoing payment to the ImportSheet row shape with a guessed category', () => {
    const row = mapBankTransaction({ id: 'txn_1', merchant: 'TESCO STORES 2914', amount: -12.5, date: '2026-08-20' })
    expect(row).toEqual({
      merchant: 'TESCO STORES 2914',
      amount: -12.5,
      date: '2026-08-20',
      category: 'groceries',
      include: true,
    })
  })

  it('treats a positive amount as income and never auto-categorises it', () => {
    const row = mapBankTransaction({ id: 'txn_2', merchant: 'STUDENT LOANS COMPANY', amount: 450, date: '2026-08-01' })
    expect(row.amount).toBe(450)
    expect(row.category).toBe('other')
  })

  it('normalizes whatever date shape the provider sends, same as extract.js', () => {
    const row = mapBankTransaction({ id: 'txn_3', merchant: 'PRET A MANGER', amount: -3.4, date: '2026-08-20' })
    expect(row.date).toBe('2026-08-20')
  })

  it('falls back to an empty merchant string rather than throwing', () => {
    const row = mapBankTransaction({ id: 'txn_4', amount: -5, date: '2026-08-20' })
    expect(row.merchant).toBe('')
    expect(row.category).toBe('other')
  })

  it('rejects a non-finite amount rather than silently importing a zero', () => {
    expect(() => mapBankTransaction({ id: 'txn_5', merchant: 'X', amount: NaN, date: '2026-08-20' })).toThrow(
      /amount must be a finite number/,
    )
  })

  it('rejects a missing transaction object', () => {
    expect(() => mapBankTransaction(null)).toThrow(/txn required/)
  })
})

describe('mapBankTransactions', () => {
  it('maps a list and tolerates a non-array input', () => {
    const rows = mapBankTransactions([
      { id: 'a', merchant: 'NETFLIX.COM', amount: -9.99, date: '2026-08-15' },
      { id: 'b', merchant: 'DELIVEROO', amount: -18, date: '2026-08-16' },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].category).toBe('subscriptions')
    expect(rows[1].category).toBe('eating_out')
    expect(mapBankTransactions(undefined)).toEqual([])
  })
})

describe('bankTransactionDedupeKey', () => {
  it('combines connection + provider transaction id', () => {
    expect(bankTransactionDedupeKey('conn_1', 'txn_abc')).toBe('conn_1:txn_abc')
  })

  it('requires both parts', () => {
    expect(() => bankTransactionDedupeKey('', 'txn_abc')).toThrow()
    expect(() => bankTransactionDedupeKey('conn_1', '')).toThrow()
  })
})
