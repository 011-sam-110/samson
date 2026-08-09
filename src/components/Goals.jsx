import { useState } from 'react'
import { useStore } from '../store/store.js'
import { savingPace, savingStreak } from '../engine/saving.js'
import { goalsSummary } from '../engine/summaries.js'
import { gbp, shortDate } from '../lib/format.js'
import { Page, PageSummary, Section } from './Page.jsx'
import { Sheet, Explain } from './ui.jsx'
import { GoalForm, ContributeForm } from './forms.jsx'
import { IconPlus, IconTrash, IconCheck } from './icons.jsx'
import SavingPaceBar from './SavingPaceBar.jsx'

// Saving goals.
//
// The client's rule for this page, and the reason the numbers here are not the ones
// that used to be here: "I don't want the saving pace to pretend that money has been
// saved when it hasn't actually been saved."
//
// So a goal shows two different things and never blurs them:
//   • the bar   — everything in the pot, including money put aside before Pocko
//   • the pace  — dated transfers only, measured against what the goal needs
//
// Planned spends have moved to the Calendar, where a dated cost belongs.

const BAND_LABEL = {
  ahead: 'Ahead of pace',
  'on-pace': 'On pace',
  'slightly-behind': 'Slightly behind',
  behind: 'Behind',
  done: 'Done',
  missed: 'Deadline passed',
  unknown: 'No transfers yet',
}

const BAND_PILL = { ahead: 'go', 'on-pace': 'go', 'slightly-behind': 'tight', behind: 'over', done: 'go', missed: 'over', unknown: '' }

export default function Goals() {
  const { state, actions } = useStore()
  const [adding, setAdding] = useState(false)
  const [contributing, setContributing] = useState(null)

  const asOf = new Date()
  const summary = goalsSummary(state, asOf)
  const goals = state.goals || []

  return (
    <Page title="Saving goals">
      <Section slot="summary">
        <PageSummary summary={summary} />
      </Section>

      <Section slot="hero">
        <div className="sec-head">
          <h2>What you're saving for</h2>
          <button className="btn btn-sm" onClick={() => setAdding(true)}>
            <IconPlus style={{ width: 16, height: 16 }} /> New goal
          </button>
        </div>

        <div className="grid">
          {goals.length === 0 && (
            <div className="card card-pad">
              <div className="empty">No goals yet. What are you saving for?</div>
            </div>
          )}

          {goals.map((g) => {
            const p = savingPace(g, state.contributions, asOf)
            const streak = savingStreak(g, state.contributions, asOf)
            return (
              <div className="card card-pad goal-card" key={g.id}>
                <div className="goal-head">
                  <h3>
                    {g.label}
                    {p.done && (
                      <span className="pill go goal-done">
                        <IconCheck style={{ width: 13, height: 13 }} /> Done
                      </span>
                    )}
                  </h3>
                  <span className="g-target">
                    {gbp(p.savedTotal)} / {gbp(p.target)}
                  </span>
                </div>

                <div className={`bar ${p.done ? 'done' : ''}`}>
                  <span style={{ width: `${Math.round(p.pct * 100)}%` }} />
                </div>

                {/* Where the money in that bar actually came from. An opening balance
                    is real progress but was never saved in a window we watched, so it
                    is named rather than quietly folded into the pace below. */}
                {p.openingBalance > 0 && (
                  <p className="goal-origin">
                    {gbp(p.openingBalance)} was already put aside before Pocko
                    {p.contributed > 0 && <> · {gbp(p.contributed)} transferred since</>}
                  </p>
                )}

                {!p.done && !p.missed && (
                  <div className="goal-pace">
                    <div className="goal-pace-top">
                      <span className="label">
                        Saving pace
                        <Explain label="saving pace">
                          What you've actually transferred per day, against what this goal needs per day to land
                          on time. <b>1.00</b> is exactly on track. Only real transfers count — spending less than
                          usual is good, but it isn't saving until the money moves.
                        </Explain>
                      </span>
                      <span className={`pill ${BAND_PILL[p.band]}`}>{BAND_LABEL[p.band]}</span>
                    </div>

                    <SavingPaceBar pace={p} />

                    <p className="goal-working">
                      {p.dataQuality === 'insufficient' ? (
                        <>Needs {gbp(p.requiredDaily)} a day. Nothing transferred yet.</>
                      ) : (
                        <>
                          You're putting in <b>{gbp(p.actualDaily)}</b> a day; it needs{' '}
                          <b>{gbp(p.requiredDaily)}</b> a day — that's <b>{p.ratio.toFixed(2)}×</b>.
                        </>
                      )}
                    </p>

                    {streak.current >= 2 && (
                      <p className="goal-streak">
                        🔥 {streak.current} days at or above the pace this goal needs.
                      </p>
                    )}
                  </div>
                )}

                <div className="goal-foot">
                  <span>
                    {p.done ? (
                      'Fully saved'
                    ) : p.missed ? (
                      <>Deadline passed — <b>{gbp(p.remaining)}</b> to go</>
                    ) : (
                      <>
                        <b>{gbp(p.remaining)}</b> to go by {shortDate(g.deadline)}
                      </>
                    )}
                  </span>
                  <span className="goal-actions">
                    {!p.done && (
                      <button className="btn btn-sm btn-tinted" onClick={() => setContributing(g)}>
                        Move money in
                      </button>
                    )}
                    <button className="btn-icon" aria-label={`Remove ${g.label}`} onClick={() => actions.removeGoal(g.id)}>
                      <IconTrash />
                    </button>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section slot="tools">
        <div className="sec-head">
          <h2>Getting there faster</h2>
        </div>
        <div className="card card-pad tips">
          <p>Move money the day it arrives. A transfer on payday is one you never notice.</p>
          <p>A goal only holds back what it still needs — clearing one frees up the daily figure on Overview.</p>
          <p>Pushing a deadline out lowers what the goal asks of you each day. That's a real option, not a failure.</p>
        </div>
      </Section>

      {adding && (
        <Sheet title="New goal" onClose={() => setAdding(false)}>
          <GoalForm onDone={() => setAdding(false)} />
        </Sheet>
      )}
      {contributing && (
        <Sheet title={`Move money into ${contributing.label}`} onClose={() => setContributing(null)}>
          <ContributeForm goal={contributing} onDone={() => setContributing(null)} />
        </Sheet>
      )}
    </Page>
  )
}
