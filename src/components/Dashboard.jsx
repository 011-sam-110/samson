import { useState } from 'react'
import { useStore } from '../store/store.js'
import { daysBetween } from '../engine/finance.js'
import { gbp, gbpWhole, shortDate, fullDate } from '../lib/format.js'
import Gauge, { zoneOf } from './Gauge.jsx'
import { Sheet, Explain, useCountUp } from './ui.jsx'
import { ExpenseForm, ReconcileForm } from './forms.jsx'
import CanISpend from './CanISpend.jsx'
import { IconAlert, IconInfo, IconPlus, IconWallet } from './icons.jsx'

const ZONE_PILL = { go: 'On track', tight: 'Spending fast', over: 'Too fast' }

export default function Dashboard() {
  const { state, dash } = useStore()
  const [sheet, setSheet] = useState(null) // 'expense' | 'reconcile' | 'canispend'

  const zone = zoneOf(dash.pacePct, dash.overCommitted)
  const overspent = dash.overspent
  const count = useCountUp(overspent ? 0 : Math.max(dash.safePerDay, 0))

  const checkedAgo = daysBetween(state.lastReconciled, new Date())
  const zonePill = dash.overCommitted ? 'Over-committed' : ZONE_PILL[zone]

  return (
    <div>
      <div
        className="page-head"
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
      >
        <div>
          <div className="eyebrow">{fullDate(new Date())}</div>
          <h1>Overview</h1>
        </div>
        <button
          className="btn btn-sm btn-tinted"
          onClick={() => setSheet('reconcile')}
          title="Type in your real bank balance to re-sync Leeway"
        >
          Reconcile balance
        </button>
      </div>

      {/* ── the very first thing: your total balance ── */}
      <div className="balance-card">
        <div className="balance-top">
          <IconWallet />
          <span>Total balance</span>
        </div>
        <div className="balance-num">{gbp(state.balance)}</div>
        <div className="balance-sub">
          What's in your account · last checked {checkedAgo <= 0 ? 'today' : `${checkedAgo} day${checkedAgo === 1 ? '' : 's'} ago`}
        </div>
      </div>

      {/* ── then the signature: what can I safely spend today? ── */}
      <div className="panel">
        <div className="panel-top">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Spending rate
            <Explain label="spending rate">
              The needle shows how fast you're spending compared with a pace you can keep up. In the{' '}
              <b>green</b> you're fine, <b>amber</b> means ease off, <b>red</b> means you're spending too fast to last until payday.
            </Explain>
          </span>
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
      </div>

      {/* ── the two things you actually came to do ──
          On mobile they become the two brand-coloured slabs you can hit with a
          thumb without looking. */}
      <div className="today-actions">
        <button className="act act-violet" onClick={() => setSheet('expense')}>
          <IconPlus />
          <span>Log a spend</span>
        </button>
        <button className="act act-aqua" onClick={() => setSheet('canispend')}>
          <IconWallet />
          <span>Can I spend…?</span>
        </button>
      </div>

      {/* ── trouble states ── */}
      {overspent && (
        <div className="banner warn">
          <IconAlert />
          <div>
            You're <b>{gbp(dash.overAmount)}</b> short before your next payday. Trim to <b>{gbp(dash.recoveryPerDay)}/day</b> to
            claw it back — or push a goal deadline out.
          </div>
        </div>
      )}
      {!overspent && dash.overCommitted && (
        <div className="banner warn">
          <IconAlert />
          <div>
            Your bills and goals cost more than you earn (<b>{gbp(-dash.targetDaily)}/day</b> short). Something has to give — ease a
            goal or cut a recurring cost.
          </div>
        </div>
      )}

      {/* ── three quick numbers, each explained in plain English ── */}
      <div className="tiles">
        <div className="tile">
          <div className="k">
            Spending rate
            <Explain label="spending rate">
              How fast you're spending right now — your everyday spending (not rent or bills) averaged over the last two weeks.
            </Explain>
          </div>
          <div className="v">{gbp(dash.currentDaily)}</div>
          <div className="h">a day, on average</div>
        </div>
        <div className="tile t-aqua">
          <div className="k">
            Safe daily rate
            <Explain label="safe daily rate">
              The most you can spend each day and still cover your bills and savings. Stay under it and you'll never come up short
              before payday.
            </Explain>
          </div>
          <div className="v accent">{gbp(Math.max(dash.targetDaily, 0))}</div>
          <div className="h">a day, and you never slip</div>
        </div>
        <div className="tile">
          <div className="k">Next payday</div>
          <div className="v">{dash.nextIncomeDate ? `${dash.daysToPay}d` : '—'}</div>
          <div className="h">{dash.nextIncomeDate ? shortDate(dash.nextIncomeDate) : 'no income set up yet'}</div>
        </div>
      </div>

      {/* ── why this number (trust, in plain words) ── */}
      <div className="section-head">
        <div className="section-title" style={{ margin: 0 }}>
          Why you can spend {gbpWhole(Math.max(dash.safePerDay, 0))} a day
        </div>
        <Explain label="why this number">
          We start from your balance, set aside what's already promised (bills, savings, planned nights out), then share what's
          left evenly across the days until payday.
        </Explain>
      </div>
      <div className="card card-pad">
        <div className="banner info" style={{ marginTop: 0, marginBottom: 8 }}>
          <IconInfo />
          <div>
            Of your <b>{gbp(state.balance)}</b> balance, here's what's already spoken for before payday in {dash.daysToPay} days:
          </div>
        </div>
        <div className="row">
          <div className="meta">
            <div className="t">Bills due before payday</div>
            <div className="s">we set rent aside even if it's due just after payday</div>
          </div>
          <div className="amt neg">−{gbp(dash.billsReserve)}</div>
        </div>
        <div className="row">
          <div className="meta">
            <div className="t">Money for your goals</div>
            <div className="s">keeps your savings on schedule</div>
          </div>
          <div className="amt neg">−{gbp(dash.goalsReserve)}</div>
        </div>
        {dash.eventsReserve > 0 && (
          <div className="row">
            <div className="meta">
              <div className="t">Planned spends</div>
              <div className="s">the nights out and trips you've already flagged</div>
            </div>
            <div className="amt neg">−{gbp(dash.eventsReserve)}</div>
          </div>
        )}
        <div className="row">
          <div className="meta">
            <div className="t" style={{ fontWeight: 700 }}>
              Free to spend over {dash.daysToPay} days
            </div>
            <div className="s">that's your {gbp(dash.safePerDay)} a day</div>
          </div>
          <div className="amt" style={{ color: 'var(--brand-ink)' }}>
            {gbp(Math.max(dash.pool, 0))}
          </div>
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
      {sheet === 'canispend' && (
        <Sheet title="Can I spend…?" onClose={() => setSheet(null)}>
          <CanISpend onDone={() => setSheet(null)} />
        </Sheet>
      )}
    </div>
  )
}
