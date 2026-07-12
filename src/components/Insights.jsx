import { useState } from 'react'
import { useStore } from '../store/store.js'
import {
  periodRange,
  totalSpend,
  spendByCategory,
  weekendSplit,
  weeklyTrend,
  biggestMover,
  recurringSpends,
  costToGoal,
} from '../engine/analytics.js'
import { goalProgress } from '../engine/finance.js'
import { gbp, gbpWhole, pct } from '../lib/format.js'
import { BarRow, SplitBar } from './charts.jsx'
import { IconInfo, IconAlert } from './icons.jsx'

const PERIODS = [
  { key: 'month', label: 'This month' },
  { key: 'last30', label: 'Last 30 days' },
]

export default function Insights() {
  const { state } = useStore()
  const [period, setPeriod] = useState('month')
  const asOf = new Date()
  const txns = state.transactions || []
  const { from, to } = periodRange(period, asOf)

  const total = totalSpend(txns, from, to)
  const cats = spendByCategory(txns, from, to)
  const maxCat = cats.length ? cats[0].total : 0
  const split = weekendSplit(txns, from, to)
  const trend = weeklyTrend(txns, asOf)
  const mover = biggestMover(txns, asOf)
  const leaks = recurringSpends(txns, from, to)

  // Top discretionary category → cost against the nearest active goal.
  const topDiscretionary = cats.find((c) => c.type === 'discretionary')
  const topGoal = (state.goals || [])
    .map((g) => ({ g, p: goalProgress(g, asOf) }))
    .filter((x) => !x.p.done)
    .sort((a, b) => a.p.daysLeft - b.p.daysLeft)[0]
  const goalWeeks = topGoal && topDiscretionary ? costToGoal(topDiscretionary.total, topGoal.p.weeklyRequired) : 0

  const expenseCount = txns.filter((t) => t.type === 'expense').length
  const enoughData = expenseCount >= 3

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Insights</div>
        <h1>Where your money goes</h1>
        <p>The patterns behind your spending - and the easiest things to trim.</p>
      </div>

      <div className="insights-top">
        <div className="seg-inline">
          {PERIODS.map((p) => (
            <button key={p.key} className={`btn btn-sm ${period === p.key ? 'btn-primary' : ''}`} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="insights-total">
          <div className="lbl">Spent this period</div>
          <div className="amt2 mono">{gbp(total)}</div>
        </div>
      </div>

      {!enoughData && (
        <div className="card card-pad">
          <div className="empty">Log a few more spends and your insights will fill in here.</div>
        </div>
      )}

      {enoughData && (
        <>
          <div className="section-title">Where it goes</div>
          <div className="card card-pad">
            {cats.length === 0 ? (
              <div className="empty">No spending in this period.</div>
            ) : (
              cats.map((c) => (
                <BarRow
                  key={c.key}
                  label={c.label}
                  value={c.total}
                  share={c.pct}
                  max={maxCat}
                  note={c.count > 1 ? `${c.count}×` : null}
                />
              ))
            )}
          </div>

          <div className="section-title">This week vs usual</div>
          <div className="card card-pad">
            <div className="stat-line">
              <div>
                <div className="k">This week</div>
                <div className="v mono">{gbp(trend.thisWeek)}</div>
              </div>
              <div>
                <div className="k">4-week average</div>
                <div className="v mono">{gbp(trend.fourWeekAvg)}</div>
              </div>
            </div>
            {trend.vsAvgPct != null && (
              <div className={`banner ${trend.vsAvgPct > 0.1 ? 'warn' : 'info'}`} style={{ margin: 0 }}>
                {trend.vsAvgPct > 0.1 ? <IconAlert /> : <IconInfo />}
                <div>
                  You're spending <b>{pct(Math.abs(trend.vsAvgPct))}</b> {trend.vsAvgPct >= 0 ? 'more' : 'less'} than usual this week
                  {mover ? (
                    <>
                      , mostly <b>{mover.label}</b>
                    </>
                  ) : (
                    ''
                  )}
                  .
                </div>
              </div>
            )}
          </div>

          <div className="section-title">The weekend effect</div>
          <div className="card card-pad">
            <SplitBar aLabel="Weekdays" aValue={split.weekdayPerDay} bLabel="Weekends" bValue={split.weekendPerDay} />
            {split.weekendPerDay > split.weekdayPerDay * 1.2 && (
              <p className="chart-caption">
                Weekends run about {gbpWhole(split.weekendPerDay - split.weekdayPerDay)}/day more. Worth planning for, not feeling
                guilty about.
              </p>
            )}
          </div>

          {leaks.length > 0 && (
            <>
              <div className="section-title">What keeps repeating</div>
              <div className="card card-pad">
                {leaks.map((l) => (
                  <BarRow key={l.key} label={l.label} value={l.total} max={leaks[0].total} note={`${l.count}× · ${gbp(l.avgEach)} each`} />
                ))}
              </div>
            </>
          )}

          {topGoal && topDiscretionary && goalWeeks > 0 && (
            <>
              <div className="section-title">What it's costing you</div>
              <div className="card card-pad">
                <div className="banner info" style={{ margin: 0 }}>
                  <IconInfo />
                  <div>
                    The <b>{gbp(topDiscretionary.total)}</b> on <b>{topDiscretionary.label}</b> this period is about{' '}
                    <b>{goalWeeks.toFixed(1)} weeks</b> of your <b>{topGoal.g.label}</b> saving.
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
