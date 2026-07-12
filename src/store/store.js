import { createContext, useContext, useEffect, useMemo, useState, createElement } from 'react'
import { defaultState } from './seed.js'
import { migrate } from './migrate.js'
import { uid } from '../lib/id.js'
import { computeDashboard } from '../engine/finance.js'

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
    const push = (key, item) => setState((s) => ({ ...s, [key]: [{ id: uid(), ...item }, ...s[key]] }))
    const remove = (key, id) => setState((s) => ({ ...s, [key]: s[key].filter((x) => x.id !== id) }))

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

      addGoal: ({ label, target, deadline, saved }) =>
        push('goals', { label, target: Number(target) || 0, deadline, saved: Number(saved) || 0 }),

      // Moving money into a goal pot: it leaves spendable balance and lifts progress.
      contributeToGoal: (id, amount) => {
        const amt = Number(amount) || 0
        setState((s) => ({
          ...s,
          balance: (Number(s.balance) || 0) - amt,
          goals: s.goals.map((g) => (g.id === id ? { ...g, saved: (Number(g.saved) || 0) + amt } : g)),
        }))
      },

      addEvent: ({ label, amount, date }) => push('events', { label, amount: Number(amount) || 0, date }),

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
      removeGoal: (id) => remove('goals', id),
      removeEvent: (id) => remove('events', id),

      importData: (obj) => setState(() => migrate(obj)),
      resetDemo: () => setState(defaultState()),
      clearAll: () =>
        setState({
          version: 1,
          balance: 0,
          lastReconciled: todayISO(),
          incomeSources: [],
          bills: [],
          goals: [],
          events: [],
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
