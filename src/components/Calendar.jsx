import { useState } from 'react'
import { useStore } from '../store/store.js'
import { addMonths } from '../engine/finance.js'
import { buildMonth, termNudge } from '../engine/calendar.js'
import { gbp, fullDate } from '../lib/format.js'
import { Sheet } from './ui.jsx'
import { TermSpanForm } from './forms.jsx'
import { IconPlus, IconTrash, IconInfo } from './icons.jsx'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const KIND_LABEL = { freshers: 'Freshers', exams: 'Exams', term: 'Term' }

const dayNum = (iso) => Number(iso.slice(8, 10))

function cellClass(cell) {
  const cls = ['cal-cell']
  if (!cell.inMonth) cls.push('out-month')
  if (cell.heatLevel > 0) cls.push(`heat-${cell.heatLevel}`)
  if (cell.isToday) cls.push('is-today')
  if (cell.terms.length) cls.push(`term-${cell.terms[0].kind}`)
  return cls.join(' ')
}

export default function Calendar() {
  const { state, actions } = useStore()
  const [anchor, setAnchor] = useState(() => new Date())
  const [selected, setSelected] = useState(null)
  const [addingTerm, setAddingTerm] = useState(false)

  const now = new Date()
  const { monthLabel, weeks } = buildMonth(state, anchor, now)
  const nudge = termNudge(state, now)
  const spans = state.termSpans || []

  return (
    <div className="cal">
      {nudge && (
        <div className={`cal-nudge nudge-${nudge.kind}`}>
          <IconInfo />
          <div>{nudge.message}</div>
        </div>
      )}

      <div className="cal-head">
        <button className="btn-icon" aria-label="Previous month" onClick={() => setAnchor(addMonths(anchor, -1))}>
          ‹
        </button>
        <div className="cal-month">{monthLabel}</div>
        <button className="btn-icon" aria-label="Next month" onClick={() => setAnchor(addMonths(anchor, 1))}>
          ›
        </button>
        <button className="linkish cal-today" onClick={() => setAnchor(new Date())}>
          Today
        </button>
      </div>

      <div className="cal-weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="cal-grid">
        {weeks.flat().map((cell) => (
          <button key={cell.date} className={cellClass(cell)} onClick={() => setSelected(cell)} aria-label={fullDate(cell.date)}>
            <span className="cal-daynum">{dayNum(cell.date)}</span>
            {cell.bills.length > 0 && <span className="cal-ring" title="Bill due" />}
            {cell.events.length > 0 && <span className="cal-pip" title="Planned spend" />}
          </button>
        ))}
      </div>

      <div className="cal-legend">
        <span>Less</span>
        <i className="l1" />
        <i className="l2" />
        <i className="l3" />
        <i className="l4" />
        <span>more spent · </span>
        <span className="cal-key">
          <span className="cal-ring" /> bill
        </span>
        <span className="cal-key">
          <span className="cal-pip" /> planned
        </span>
      </div>

      <div className="cal-terms">
        <div className="cal-terms-head">
          <span className="cal-terms-title">Term dates</span>
          <button className="btn btn-sm" onClick={() => setAddingTerm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IconPlus style={{ width: 16, height: 16 }} /> Add
          </button>
        </div>
        {spans.length === 0 ? (
          <div className="empty">Add your Freshers week and exam dates to get plan-ahead nudges.</div>
        ) : (
          spans.map((s) => (
            <div className="row" key={s.id}>
              <div className={`cal-term-dot term-${s.kind}`} />
              <div className="meta">
                <div className="t">{s.label}</div>
                <div className="s">
                  {KIND_LABEL[s.kind] || s.kind} · {fullDate(s.start)} – {fullDate(s.end)}
                </div>
              </div>
              <button className="btn-icon" aria-label={`Remove ${s.label}`} onClick={() => actions.removeTermSpan(s.id)}>
                <IconTrash />
              </button>
            </div>
          ))
        )}
      </div>

      {selected && (
        <Sheet title={fullDate(selected.date)} onClose={() => setSelected(null)}>
          {selected.terms.length > 0 && (
            <div className="cal-detail-terms">
              {selected.terms.map((t, i) => (
                <span key={i} className={`cal-term-chip term-${t.kind}`}>
                  {t.label}
                </span>
              ))}
            </div>
          )}
          <div className="stat-line">
            <div>
              <div className="k">Spent that day</div>
              <div className="v mono">{gbp(selected.spend)}</div>
            </div>
          </div>
          {selected.bills.map((b, i) => (
            <div className="row" key={`b${i}`}>
              <div className="cal-ring" />
              <div className="meta">
                <div className="t">{b.label}</div>
                <div className="s">Bill due</div>
              </div>
              <div className="amt neg">-{gbp(b.amount)}</div>
            </div>
          ))}
          {selected.events.map((e, i) => (
            <div className="row" key={`e${i}`}>
              <div className="cal-pip" />
              <div className="meta">
                <div className="t">{e.label}</div>
                <div className="s">Planned spend</div>
              </div>
              <div className="amt neg">-{gbp(e.amount)}</div>
            </div>
          ))}
          {selected.spend === 0 && selected.bills.length === 0 && selected.events.length === 0 && selected.terms.length === 0 && (
            <div className="empty">Nothing logged or due this day.</div>
          )}
        </Sheet>
      )}

      {addingTerm && (
        <Sheet title="Add term dates" onClose={() => setAddingTerm(false)}>
          <TermSpanForm onDone={() => setAddingTerm(false)} />
        </Sheet>
      )}
    </div>
  )
}
