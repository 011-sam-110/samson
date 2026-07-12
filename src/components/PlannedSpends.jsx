import { useState } from 'react'
import { useStore } from '../store/store.js'
import { daysBetween } from '../engine/finance.js'
import { gbp, fullDate, relativeDays } from '../lib/format.js'
import { Sheet } from './ui.jsx'
import { EventForm } from './forms.jsx'
import { IconPlus, IconTrash } from './icons.jsx'

// A section, not a page. Planned spends stopped being their own tab because they
// are the same promise a goal is — money already committed, just pointing at a
// night out instead of a laptop. Both get held back from today's number, so both
// belong on the screen that explains what's being held back and why.

export default function PlannedSpends() {
  const { state, actions } = useStore()
  const [adding, setAdding] = useState(false)

  const upcoming = [...state.events]
    .map((e) => ({ ...e, days: daysBetween(new Date(), e.date) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days)
  const totalPlanned = upcoming.reduce((s, e) => s + Number(e.amount || 0), 0)

  return (
    <>
      <div className="section-head">
        <div className="section-title" style={{ margin: 0 }}>
          Planned spends
        </div>
        <button
          className="btn btn-sm"
          onClick={() => setAdding(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <IconPlus style={{ width: 16, height: 16 }} /> Plan a spend
        </button>
      </div>

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
            <div className="avatar cat-planned">{e.days === 0 ? '★' : e.days}</div>
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
    </>
  )
}
