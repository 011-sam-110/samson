import { Suspense, lazy, useState, useEffect } from 'react'
import { StoreProvider } from './store/store.js'
import { useTheme } from './lib/theme.js'
import { AuthProvider, useAuth } from './lib/auth-context.jsx'
import { track } from './lib/track.js'
import AuthScreen from './components/AuthScreen.jsx'
import CloudSync from './components/CloudSync.jsx'
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

  // Which pages the trial students actually use. No-op for guests (401, swallowed).
  useEffect(() => {
    track('view', { view })
  }, [view])

  return (
    <div className="app">
      <Nav view={view} onNavigate={setView} />
      <main className="main">
        {/* Account sits in the flow above the page, not floating over it — a fixed
            button would collide with Overview's own top-right action on a narrow window. */}
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

// Decides what a visitor sees: a brief boot state while we check the session
// cookie, the sign-in screen, or the app itself. Signed-in users additionally get
// CloudSync (mounted inside the store so it can read/replace state).
function Gate() {
  const { user, loading, guest } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          color: '#5b6b7f',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        Loading…
      </div>
    )
  }

  if (!user && !guest) return <AuthScreen />

  return (
    <StoreProvider>
      {user && <CloudSync />}
      <Shell />
    </StoreProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
