import { IconHome, IconLedger, IconCalendar, IconInsights, IconGoals } from './icons.jsx'

// One name per section, used on desktop and mobile alike. The nav label, the
// page's <h1> and the way we talk about it in copy all say the same word —
// a sidebar that says "Transactions" and a tab bar that says "Money" is the
// fastest way to make someone feel lost in their own money app.
//
// "Overview" leads: the quick daily glance (balance + what's safe to spend).
// The calendar earned its own tab so it isn't buried inside Insights. "Can I
// spend?" was never a place, so it's a sheet on Overview; "Planned" lives in
// Goals — both are money promised away.
const ITEMS = [
  { key: 'home', label: 'Overview', Icon: IconHome },
  { key: 'money', label: 'Transactions', Icon: IconLedger },
  { key: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { key: 'insights', label: 'Insights', Icon: IconInsights },
  { key: 'goals', label: 'Goals', Icon: IconGoals },
]

// The dial, in miniature. Every stroke is a theme token, so the mark flips with
// the app: the needle and arc ride --brand-ink (violet on paper, aqua on dark).
// It used to hard-code an invented teal, which on white was a 1.4:1 stroke —
// all but invisible in the very theme it shipped in.
export function BrandMark(props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" {...props}>
      <path d="M4 22a12 12 0 0 1 24 0" stroke="var(--line)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M4 22A12 12 0 0 1 9 12.2" stroke="var(--brand-ink)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M16 22l7-6" stroke="var(--brand-ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="22" r="3" fill="var(--brand-ink)" />
    </svg>
  )
}

export default function Nav({ view, onNavigate }) {
  const links = () =>
    ITEMS.map(({ key, label, Icon }) => (
      <button
        key={key}
        className={`navlink ${view === key ? 'active' : ''}`}
        onClick={() => onNavigate(key)}
        aria-current={view === key ? 'page' : undefined}
      >
        <Icon />
        <span>{label}</span>
      </button>
    ))

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <BrandMark className="brand-mark" />
          <span className="brand-name">
            Lee<b>way</b>
          </span>
        </div>
        {links()}
      </aside>

      <nav className="bottomnav">{links()}</nav>
    </>
  )
}
