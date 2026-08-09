import { createContext, useContext, useEffect, useMemo, useState, createElement } from 'react'
import { defaultState } from './seed.js'
import { migrate, CURRENT_VERSION } from './migrate.js'
import { uid } from '../lib/id.js'
import { computeDashboard } from '../engine/finance.js'

// Deliberately still 'leeway' after the rename to Pocko: this is where every
// existing user's data physically lives. Renaming the key would silently reset
// the app for everyone who already has it open.
const KEY = 'leeway:v1'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch {
    /* corrupt or unavailable - fall through to seed */
  }
  return defaultState()
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* private mode / quota - the app still works for the session */
  }
}

const StoreContext = createContext(null)

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(load)

  useEffect(() => save(state), [state])

  const actions = useMemo(() => {
    const patch = (fn) => setState((s) => ({ ...s, ...fn(s) }))
    // `|| []` guards a collection that a hand-edited or pre-M5 backup can leave
    // absent — spreading/filtering undefined would crash the whole app.
    const push = (key, item) => setState((s) => ({ ...s, [key]: [{ id: uid(), ...item }, ...(s[key] || [])] }))
    const remove = (key, id) => setState((s) => ({ ...s, [key]: (s[key] || []).filter((x) => x.id !== id) }))

    return {
      // Balance: log actuals against it so the number stays honest.
      reconcileBalance: (amount) =>
        patch(() => ({ balance: Number(amount) || 0, lastReconciled: todayISO() })),

      // One "add expense" flow (like the walkthrough): one-off logs to the ledger and
      // moves the balance; recurring becomes a committed bill.
      addExpense: ({ label, amount, category, freq, dueDate }) => {
        const amt = Number(amount) || 0
        if (freq === 'oneoff') {
          push('transactions', { type: 'expense', label, amount: amt, category, date: todayISO() })
          patch((s) => ({ balance: (Number(s.balance) || 0) - amt }))
        } else {
          push('bills', { label, amount: amt, freq, nextDue: dueDate || todayISO() })
        }
      },

      addIncome: ({ label, amount, freq, nextDate }) => {
        const amt = Number(amount) || 0
        if (freq === 'oneoff') {
          push('transactions', { type: 'income', label, amount: amt, category: 'variable', date: todayISO() })
          patch((s) => ({ balance: (Number(s.balance) || 0) + amt }))
        } else {
          push('incomeSources', { label, kind: freq, amount: amt, nextDate: nextDate || todayISO() })
        }
      },

      // `saved` on the form is "already put aside before Pocko" — an opening balance.
      // It counts toward the goal bar but never toward saving pace.
      addGoal: ({ label, target, deadline, saved }) =>
        push('goals', { label, target: Number(target) || 0, deadline, openingBalance: Number(saved) || 0 }),

      // Moving money into a goal pot: it leaves spendable balance and lands as a DATED
      // row in the ledger. The date is the whole point — saving pace is "how much went
      // in over how many days", which a running total could never answer.
      contributeToGoal: (goalId, amount, date) => {
        const amt = Number(amount) || 0
        if (amt <= 0) return
        setState((s) => ({
          ...s,
          balance: (Number(s.balance) || 0) - amt,
          contributions: [
            { id: uid(), goalId, amount: amt, date: date || todayISO() },
            ...(s.contributions || []),
          ],
        }))
      },

      // Undo a contribution: the money comes back to spendable, and the day it was
      // logged stops counting toward the pace.
      removeContribution: (id) =>
        setState((s) => {
          const row = (s.contributions || []).find((c) => c.id === id)
          if (!row) return s
          return {
            ...s,
            balance: (Number(s.balance) || 0) + (Number(row.amount) || 0),
            contributions: (s.contributions || []).filter((c) => c.id !== id),
          }
        }),

      addEvent: ({ label, amount, date }) => push('events', { label, amount: Number(amount) || 0, date }),

      // Term calendar (M5): named date spans (Freshers/exams/term) the calendar highlights.
      addTermSpan: ({ kind, label, start, end }) => push('termSpans', { kind, label: (label || '').trim(), start, end }),

      // Loan-survival: the date a lump (loan/grant) must last you until. null clears it.
      setSurviveUntil: (date) => patch(() => ({ surviveUntil: date || null })),

      // Bulk import of historical transactions (from a statement screenshot). These
      // already happened and are reflected in the real balance, so DON'T move the balance.
      importTransactions: (rows) =>
        setState((s) => ({
          ...s,
          transactions: [
            ...rows.map((r) => ({
              id: uid(),
              type: (Number(r.amount) || 0) >= 0 ? 'income' : 'expense',
              label: r.merchant || 'Imported',
              amount: Math.abs(Number(r.amount) || 0),
              category: r.category || 'other',
              date: r.date,
            })),
            ...s.transactions,
          ],
        })),

      removeTransaction: (id) => remove('transactions', id),
      removeBill: (id) => remove('bills', id),
      removeIncome: (id) => remove('incomeSources', id),
      // Deleting a goal takes its ledger rows with it — orphaned contributions would
      // keep counting toward the overall saving pace for a goal that no longer exists.
      removeGoal: (id) =>
        setState((s) => ({
          ...s,
          goals: (s.goals || []).filter((g) => g.id !== id),
          contributions: (s.contributions || []).filter((c) => c.goalId !== id),
        })),
      removeEvent: (id) => remove('events', id),
      removeTermSpan: (id) => remove('termSpans', id),

      importData: (obj) => setState(() => migrate(obj)),
      resetDemo: () => setState(defaultState()),
      clearAll: () =>
        setState({
          version: CURRENT_VERSION,
          balance: 0,
          lastReconciled: todayISO(),
          incomeSources: [],
          bills: [],
          goals: [],
          contributions: [],
          events: [],
          termSpans: [],
          transactions: [],
        }),
    }
  }, [])

  const dash = useMemo(() => computeDashboard(state, new Date()), [state])

  const value = useMemo(() => ({ state, actions, dash }), [state, actions, dash])
  return createElement(StoreContext.Provider, { value }, children)
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
