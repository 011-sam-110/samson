import { useState } from 'react'
import { useStore } from '../store/store.js'
import { canISpend } from '../engine/finance.js'
import { gbp } from '../lib/format.js'

const CHIPS = [10, 20, 50, 100]

const HEADLINE = { yes: 'Go for it', tight: 'Cutting it fine', no: 'Better not' }

export default function CanISpend() {
  const { state, actions } = useStore()
  const [amount, setAmount] = useState('')
  const [logged, setLogged] = useState(false)

  const spend = Number(amount) || 0
  const r = spend > 0 ? canISpend(state, spend, new Date()) : null

  const sub = r
    ? r.verdict === 'yes'
      ? `You'd still have ${gbp(r.newSafePerDay)}/day until your next payday.`
      : r.verdict === 'tight'
        ? `Doable - but it drops you to ${gbp(r.newSafePerDay)}/day for the next ${r.windowDays} days.`
        : `That's ${gbp(r.over)} more than you've got spare before payday.`
    : null

  const logIt = () => {
    actions.addExpense({ label: `Spend of ${gbp(spend)}`, amount: spend, category: 'other', freq: 'oneoff' })
    setLogged(true)
    setAmount('')
    setTimeout(() => setLogged(false), 2200)
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Quick check</div>
        <h1>Can I spend…?</h1>
        <p>Type an amount. Leeway tells you the damage before you tap your card.</p>
      </div>

      <div className="card card-pad" style={{ textAlign: 'center' }}>
        <input
          className="cis-input"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="£0"
          value={amount}
          autoFocus
          onChange={(e) => {
            setAmount(e.target.value)
            setLogged(false)
          }}
          aria-label="Amount to check"
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {CHIPS.map((c) => (
            <button key={c} className="btn btn-sm" onClick={() => setAmount(String(c))}>
              £{c}
            </button>
          ))}
        </div>

        {r && (
          <div className={`verdict ${r.verdict}`}>
            <h2>{HEADLINE[r.verdict]}</h2>
            <p>{sub}</p>
          </div>
        )}

        {r && r.verdict !== 'no' && (
          <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={logIt}>
            Log this spend
          </button>
        )}
        {logged && <p style={{ color: 'var(--brand-ink)', fontWeight: 600, marginTop: 12 }}>Logged ✓</p>}
      </div>
    </div>
  )
}
