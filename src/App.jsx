import { Suspense, lazy, useState } from 'react'
import { StoreProvider } from './store/store.js'
import { useTheme } from './lib/theme.js'
import Nav from './components/Nav.jsx'
import AccountMenu from './components/AccountMenu.jsx'
import Dashboard from './components/Dashboard.jsx'
import Transactions from './components/Transactions.jsx'
import CalendarPage from './components/CalendarPage.jsx'
import Goals from './components/Goals.jsx'

// Insights pulls in the charting library — code-split it so it only loads when
// someone actually opens the tab, keeping the first paint (Overview) light.
const Insights = lazy(() => import('./components/Insights.jsx'))

function Shell() {
  const [view, setView] = useState('home')
  const { theme, setTheme } = useTheme()

  return (
    <div className="app">
      <Nav view={view} onNavigate={setView} />
      <main className="main">
        {/* Account sits in the flow above the page, not floating over it — a fixed
            button would collide with Today's own top-right action on a narrow window. */}
        <header className="topbar">
          <AccountMenu theme={theme} setTheme={setTheme} />
        </header>

        {view === 'home' && <Dashboard />}
        {view === 'money' && <Transactions />}
        {view === 'calendar' && <CalendarPage />}
        {view === 'insights' && (
          <Suspense fallback={<div className="empty">Loading your report…</div>}>
            <Insights />
          </Suspense>
        )}
        {view === 'goals' && <Goals />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
