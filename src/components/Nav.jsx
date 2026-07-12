import { useRef } from 'react'
import { useStore } from '../store/store.js'
import { serializeState, parseBackup, backupFilename, downloadJSON } from '../lib/backup.js'
import { IconHome, IconLedger, IconInsights, IconGoals, IconSpend, IconEvents } from './icons.jsx'

const ITEMS = [
  { key: 'home', label: 'Today', short: 'Today', Icon: IconHome },
  { key: 'money', label: 'Transactions', short: 'Money', Icon: IconLedger },
  { key: 'insights', label: 'Insights', short: 'Insights', Icon: IconInsights },
  { key: 'goals', label: 'Goals', short: 'Goals', Icon: IconGoals },
  { key: 'spend', label: 'Can I spend?', short: 'Spend?', Icon: IconSpend },
  { key: 'events', label: 'Planned', short: 'Plans', Icon: IconEvents },
]

export function BrandMark(props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" {...props}>
      <path d="M4 22a12 12 0 0 1 24 0" stroke="#e7e2d6" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M4 22A12 12 0 0 1 9 12.2" stroke="#17b980" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M16 22l7-6" stroke="#5b4be0" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="22" r="3" fill="#5b4be0" />
    </svg>
  )
}

export default function Nav({ view, onNavigate }) {
  const { state, actions } = useStore()
  const fileRef = useRef(null)

  const onExport = () => downloadJSON(backupFilename(), serializeState(state))

  const onImportFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again later
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const obj = parseBackup(String(reader.result))
        if (confirm('Import this backup? It replaces everything currently in Leeway.')) {
          actions.importData(obj)
        }
      } catch (err) {
        alert(err.message)
      }
    }
    reader.readAsText(file)
  }

  const links = (mobile) =>
    ITEMS.map(({ key, label, short, Icon }) => (
      <button key={key} className={`navlink ${view === key ? 'active' : ''}`} onClick={() => onNavigate(key)} aria-current={view === key ? 'page' : undefined}>
        <Icon />
        <span>{mobile ? short : label}</span>
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
        {links(false)}
        <div className="sidebar-foot">
          <button className="linkish" onClick={onExport}>
            Export data
          </button>
          <button className="linkish" onClick={() => fileRef.current?.click()}>
            Import data
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
          <button className="linkish" onClick={() => confirm('Reset back to the demo data?') && actions.resetDemo()}>
            Reset demo data
          </button>
        </div>
      </aside>

      <nav className="bottomnav">{links(true)}</nav>
    </>
  )
}
