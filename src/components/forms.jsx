import { useState } from 'react'
import { useStore } from '../store/store.js'
import { CATEGORIES } from '../lib/categories.js'
import { Field, Segmented } from './ui.jsx'

function isoOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
const today = () => new Date().toISOString().slice(0, 10)

function AmountInput({ value, onChange, autoFocus }) {
  return (
    <div className="prefix">
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="0.00"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function ExpenseForm({ onDone }) {
  const { actions } = useStore()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('groceries')
  const [freq, setFreq] = useState('oneoff')
  const [dueDate, setDueDate] = useState(isoOffset(7))
  const ok = label.trim() && Number(amount) > 0

  const submit = (e) => {
    e.preventDefault()
    if (!ok) return
    actions.addExpense({ label: label.trim(), amount, category, freq, dueDate })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <Field label="What was it?">
        <input value={label} autoFocus placeholder="e.g. Tesco, night out, rent" onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field label="Amount">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Category">
        <div className="chip-grid">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              className={`btn btn-sm ${category === c.key ? 'btn-primary' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="How often?">
        <Segmented
          value={freq}
          onChange={setFreq}
          options={[
            { value: 'oneoff', label: 'One-off' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
        />
      </Field>
      {freq !== 'oneoff' && (
        <Field label="Next due">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      )}
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ok}>
        {freq === 'oneoff' ? 'Log spend' : 'Add recurring bill'}
      </button>
    </form>
  )
}

export function IncomeForm({ onDone }) {
  const { actions } = useStore()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [freq, setFreq] = useState('monthly')
  const [nextDate, setNextDate] = useState(isoOffset(14))
  const ok = label.trim() && Number(amount) > 0

  const submit = (e) => {
    e.preventDefault()
    if (!ok) return
    actions.addIncome({ label: label.trim(), amount, freq, nextDate })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <Field label="Where from?">
        <input value={label} autoFocus placeholder="e.g. Bar job, parents, loan" onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field label="Amount">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="How often?">
        <Segmented
          value={freq}
          onChange={setFreq}
          options={[
            { value: 'oneoff', label: 'One-off' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
        />
      </Field>
      {freq !== 'oneoff' && (
        <Field label="Next payday">
          <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </Field>
      )}
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ok}>
        {freq === 'oneoff' ? 'Log income' : 'Add income source'}
      </button>
    </form>
  )
}

export function GoalForm({ onDone }) {
  const { actions } = useStore()
  const [label, setLabel] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [deadline, setDeadline] = useState(isoOffset(84))
  const ok = label.trim() && Number(target) > 0

  const submit = (e) => {
    e.preventDefault()
    if (!ok) return
    actions.addGoal({ label: label.trim(), target, saved, deadline })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <Field label="What are you saving for?">
        <input value={label} autoFocus placeholder="e.g. Interrail, new laptop" onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Target">
          <AmountInput value={target} onChange={setTarget} />
        </Field>
        <Field label="Already saved">
          <AmountInput value={saved} onChange={setSaved} />
        </Field>
      </div>
      <Field label="By when?">
        <input type="date" value={deadline} min={today()} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ok}>
        Add goal
      </button>
    </form>
  )
}

export function EventForm({ onDone }) {
  const { actions } = useStore()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(isoOffset(3))
  const ok = label.trim() && Number(amount) > 0

  const submit = (e) => {
    e.preventDefault()
    if (!ok) return
    actions.addEvent({ label: label.trim(), amount, date })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <Field label="What's coming up?">
        <input value={label} autoFocus placeholder="e.g. Ross's birthday, gig, weekend away" onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Rough spend">
          <AmountInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="When?">
          <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ok}>
        Add to the plan
      </button>
    </form>
  )
}

export function SurviveForm({ onDone }) {
  const { state, actions } = useStore()
  const [date, setDate] = useState(state.surviveUntil || isoOffset(90))
  const ok = !!date

  const submit = (e) => {
    e.preventDefault()
    if (!ok) return
    actions.setSurviveUntil(date)
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 14 }}>
        Got a loan or grant that has to see you through the term? Tell Leeway the date it needs to last to, and it'll pace your
        current balance across every day until then.
      </p>
      <Field label="Make it last until">
        <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ok}>
        Set the stretch
      </button>
      {state.surviveUntil && (
        <button
          type="button"
          className="linkish"
          style={{ marginTop: 12 }}
          onClick={() => {
            actions.setSurviveUntil(null)
            onDone()
          }}
        >
          Clear it
        </button>
      )}
    </form>
  )
}

export function ReconcileForm({ onDone }) {
  const { state, actions } = useStore()
  const [amount, setAmount] = useState(String(state.balance ?? ''))
  const ok = amount !== '' && Number(amount) >= 0

  const submit = (e) => {
    e.preventDefault()
    if (!ok) return
    actions.reconcileBalance(Number(amount))
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 14 }}>
        Open your banking app and type in what it actually says. This keeps your safe-to-spend honest even if you forget to log the odd coffee.
      </p>
      <Field label="Real balance right now">
        <AmountInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ok}>
        Update balance
      </button>
    </form>
  )
}

export function ContributeForm({ goal, onDone }) {
  const { actions } = useStore()
  const [amount, setAmount] = useState('')
  const ok = Number(amount) > 0

  const submit = (e) => {
    e.preventDefault()
    if (!ok) return
    actions.contributeToGoal(goal.id, amount)
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 14 }}>
        Moving money into <b>{goal.label}</b>. It leaves your spendable balance and bumps your progress.
      </p>
      <Field label="Amount to add">
        <AmountInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ok}>
        Add to pot
      </button>
    </form>
  )
}
