import { useState } from 'react'
import { StoreProvider } from './store/store.js'
import Nav from './components/Nav.jsx'
import Dashboard from './components/Dashboard.jsx'
import Transactions from './components/Transactions.jsx'
import Goals from './components/Goals.jsx'
import CanISpend from './components/CanISpend.jsx'
import Events from './components/Events.jsx'

function Shell() {
  const [view, setView] = useState('home')

  return (
    <div className="app">
      <Nav view={view} onNavigate={setView} />
      <main className="main">
        {view === 'home' && <Dashboard onNavigate={setView} />}
        {view === 'money' && <Transactions />}
        {view === 'goals' && <Goals />}
        {view === 'spend' && <CanISpend />}
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
