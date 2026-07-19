import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store.js'
import { useAuth } from '../lib/auth-context.jsx'
import { serializeState, parseBackup, backupFilename, downloadJSON } from '../lib/backup.js'
import { Sheet, Segmented } from './ui.jsx'
import { IconUser, IconSettings, IconDownload, IconUpload, IconRefresh, IconTrash } from './icons.jsx'

// The account button every finance app has in the top right. It shows who you're
// signed in as (or that you're a guest on this device only), and collects
// everything that acts on your data *as a whole*: take it with you, bring it
// back, wipe it, sign out.

export default function AccountMenu({ theme, setTheme }) {
  const { state, actions } = useStore()
  const { user, guest, logout, exitGuest } = useAuth()
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const fileRef = useRef(null)

  // A dropdown that outlives a click elsewhere is a dropdown you have to fight.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus() // don't strand focus on a menu that's gone
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onExport = () => {
    downloadJSON(backupFilename(), serializeState(state))
    setOpen(false)
  }

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
    setOpen(false)
  }

  const onReset = () => {
    if (confirm('Reset back to the demo data?')) actions.resetDemo()
    setOpen(false)
  }

  const onClearAll = () => {
    if (confirm('Delete everything and start from an empty Leeway? This cannot be undone.')) {
      actions.clearAll()
      setSettings(false)
    }
  }

  return (
    <div className="account" ref={wrapRef}>
      <button
        ref={btnRef}
        className={`account-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="account-avatar">
          <IconUser />
        </span>
        <span className="account-label">Account</span>
      </button>

      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <div className="menu-title">{user ? user.username || user.email : 'Your Leeway'}</div>
            <div className="menu-sub">
              {user ? 'Saved to your account, on any device' : 'Guest — saved on this device only'}
            </div>
          </div>

          {guest && !user && (
            <button className="menu-item" role="menuitem" onClick={exitGuest}>
              <IconUser />
              <span>
                Save to an account
                <em>Keep your data and use Leeway anywhere</em>
              </span>
            </button>
          )}

          <button className="menu-item" role="menuitem" onClick={onExport}>
            <IconDownload />
            <span>
              Export data
              <em>Download a JSON backup</em>
            </span>
          </button>

          <button className="menu-item" role="menuitem" onClick={() => fileRef.current?.click()}>
            <IconUpload />
            <span>
              Import data
              <em>Restore from a backup file</em>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />

          <button className="menu-item" role="menuitem" onClick={onReset}>
            <IconRefresh />
            <span>
              Reset demo data
              <em>Back to the sample student</em>
            </span>
          </button>

          <div className="menu-sep" />

          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setSettings(true)
            }}
          >
            <IconSettings />
            <span>
              Settings
              <em>Appearance, and clearing your data</em>
            </span>
          </button>

          {user && (
            <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); logout() }}>
              <IconUser />
              <span>
                Log out
                <em>Your data stays safe in your account</em>
              </span>
            </button>
          )}
        </div>
      )}

      {settings && (
        <Sheet title="Settings" onClose={() => setSettings(false)}>
          <div className="set-row">
            <div className="set-meta">
              <div className="t">Appearance</div>
              <div className="s">Leeway follows your device until you pick one here.</div>
            </div>
            <Segmented
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>

          <div className="menu-sep" />

          <div className="set-row">
            <div className="set-meta">
              <div className="t">Clear all data</div>
              <div className="s">
                Deletes every transaction, bill, goal and plan on this device. Export a backup first if you want it back.
              </div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={onClearAll}>
              <IconTrash style={{ width: 15, height: 15 }} />
              Clear
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
