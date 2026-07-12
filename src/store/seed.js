import { uid } from '../lib/id.js'

// Demo data, dated relative to "today" so the app is alive the moment it opens.
// Deliberately a believable-but-tight student: solvent, but the pace gauge sits a
// touch over the line and rent is looming just outside the pay window - which is
// exactly the situation the app exists to catch.

function iso(offsetDays) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

export function defaultState() {
  return {
    version: 3,
    balance: 512.4,
    lastReconciled: iso(-2),
    incomeSources: [
      { id: uid(), label: 'Bar shifts', kind: 'monthly', amount: 780, nextDate: iso(12) },
      { id: uid(), label: 'Parental support', kind: 'monthly', amount: 250, nextDate: iso(24) },
    ],
    bills: [
      { id: uid(), label: 'Rent', amount: 480, freq: 'monthly', nextDue: iso(18) },
      { id: uid(), label: 'Phone', amount: 14, freq: 'monthly', nextDue: iso(4) },
      { id: uid(), label: 'Subscriptions', amount: 16, freq: 'monthly', nextDue: iso(9) },
    ],
    goals: [
      { id: uid(), label: 'Summer Interrail', target: 600, saved: 180, deadline: iso(84) },
      { id: uid(), label: 'New laptop', target: 900, saved: 300, deadline: iso(210) },
    ],
    events: [{ id: uid(), label: "Ross's birthday", amount: 55, date: iso(5) }],
    // Illustrative term dates (relative to today) so the calendar's nudge + tints
    // are alive on first open. Freshers is a few days out; exams later in the term.
    termSpans: [
      { id: uid(), kind: 'freshers', label: 'Freshers', start: iso(4), end: iso(10) },
      { id: uid(), kind: 'exams', label: 'Semester exams', start: iso(45), end: iso(56) },
    ],
    transactions: [
      { id: uid(), type: 'expense', label: 'Tesco Metro', amount: 23.4, category: 'groceries', date: iso(-1) },
      { id: uid(), type: 'expense', label: 'Pret', amount: 6.8, category: 'coffee', date: iso(-1) },
      { id: uid(), type: 'expense', label: 'Night bus', amount: 5, category: 'transport', date: iso(-2) },
      { id: uid(), type: 'expense', label: 'Spoons round', amount: 18.5, category: 'going_out', date: iso(-3) },
      { id: uid(), type: 'income', label: 'Sold textbook', amount: 25, category: 'other', date: iso(-4) },
      { id: uid(), type: 'expense', label: 'Big shop', amount: 31.2, category: 'groceries', date: iso(-4) },
      { id: uid(), type: 'expense', label: 'Cinema', amount: 12, category: 'going_out', date: iso(-5) },
      { id: uid(), type: 'expense', label: 'Coffee', amount: 3.6, category: 'coffee', date: iso(-6) },
      { id: uid(), type: 'expense', label: 'Deliveroo', amount: 21.4, category: 'eating_out', date: iso(-7) },
      { id: uid(), type: 'expense', label: 'Bus topup', amount: 10, category: 'transport', date: iso(-9) },
      { id: uid(), type: 'expense', label: 'Tesco', amount: 27.8, category: 'groceries', date: iso(-10) },
    ],
  }
}
