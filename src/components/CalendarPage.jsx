import Calendar from './Calendar.jsx'

// Calendar is now its own top-level page, split out of Insights. It's where the
// month's spending heat, upcoming bills and planned nights out live together —
// and where term dates get set so Leeway can warn you ahead of the pricey weeks.
export default function CalendarPage() {
  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Your month</div>
        <h1>Calendar</h1>
        <p>See where your money went day by day, spot the bills and plans coming up, and mark your term dates.</p>
      </div>

      <div className="card card-pad">
        <Calendar />
      </div>
    </div>
  )
}
