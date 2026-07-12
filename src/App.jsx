import { useState } from 'react'
import { StoreProvider } from './store/store.js'
import { useTheme } from './lib/theme.js'
import { ThemeToggle } from './components/ui.jsx'
import Nav from './components/Nav.jsx'
import Dashboard from './components/Dashboard.jsx'
import Transactions from './components/Transactions.jsx'
import Insights from './components/Insights.jsx'
import Goals from './components/Goals.jsx'
import Events from './components/Events.jsx'

function Shell() {
  const [view, setView] = useState('home')
  const { theme, toggle } = useTheme()

  return (
    <div className="app">
      <Nav view={view} onNavigate={setView} theme={theme} onToggleTheme={toggle} />
      {/* the sidebar is hidden under 860px, so the toggle needs a home there */}
      <ThemeToggle theme={theme} toggle={toggle} className="theme-toggle-float" label={false} />
      <main className="main">
        {view === 'home' && <Dashboard />}
        {view === 'money' && <Transactions />}
        {view === 'insights' && <Insights />}
        {view === 'goals' && <Goals />}
        {view === 'events' && <Events />}
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
