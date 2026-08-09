import { useState } from 'react'
import { useStore } from '../store/store.js'
import { gbp, shortDate } from '../lib/format.js'
import { typeOf, categoryLabel } from '../lib/categories.js'
import { Sheet } from './ui.jsx'
import { ExpenseForm, IncomeForm } from './forms.jsx'
import ImportSheet from './ImportSheet.jsx'
import { IconPlus, IconTrash } from './icons.jsx'
import { transactionsSummary } from '../engine/summaries.js'
import { Page, PageSummary, Section } from './Page.jsx'

function Avatar({ label, cls }) {
  return <div className={`avatar ${cls}`}>{(label || '?').trim().charAt(0).toUpperCase()}</div>
}

export default function Transactions() {
  const { state, actions } = useStore()
  const [sheet, setSheet] = useState(null)

  const ledger = [...state.transactions].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <Page title="Transactions">
      <Section slot="summary">
        <PageSummary summary={transactionsSummary(state, new Date())} />
      </Section>

      <Section slot="hero">
      <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
        <button className="btn btn-primary" onClick={() => setSheet('expense')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconPlus style={{ width: 18, height: 18 }} /> Add expense
        </button>
        <button className="btn" onClick={() => setSheet('income')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconPlus style={{ width: 18, height: 18 }} /> Add income
        </button>
        <button className="btn" onClick={() => setSheet('import')}>
          Import screenshot
        </button>
      </div>
      </Section>

      <Section slot="detail">
      <div className="section-title">Money coming in</div>
      <div className="card card-pad">
        {state.incomeSources.length === 0 && <div className="empty">No regular income set up yet.</div>}
        {state.incomeSources.map((i) => (
          <div className="row" key={i.id}>
            <Avatar label={i.label} cls="cat-income" />
            <div className="meta">
              <div className="t">{i.label}</div>
              <div className="s">
                {i.kind === 'hourly' ? `£${i.rate}/hr · ${i.hoursPerWeek}h/wk` : `per ${i.kind === 'weekly' ? 'week' : 'month'}`}
                {i.nextDate ? ` · next ${shortDate(i.nextDate)}` : ''}
              </div>
            </div>
            <div className="amt pos">
              +{gbp(i.kind === 'hourly' ? i.rate * i.hoursPerWeek : i.amount)}
            </div>
            <button className="btn-icon" aria-label={`Remove ${i.label}`} onClick={() => actions.removeIncome(i.id)}>
              <IconTrash />
            </button>
          </div>
        ))}
      </div>

      <div className="section-title">Regular bills</div>
      <div className="card card-pad">
        {state.bills.length === 0 && <div className="empty">No recurring bills yet - add rent, your phone, the gym.</div>}
        {state.bills.map((b) => (
          <div className="row" key={b.id}>
            <Avatar label={b.label} cls="cat-fixed" />
            <div className="meta">
              <div className="t">{b.label}</div>
              <div className="s">
                per {b.freq === 'weekly' ? 'week' : 'month'}
                {b.nextDue ? ` · next ${shortDate(b.nextDue)}` : ''}
              </div>
            </div>
            <div className="amt neg">-{gbp(b.amount)}</div>
            <button className="btn-icon" aria-label={`Remove ${b.label}`} onClick={() => actions.removeBill(b.id)}>
              <IconTrash />
            </button>
          </div>
        ))}
      </div>

      <div className="section-title">One-off spends</div>
      <div className="card card-pad">
        {ledger.length === 0 && <div className="empty">Nothing logged yet. Tap "Add expense" to add your first.</div>}
        {ledger.map((t) => (
          <div className="row" key={t.id}>
            <Avatar label={t.label} cls={t.type === 'income' ? 'cat-income' : `cat-${typeOf(t.category)}`} />
            <div className="meta">
              <div className="t">{t.label}</div>
              <div className="s">
                {shortDate(t.date)} · {t.type === 'income' ? 'Income' : categoryLabel(t.category)}
              </div>
            </div>
            <div className={`amt ${t.type === 'income' ? 'pos' : 'neg'}`}>
              {t.type === 'income' ? '+' : '-'}
              {gbp(t.amount)}
            </div>
            <button className="btn-icon" aria-label={`Remove ${t.label}`} onClick={() => actions.removeTransaction(t.id)}>
              <IconTrash />
            </button>
          </div>
        ))}
      </div>

      </Section>

      {sheet === 'expense' && (
        <Sheet title="Add expense" onClose={() => setSheet(null)}>
          <ExpenseForm onDone={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet === 'income' && (
        <Sheet title="Add income" onClose={() => setSheet(null)}>
          <IncomeForm onDone={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet === 'import' && (
        <Sheet title="Import from a screenshot" onClose={() => setSheet(null)}>
          <ImportSheet onDone={() => setSheet(null)} />
        </Sheet>
      )}
    </Page>
  )
}
