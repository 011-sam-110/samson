import { useState } from 'react'
import { useStore } from '../store/store.js'
import { calendarSummary } from '../engine/summaries.js'
import { Page, PageSummary, Section } from './Page.jsx'
import Calendar from './Calendar.jsx'
import PlannedSpends from './PlannedSpends.jsx'

// Calendar: where the month's spending, the bills coming up and the nights out you
// have already planned live together.
//
// Planned spends moved here from Saving Goals. A planned spend is a dated cost, which
// is a calendar idea; sitting it next to savings asked the user to hold a distinction
// the engine never made.

export default function CalendarPage() {
  const { state } = useStore()
  const [asOf] = useState(() => new Date())

  return (
    <Page title="Calendar">
      <Section slot="summary">
        <PageSummary summary={calendarSummary(state, asOf)} />
      </Section>

      <Section slot="hero">
        <div className="card card-pad">
          <Calendar />
        </div>
      </Section>

      <Section slot="detail">
        <PlannedSpends />
      </Section>
    </Page>
  )
}
