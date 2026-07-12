import { useState } from 'react'
import { useStore } from '../store/store.js'
import { daysBetween } from '../engine/finance.js'
import { gbp, fullDate, relativeDays } from '../lib/format.js'
import { Sheet } from './ui.jsx'
import { EventForm } from './forms.jsx'
import { IconPlus, IconTrash } from './icons.jsx'

export default function Events() {
  const { state, actions } = useStore()
  const [adding, setAdding] = useState(false)

  const upcoming = [...state.events]
    .map((e) => ({ ...e, days: daysBetween(new Date(), e.date) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days)
  const totalPlanned = upcoming.reduce((s, e) => s + Number(e.amount || 0), 0)

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Ahead</div>
        <h1>Planned spends</h1>
        <p>Flag the big nights and trips. Leeway sets the money aside now so they don't blow up your week.</p>
      </div>

      <button className="btn btn-primary" onClick={() => setAdding(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <IconPlus style={{ width: 18, height: 18 }} /> Plan a spend
      </button>

      {upcoming.length > 0 && (
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 12px' }}>
          <b style={{ color: 'var(--ink)' }} className="mono">
            {gbp(totalPlanned)}
          </b>{' '}
          set aside across {upcoming.length} plan{upcoming.length > 1 ? 's' : ''}.
        </p>
      )}

      <div className="card card-pad">
        {upcoming.length === 0 && <div className="empty">Nothing planned. Got a birthday or a weekend away coming up?</div>}
        {upcoming.map((e) => (
          <div className="row" key={e.id}>
            <div className="avatar cat-discretionary">{e.days === 0 ? '★' : e.days}</div>
            <div className="meta">
              <div className="t">{e.label}</div>
              <div className="s">
                {fullDate(e.date)} · {relativeDays(e.days)}
              </div>
            </div>
            <div className="amt neg">-{gbp(e.amount)}</div>
            <button className="btn-icon" aria-label={`Remove ${e.label}`} onClick={() => actions.removeEvent(e.id)}>
              <IconTrash />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <Sheet title="Plan a spend" onClose={() => setAdding(false)}>
          <EventForm onDone={() => setAdding(false)} />
        </Sheet>
      )}
    </div>
  )
}
