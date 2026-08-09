import { useState } from 'react'
import { useStore } from '../store/store.js'
import { spendingPace } from '../engine/pace.js'
import { overviewSummary } from '../engine/summaries.js'
import { daysBetween } from '../engine/dates.js'
import { gbp, gbpWhole, shortDate } from '../lib/format.js'
import { Page, PageSummary, Section } from './Page.jsx'
import Gauge from './Gauge.jsx'
import { Sheet, Explain, useCountUp } from './ui.jsx'
import { ExpenseForm, ReconcileForm } from './forms.jsx'
import CanISpend from './CanISpend.jsx'
import { IconAlert, IconPlus } from './icons.jsx'

// Overview, in the order the client asked for:
//
//   Spending Pace → Can I Spend? → important upcoming commitments → supporting info
//
// "rather than making Can I Spend another small card buried amongst analytics."
//
// The <Page> component enforces that order structurally — this file supplies the
// contents of each slot but does not get to decide where they land.

const BAND_LABEL = {
  comfortable: 'Comfortably under',
  'on-pace': 'On pace',
  over: 'A little over',
  attention: 'Well over',
  overcommitted: 'Over-committed',
  unknown: 'Not enough logged yet',
}

const BAND_PILL = { comfortable: 'go', 'on-pace': 'go', over: 'tight', attention: 'over', overcommitted: 'over', unknown: '' }

export default function Dashboard() {
  const { state, actions } = useStore()
  const [sheet, setSheet] = useState(null)

  const asOf = new Date()
  const pace = spendingPace(state, asOf)
  const summary = overviewSummary(state, asOf)
  const known = pace.dataQuality === 'ok' && !pace.overcommitted

  // The hero figure is the one the client asks for by name: what is left today.
  const count = useCountUp(pace.overcommitted ? 0 : Math.max(pace.leftToday, 0))
  const checkedAgo = daysBetween(state.lastReconciled, asOf)

  const upcoming = [...pace.commitmentRows, ...pace.plannedSpendRows]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)

  return (
    <Page title="Overview">
      <Section slot="summary">
        <PageSummary summary={summary} />
      </Section>

      {/* ── 1. Spending pace ───────────────────────────────────────────────── */}
      <Section slot="hero">
        <div className="panel">
          <div className="panel-top">
            <span className="label">
              Spending pace
              <Explain label="spending pace">
                How fast you're spending the money you can actually afford to spend, compared with how fast you'd
                need to spend it to reach {shortDate(pace.end)} safely. <b>1.00</b> is exactly on pace — under it
                you're spending slower than you can afford, over it you're spending faster.
              </Explain>
            </span>
            <span className={`pill ${BAND_PILL[pace.band]}`}>{BAND_LABEL[pace.band]}</span>
          </div>

          <div className="gauge-wrap">
            <Gauge ratio={pace.ratio} band={pace.band} dataQuality={pace.dataQuality} />
            <div className="gauge-readout">
              <div className="cap">{pace.overcommitted ? 'Nothing spare today' : 'Left to spend today'}</div>
              <div className="num">{gbpWhole(count)}</div>
              <div className="sub">
                {pace.overcommitted
                  ? `${gbp(pace.shortfall)} short before ${shortDate(pace.end)}`
                  : `${gbpWhole(pace.leftThisWeek)} left this week`}
              </div>
            </div>
          </div>

          {/* The maths, in one line, because the client wants the figure checkable. */}
          {known && (
            <p className="pace-working">
              You're spending <b>{gbp(pace.actualDaily)}</b> a day. Your pace allows{' '}
              <b>{gbp(pace.targetDaily)}</b> a day — that's <b>{pace.ratio.toFixed(2)}×</b>.
            </p>
          )}
          {pace.dataQuality === 'insufficient' && !pace.overcommitted && (
            <p className="pace-working">
              Only {pace.loggedDays} of the last 7 days have any spending logged, so there isn't enough yet to give
              you a pace.{' '}
              <button type="button" className="linkish" onClick={() => setSheet('expense')}>
                Log a spend
              </button>{' '}
              and this fills in.
            </p>
          )}
        </div>
      </Section>

      {/* ── 2. Can I spend? — a full-width slab, not a buried card ─────────── */}
      <Section slot="hero">
        <CanISpend />
      </Section>

      {/* ── 3. What's coming ──────────────────────────────────────────────── */}
      <Section slot="detail">
        <div className="sec-head">
          <h2>What's coming out</h2>
          <span className="sec-note">before {shortDate(pace.end)}</span>
        </div>
        <div className="card">
          {upcoming.length === 0 && <div className="empty-row">Nothing due before then.</div>}
          {upcoming.map((c, i) => (
            <div className="row" key={`${c.label}-${i}`}>
              <div className="meta">
                <div className="t">{c.label}</div>
                <div className="s">{shortDate(c.date)}</div>
              </div>
              <div className="amt neg">−{gbp(c.amount)}</div>
            </div>
          ))}
          {pace.justAfterPeriod.map((c, i) => (
            <div className="row is-after" key={`after-${i}`}>
              <div className="meta">
                <div className="t">{c.label}</div>
                {/* Not held back from the maths — said out loud instead, so the number
                    above still reconciles with anyone's own spreadsheet. */}
                <div className="s">{shortDate(c.date)} — just after your money lands</div>
              </div>
              <div className="amt">{gbp(c.amount)}</div>
            </div>
          ))}
        </div>
      </Section>

      {pace.overcommitted && (
        <Section slot="detail">
          <div className="banner warn">
            <IconAlert />
            <div>
              You're <b>{gbp(pace.shortfall)}</b> short before {shortDate(pace.end)}. Trimming a planned spend, or
              moving a goal's deadline back, is the quickest way to close it.
            </div>
          </div>
        </Section>
      )}

      {/* ── 4. Supporting information ─────────────────────────────────────── */}
      <Section slot="detail">
        <div className="tiles">
          <div className="tile">
            <div className="k">Spending so far</div>
            <div className="v">{gbp(pace.actualDaily)}</div>
            <div className="h">a day over {pace.daysElapsed} days</div>
          </div>
          <div className="tile">
            <div className="k">Left this week</div>
            <div className="v accent">{gbpWhole(pace.leftThisWeek)}</div>
            <div className="h">{pace.daysRemaining} days until {shortDate(pace.end)}</div>
          </div>
          <div className="tile">
            <div className="k">In your account</div>
            <div className="v">{gbp(state.balance)}</div>
            <div className="h">
              checked {checkedAgo <= 0 ? 'today' : `${checkedAgo} day${checkedAgo === 1 ? '' : 's'} ago`}
            </div>
          </div>
        </div>
      </Section>

      {/* ── 5. The working, for anyone who wants it ───────────────────────── */}
      <Section slot="tools">
        <div className="sec-head">
          <h2>How that spending money is worked out</h2>
        </div>
        <div className="card">
          <div className="row">
            <div className="meta"><div className="t">Money in your account</div></div>
            <div className="amt">{gbp(pace.balance)}</div>
          </div>
          {pace.expectedIncome > 0 && (
            <div className="row">
              <div className="meta">
                <div className="t">Money arriving before {shortDate(pace.end)}</div>
              </div>
              <div className="amt pos">+{gbp(pace.expectedIncome)}</div>
            </div>
          )}
          <div className="row">
            <div className="meta">
              <div className="t">Rent, bills and regular payments</div>
              <div className="s">everything due before {shortDate(pace.end)}</div>
            </div>
            <div className="amt neg">−{gbp(pace.commitments)}</div>
          </div>
          {pace.plannedSpends > 0 && (
            <div className="row">
              <div className="meta">
                <div className="t">Things you've already planned</div>
              </div>
              <div className="amt neg">−{gbp(pace.plannedSpends)}</div>
            </div>
          )}
          {pace.plannedSaving > 0 && (
            <div className="row">
              <div className="meta">
                <div className="t">Money set aside for your goals</div>
                <div className="s">what they need over the next {pace.daysRemaining} days</div>
              </div>
              <div className="amt neg">−{gbp(pace.plannedSaving)}</div>
            </div>
          )}
          <div className="row row-total">
            <div className="meta">
              <div className="t">Yours to spend over {pace.daysRemaining} days</div>
              <div className="s">that's {gbp(pace.targetDaily)} a day</div>
            </div>
            <div className="amt accent">{gbp(Math.max(pace.available, 0))}</div>
          </div>
        </div>

        <div className="tool-actions">
          <button className="btn btn-tinted" onClick={() => setSheet('expense')}>
            <IconPlus /> Log a spend
          </button>
          <button className="btn" onClick={() => setSheet('reconcile')}>
            Update your balance
          </button>
        </div>
      </Section>

      {sheet === 'expense' && (
        <Sheet title="Log a spend" onClose={() => setSheet(null)}>
          <ExpenseForm onDone={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet === 'reconcile' && (
        <Sheet title="Update your balance" onClose={() => setSheet(null)}>
          <ReconcileForm onDone={() => setSheet(null)} />
        </Sheet>
      )}
    </Page>
  )
}
