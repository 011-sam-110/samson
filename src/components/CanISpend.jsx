import { useState } from 'react'
import { useStore } from '../store/store.js'
import { canISpend } from '../engine/pace.js'
import { gbp } from '../lib/format.js'

// "Can I spend £X?"
//
//   "I still want this to be one of the most prominent things on the Overview page.
//    The whole purpose of Pocko is essentially: I've checked my finances. Am I
//    actually okay to spend some money?"
//
// So it is a full-width slab inline on the page, not a sheet you have to go and find.
//
// The answer is written for someone with no financial knowledge —
//   "Yes, that works. You'd have £19 a day for the next 14 days."
// rather than
//   "Your discretionary expenditure remains within the projected weekly threshold."
//
// The wording and the tiers both live in the engine, so the copy cannot drift away
// from the arithmetic it describes.

const CHIPS = [10, 20, 50, 100]

const TIER_TONE = {
  easy: 'good', fine: 'good', tight: 'warn', big: 'warn', stretch: 'bad', no: 'bad',
}

// Same tone the Overview gauge answers to, so this card — "the whole purpose
// of Pocko," his words — carries colour even before anyone types an amount.
// Without this it was the least visually weighted thing on the page: plain
// and uncoloured until an action was taken, on the one feature he named by
// name as wanting to be unmissable.
const BAND_TONE = {
  comfortable: 'good', 'on-pace': 'good', over: 'warn', attention: 'bad', overcommitted: 'bad', unknown: '',
}

export default function CanISpend({ compact = false }) {
  const { state, actions } = useStore()
  const [amount, setAmount] = useState('')

  const spend = Number(amount) || 0
  const r = spend > 0 ? canISpend(state, spend, new Date()) : null
  const room = canISpend(state, 0, new Date())
  const restingTone = BAND_TONE[room.before.band] || ''

  const logIt = () => {
    actions.addExpense({ label: `Spend of ${gbp(spend)}`, amount: spend, category: 'other', freq: 'oneoff' })
    setAmount('')
  }

  return (
    <section
      className={`cis ${restingTone ? `tone-${restingTone}` : ''} ${compact ? 'cis-compact' : ''}`}
      aria-label="Can I spend?"
    >
      <div className="cis-head">
        <h2>Can I spend…?</h2>
        <p className="cis-room">Type an amount to check it against your pace.</p>
      </div>

      <div className="cis-entry">
        <div className="cis-input-wrap">
          <span className="cis-currency" aria-hidden="true">£</span>
          <input
            className="cis-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount to check"
          />
        </div>
        <div className="cis-chips">
          {CHIPS.map((c) => (
            <button key={c} type="button" className="chip" onClick={() => setAmount(String(c))}>
              £{c}
            </button>
          ))}
        </div>
      </div>

      {r && (
        <div className={`cis-answer tone-${TIER_TONE[r.tier]}`} role="status">
          <p className="cis-verdict">{r.headline}</p>
          <p className="cis-detail">{r.detail}</p>
          {r.affordable && (
            <button type="button" className="btn btn-primary cis-log" onClick={logIt}>
              Log this spend
            </button>
          )}
        </div>
      )}
    </section>
  )
}
