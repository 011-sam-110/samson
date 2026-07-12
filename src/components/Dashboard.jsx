import { useState } from 'react'
import { useStore } from '../store/store.js'
import { daysBetween } from '../engine/finance.js'
import { gbp, gbpWhole, pct, shortDate } from '../lib/format.js'
import Gauge, { zoneOf } from './Gauge.jsx'
import { Sheet, useCountUp } from './ui.jsx'
import { ExpenseForm, ReconcileForm } from './forms.jsx'
import { IconAlert, IconInfo, IconPlus } from './icons.jsx'

const ZONE_PILL = { go: 'On track', tight: 'Spending fast', over: 'Too fast' }

export default function Dashboard({ onNavigate }) {
  const { state, dash } = useStore()
  const [sheet, setSheet] = useState(null) // 'expense' | 'reconcile'

  const zone = zoneOf(dash.pacePct, dash.overCommitted)
  const overspent = dash.overspent
  const count = useCountUp(overspent ? 0 : Math.max(dash.safePerDay, 0))

  const checkedAgo = daysBetween(state.lastReconciled, new Date())
  const zonePill = dash.overCommitted ? 'Over-committed' : ZONE_PILL[zone]

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="eyebrow">Leeway</div>
          <h1>What can I spend?</h1>
        </div>
        <button className="btn btn-sm" onClick={() => setSheet('reconcile')}>
          Reconcile
        </button>
      </div>

      {/* ── the instrument panel ── */}
      <div className="panel">
        <div className="panel-top">
          <span className="label">Spending pace</span>
          <span className={`pill ${zone}`}>{zonePill}</span>
        </div>

        <div className="gauge-wrap">
          <Gauge pace={dash.pacePct} overCommitted={dash.overCommitted} />
          <div className="gauge-readout">
            <div className="cap">{overspent ? 'Nothing spare today' : 'Safe to spend today'}</div>
            <div className={`num ${zone}`}>{gbpWhole(count)}</div>
            <div className="sub">
              {overspent
                ? `${gbp(dash.overAmount)} short before payday`
                : `${gbpWhole(dash.safeThisWeek)} left this week`}
            </div>
          </div>
        </div>

        <div className="pace-line">
          <span>
            Now <b>{gbp(dash.currentDaily)}</b>/day
          </span>
          <span>
            Safe line <b>{gbp(Math.max(dash.targetDaily, 0))}</b>/day
          </span>
          {dash.overCommitted ? <span>commitments over income</span> : <span>at <b>{pct(dash.pacePct)}</b> of pace</span>}
        </div>
      </div>

      {/* ── trouble states ── */}
      {overspent && (
        <div className="banner warn">
          <IconAlert />
          <div>
            You're <b>{gbp(dash.overAmount)}</b> short before your next paycheck. Trim to <b>{gbp(dash.recoveryPerDay)}/day</b> to
            claw it back - or push a goal deadline out.
          </div>
        </div>
      )}
      {!overspent && dash.overCommitted && (
        <div className="banner warn">
          <IconAlert />
          <div>
            Your bills and goals cost more than you earn (<b>{gbp(-dash.targetDaily)}/day</b> short). Something has to give - ease a
            goal or cut a recurring cost.
          </div>
        </div>
      )}

      {/* ── instrument tiles ── */}
      <div className="tiles">
        <div className="tile">
          <div className="k">Spending now</div>
          <div className="v">{gbp(dash.currentDaily)}</div>
          <div className="h">per day · last 14 days</div>
        </div>
        <div className="tile">
          <div className="k">Safe line</div>
          <div className="v accent">{gbp(Math.max(dash.targetDaily, 0))}</div>
          <div className="h">sustainable per day</div>
        </div>
        <div className="tile">
          <div className="k">Next paycheck</div>
          <div className="v">{dash.nextIncomeDate ? `${dash.daysToPay}d` : '-'}</div>
          <div className="h">{dash.nextIncomeDate ? shortDate(dash.nextIncomeDate) : 'no income set'}</div>
        </div>
      </div>

      {/* ── quick actions ── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => setSheet('expense')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconPlus style={{ width: 18, height: 18 }} /> Log a spend
        </button>
        <button className="btn" onClick={() => onNavigate('spend')}>
          Can I spend…?
        </button>
      </div>

      {/* ── why this number (trust) ── */}
      <div className="section-title">Why this number</div>
      <div className="card card-pad">
        <div className="banner info" style={{ marginTop: 0, marginBottom: 8 }}>
          <IconInfo />
          <div>
            Of your <b>{gbp(state.balance)}</b> balance (checked {checkedAgo <= 0 ? 'today' : `${checkedAgo}d ago`}), here's what's
            spoken for before payday in {dash.daysToPay} days:
          </div>
        </div>
        <div className="row">
          <div className="meta">
            <div className="t">Bills due before payday</div>
            <div className="s">rent reserved pro-rata even if it lands after payday</div>
          </div>
          <div className="amt neg">-{gbp(dash.billsReserve)}</div>
        </div>
        <div className="row">
          <div className="meta">
            <div className="t">Goal set-aside</div>
            <div className="s">keeps your savings on schedule</div>
          </div>
          <div className="amt neg">-{gbp(dash.goalsReserve)}</div>
        </div>
        {dash.eventsReserve > 0 && (
          <div className="row">
            <div className="meta">
              <div className="t">Planned events</div>
              <div className="s">things you've already flagged</div>
            </div>
            <div className="amt neg">-{gbp(dash.eventsReserve)}</div>
          </div>
        )}
        <div className="row">
          <div className="meta">
            <div className="t" style={{ fontWeight: 700 }}>Free to spend over {dash.daysToPay} days</div>
            <div className="s">that's your {gbp(dash.safePerDay)}/day</div>
          </div>
          <div className="amt" style={{ color: 'var(--brand)' }}>{gbp(Math.max(dash.pool, 0))}</div>
        </div>
      </div>

      {sheet === 'expense' && (
        <Sheet title="Log a spend" onClose={() => setSheet(null)}>
          <ExpenseForm onDone={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet === 'reconcile' && (
        <Sheet title="Reconcile balance" onClose={() => setSheet(null)}>
          <ReconcileForm onDone={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  )
}
