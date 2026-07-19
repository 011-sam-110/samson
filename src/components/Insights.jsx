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
  dailySpendSeries,
  weeklySeries,
} from '../engine/analytics.js'
import { goalProgress, survivalPlan } from '../engine/finance.js'
import { gbp, gbpWhole, pct, shortDate } from '../lib/format.js'
import { BarRow, SplitBar } from './charts.jsx'
import { SpendOverTimeChart, WeeklyTrendChart } from './InsightCharts.jsx'
import { Sheet, Explain } from './ui.jsx'
import { SurviveForm } from './forms.jsx'
import { IconInfo, IconAlert, IconBulb, IconTag, IconPiggy, IconClock, IconWallet } from './icons.jsx'

const PERIODS = [
  { key: 'month', label: 'This month' },
  { key: 'last30', label: 'Last 30 days' },
]

export default function Insights() {
  const { state } = useStore()
  const [period, setPeriod] = useState('month')
  const [tip, setTip] = useState(null)
  const [tipState, setTipState] = useState('idle') // idle | loading | error
  const [surviveOpen, setSurviveOpen] = useState(false)
  const asOf = new Date()
  const txns = state.transactions || []
  const { from, to } = periodRange(period, asOf)

  const total = totalSpend(txns, from, to)
  const cats = spendByCategory(txns, from, to)
  const maxCat = cats.length ? cats[0].total : 0
  const split = weekendSplit(txns, from, to, asOf)
  const trend = weeklyTrend(txns, asOf)
  const mover = biggestMover(txns, asOf)
  const leaks = recurringSpends(txns, from, to)
  const daily = dailySpendSeries(txns, from, to)
  const weekly = weeklySeries(txns, asOf, 6).map((w) => ({ ...w, label: shortDate(w.start) }))
  const plan = survivalPlan(state, asOf)

  // Top discretionary category → cost against the nearest goal still being saved into.
  const topDiscretionary = cats.find((c) => c.type === 'discretionary')
  const topGoal = (state.goals || [])
    .map((g) => ({ g, p: goalProgress(g, asOf) }))
    .filter((x) => !x.p.done && !x.p.overdue && x.p.weeklyRequired > 0)
    .sort((a, b) => a.p.daysLeft - b.p.daysLeft)[0]
  const goalWeeks = topGoal && topDiscretionary ? costToGoal(topDiscretionary.total, topGoal.p.weeklyRequired) : 0

  const expenseCount = txns.filter((t) => t.type === 'expense').length
  const enoughData = expenseCount >= 3

  // Friendly, evergreen money-saving tips, made personal where it's cheap to.
  const saveTips = []
  if (topDiscretionary) {
    saveTips.push({
      Icon: IconBulb,
      t: `Your biggest fun spend is ${topDiscretionary.label}`,
      s: `That's ${gbp(topDiscretionary.total)} this period. Setting yourself a weekly cap — and tapping "Can I spend?" before you buy — is the easiest win here.`,
    })
  }
  saveTips.push(
    {
      Icon: IconTag,
      t: 'Flash your student discount',
      s: 'A TOTUM card or your .ac.uk email unlocks money off food, travel, clothes and software. Get in the habit of asking "student discount?" before you pay.',
    },
    {
      Icon: IconPiggy,
      t: 'Batch-cook a few meals',
      s: 'Cooking once and eating three times beats a daily meal deal or Deliveroo — the single biggest saver for most students.',
    },
    {
      Icon: IconClock,
      t: 'Check your subscriptions',
      s: "Cancel anything you haven't opened this month. A couple of forgotten £8 subscriptions is a night out.",
    },
    {
      Icon: IconWallet,
      t: 'Take cash on a night out',
      s: "Leave the card at home with a set amount in your pocket. When it's gone, it's gone — and there's no nasty surprise on Monday.",
    },
  )

  const getTip = async () => {
    setTipState('loading')
    try {
      const facts = {
        period: period === 'month' ? 'this month' : 'the last 30 days',
        totalSpent: Math.round(total),
        topCategory: topDiscretionary?.label ?? null,
        topCategoryTotal: topDiscretionary ? Math.round(topDiscretionary.total) : null,
        weekdayPerDay: Math.round(split.weekdayPerDay),
        weekendPerDay: Math.round(split.weekendPerDay),
        thisWeek: Math.round(trend.thisWeek),
        fourWeekAvg: Math.round(trend.fourWeekAvg),
        goal: topGoal?.g.label ?? null,
        goalWeekly: topGoal ? Math.round(topGoal.p.weeklyRequired) : null,
      }
      const res = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'failed')
      setTip(data.tip)
      setTipState('idle')
    } catch {
      setTipState('error')
    }
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Insights</div>
        <h1>A report on your money</h1>
        <p>The story behind your spending — where it goes, how this week compares, and the easiest things to trim.</p>
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
          <div className="amt2">{gbp(total)}</div>
        </div>
      </div>

      {!enoughData && (
        <div className="card card-pad">
          <div className="empty">Log a few more spends and your charts will fill in here.</div>
        </div>
      )}

      {enoughData && (
        <>
          <div className="section-title">Spending over time</div>
          <div className="card card-pad">
            <SpendOverTimeChart data={daily} />
            <p className="chart-caption">How much you spent each day {period === 'month' ? 'this month' : 'over the last 30 days'}. Hover a point for the exact amount.</p>
          </div>

          <div className="section-title">Where your money goes</div>
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
                <div className="v">{gbp(trend.thisWeek)}</div>
              </div>
              <div>
                <div className="k">4-week average</div>
                <div className="v">{gbp(trend.fourWeekAvg)}</div>
              </div>
            </div>
            <WeeklyTrendChart data={weekly} />
            {trend.vsAvgPct != null && (
              <div className={`banner ${trend.vsAvgPct > 0.1 ? 'warn' : 'info'}`} style={{ marginBottom: 0 }}>
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

          <div className="section-head">
            <div className="section-title" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              The weekend effect
              <Explain label="the weekend effect">
                Your everyday spending split into weekdays vs weekends, per day. Most students spend more at the weekend — this
                just makes it easy to plan for.
              </Explain>
            </div>
          </div>
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

          <div className="section-title">Smart tip</div>
          <div className="card card-pad">
            {tip ? (
              <div className="banner info" style={{ margin: 0 }}>
                <IconInfo />
                <div>{tip}</div>
              </div>
            ) : (
              <div className="row" style={{ alignItems: 'center' }}>
                <div className="meta">
                  <div className="t" style={{ fontWeight: 700 }}>Want a hand?</div>
                  <div className="s">Leeway can look at your spending and suggest one thing to cut.</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={getTip} disabled={tipState === 'loading'}>
                  {tipState === 'loading' ? 'Thinking…' : 'Get a tip'}
                </button>
              </div>
            )}
            {tipState === 'error' && (
              <p style={{ color: 'var(--over-text)', fontSize: 13, marginTop: 8 }}>Couldn't get a tip right now — check your API key.</p>
            )}
          </div>
        </>
      )}

      {/* ── Ways to save — friendly evergreen tips, always available ── */}
      <div className="section-title">Ways to save</div>
      <div className="tip-list">
        {saveTips.map((tp, i) => (
          <div className="tip" key={i}>
            <span className="tip-ico">
              <tp.Icon />
            </span>
            <div className="tip-body">
              <div className="t">{tp.t}</div>
              <div className="s">{tp.s}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Make a lump last — the loan/grant stretch planner (advanced) ── */}
      <div className="section-head">
        <div className="section-title" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Make a lump last
          <Explain label="make a lump last">
            Got a loan or grant that has to see you through the term? Tell Leeway the date it needs to last to, and it spreads your
            balance evenly across every day until then — with a little extra for weekends.
          </Explain>
        </div>
      </div>
      {plan.active ? (
        <div className="card card-pad">
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="meta">
              <div className="t" style={{ fontWeight: 700 }}>
                {gbp(plan.pool)} to last {plan.daysLeft} days
              </div>
              <div className="s">until {shortDate(plan.surviveUntil)}</div>
            </div>
            <button className="btn btn-sm" onClick={() => setSurviveOpen(true)}>
              Change
            </button>
          </div>
          {plan.status === 'short' ? (
            <div className="banner warn" style={{ marginBottom: 0 }}>
              <IconAlert />
              <div>
                You're <b>{gbp(plan.shortfall)}</b> short of stretching to {shortDate(plan.surviveUntil)}. Ease a goal, trim a bill,
                or bring the date in.
              </div>
            </div>
          ) : (
            <div className="tiles" style={{ marginTop: 12 }}>
              <div className="tile">
                <div className="k">Every day</div>
                <div className="v accent">{gbp(plan.flatDaily)}</div>
                <div className="h">flat rate</div>
              </div>
              <div className="tile">
                <div className="k">Weekdays</div>
                <div className="v">{gbp(plan.weekdayRate)}</div>
                <div className="h">Mon–Fri</div>
              </div>
              <div className="tile">
                <div className="k">Weekends</div>
                <div className="v">{gbp(plan.weekendRate)}</div>
                <div className="h">Sat–Sun</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card card-pad">
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="meta">
              <div className="t" style={{ fontWeight: 700 }}>Got a loan or grant to stretch?</div>
              <div className="s">Pace a lump across the whole term, not just to payday.</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setSurviveOpen(true)}>
              Set it up
            </button>
          </div>
        </div>
      )}

      {surviveOpen && (
        <Sheet title="Make a lump last" onClose={() => setSurviveOpen(false)}>
          <SurviveForm onDone={() => setSurviveOpen(false)} />
        </Sheet>
      )}
    </div>
  )
}
