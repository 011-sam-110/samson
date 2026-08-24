// src/lib/bank-transactions.js
// Turns ONE normalized bank-feed transaction into the exact row shape
// ImportSheet.jsx already produces from a screenshot import (see its `parsed`
// mapping in onFile), so a bank-synced transaction can go through the SAME
// store action (`actions.importTransactions`, src/store/store.js) and the SAME
// categorizer (`guessCategory`, src/lib/categorize.js) as a photographed
// statement. No parallel transaction model, no separate category logic — see
// docs/open-banking-spec.md, "How a bank transaction becomes a Pocko row".
//
// STATUS: not wired to a real provider. "Normalized" means: whichever
// aggregator Sam picks, a thin per-provider adapter (NOT built — there is
// nothing to adapt from yet) would translate its raw payload into the
// NormalizedBankTransaction shape below before calling mapBankTransaction.
// Real providers name these fields differently (TrueLayer:
// `transaction_id`/`description`; GoCardless Bank Account Data: `transactionId`/
// `remittanceInformationUnstructured`; Plaid: `transaction_id`/`merchant_name`)
// — see the spec's data-model section for the mapping table.
import { guessCategory } from './categorize.js'
import { normalizeDate } from './extract.js'

/**
 * @typedef {Object} NormalizedBankTransaction
 * @property {string} id          - provider's stable transaction id (de-dupe key material)
 * @property {string} [merchant]  - counterparty / description as the bank sent it
 * @property {number} amount      - negative = money out, positive = money in (same sign convention as extract.js / ImportSheet)
 * @property {string} date        - any date string extract.js's normalizeDate can parse
 */

// The de-dupe unit a real sync loop needs (see spec, "Sync strategy: ongoing
// polling") so re-fetching an overlapping window never double-imports the same
// transaction. Nothing in this file persists it — see schema.sql's
// `uq_transactions_bank_txn` unique index, which is where de-dup would
// actually be enforced once a provider exists.
export function bankTransactionDedupeKey(connectionId, providerTransactionId) {
  if (!connectionId || !providerTransactionId) throw new Error('connectionId and providerTransactionId are required')
  return `${connectionId}:${providerTransactionId}`
}

// Mirrors ImportSheet.jsx's onFile mapping exactly (down to the
// `amount >= 0 ? 'other' : guessCategory(merchant)` rule), so the result can be
// pushed straight into `actions.importTransactions([...])` alongside, or
// instead of, a screenshot's rows. The one difference from a screenshot row is
// there's no `include` toggle to review by default here — see the spec for
// why a first sync should still show a review step, same as import today.
export function mapBankTransaction(txn) {
  if (!txn || typeof txn !== 'object') throw new Error('txn required')
  const amount = Number(txn.amount)
  if (!Number.isFinite(amount)) throw new Error('txn.amount must be a finite number')
  const merchant = String(txn.merchant || '').trim()
  return {
    merchant,
    amount,
    date: normalizeDate(txn.date),
    category: amount >= 0 ? 'other' : guessCategory(merchant),
    include: true,
  }
}

export function mapBankTransactions(txns) {
  return (Array.isArray(txns) ? txns : []).map(mapBankTransaction)
}
