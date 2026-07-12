import { useState } from 'react'
import { useStore } from '../store/store.js'
import { goalProgress } from '../engine/finance.js'
import { gbp, pct, shortDate } from '../lib/format.js'
import { Sheet } from './ui.jsx'
import { GoalForm, ContributeForm } from './forms.jsx'
import { IconPlus, IconTrash, IconCheck } from './icons.jsx'

export default function Goals() {
  const { state, actions } = useStore()
  const [adding, setAdding] = useState(false)
  const [contributing, setContributing] = useState(null)

  const totalWeekly = state.goals.reduce((s, g) => s + goalProgress(g).weeklyRequired, 0)

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Goals</div>
        <h1>Saving up</h1>
        <p>
          {state.goals.length > 0
            ? `Reserving ${gbp(totalWeekly)}/week across ${state.goals.length} goal${state.goals.length > 1 ? 's' : ''}.`
            : 'Set a target and Leeway works the weekly saving into your safe-to-spend.'}
        </p>
      </div>

      <button className="btn btn-primary" onClick={() => setAdding(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <IconPlus style={{ width: 18, height: 18 }} /> New goal
      </button>

      <div className="grid">
        {state.goals.length === 0 && (
          <div className="card card-pad">
            <div className="empty">No goals yet. What are you saving for?</div>
          </div>
        )}
        {state.goals.map((g) => {
          const p = goalProgress(g)
          return (
            <div className="card card-pad" key={g.id}>
              <div className="goal-head">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {g.label}
                  {p.done && (
                    <span className="pill go" style={{ padding: '2px 8px' }}>
                      <IconCheck style={{ width: 13, height: 13 }} /> Done
                    </span>
                  )}
                </h3>
                <span className="g-target">
                  {gbp(g.saved)} / {gbp(g.target)}
                </span>
              </div>

              <div className="bar">
                <span style={{ width: `${Math.round(p.pct * 100)}%` }} />
              </div>

              <div className="goal-foot">
                <span>
                  {p.done ? (
                    'Fully saved 🎉'
                  ) : p.overdue ? (
                    <>Deadline passed - <b>{gbp(p.remaining)}</b> to go</>
                  ) : (
                    <>
                      <b>{gbp(p.weeklyRequired)}</b>/week · by {shortDate(g.deadline)}
                    </>
                  )}
                </span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {!p.done && (
                    <button className="btn btn-sm" onClick={() => setContributing(g)}>
                      Add £
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

      {adding && (
        <Sheet title="New goal" onClose={() => setAdding(false)}>
          <GoalForm onDone={() => setAdding(false)} />
        </Sheet>
      )}
      {contributing && (
        <Sheet title={`Add to ${contributing.label}`} onClose={() => setContributing(null)}>
          <ContributeForm goal={contributing} onDone={() => setContributing(null)} />
        </Sheet>
      )}
    </div>
  )
}
