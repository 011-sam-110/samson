import { useState } from 'react'
import { useStore } from '../store/store.js'
import { CATEGORIES } from '../lib/categories.js'
import { guessCategory } from '../lib/categorize.js'
import { normalizeDate } from '../lib/extract.js'
import { gbp } from '../lib/format.js'

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read that file.'))
    r.readAsDataURL(file)
  })
}

export default function ImportSheet({ onDone }) {
  const { actions } = useStore()
  const [status, setStatus] = useState('idle') // idle | reading | done | error
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatus('reading')
    setError('')
    try {
      const image = await fileToDataURL(file)
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed.')
      const parsed = (data.transactions || []).map((t) => ({
        merchant: t.merchant,
        amount: t.amount,
        date: normalizeDate(t.date),
        category: t.amount >= 0 ? 'other' : guessCategory(t.merchant),
        include: true,
      }))
      setRows(parsed)
      if (parsed.length) {
        setStatus('done')
      } else {
        setStatus('error')
        setError("Couldn't read any transactions from that image. Try a clearer, tighter screenshot.")
      }
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Something went wrong reading that image.')
    }
  }

  const update = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const selected = rows.filter((r) => r.include)

  return (
    <div>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 14 }}>
        Screenshot your bank transactions and Leeway reads them in. Heads up: the image is sent to your configured AI provider to
        pull out the text.
      </p>

      {(status === 'idle' || status === 'error') && (
        <>
          <label className="btn btn-primary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
            Choose screenshot
            <input type="file" accept="image/*" hidden onChange={onFile} />
          </label>
          {status === 'error' && <p style={{ color: 'var(--over)', fontSize: 14, marginTop: 12 }}>{error}</p>}
        </>
      )}

      {status === 'reading' && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Reading your statement…</p>}

      {status === 'done' && (
        <>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            Found <b style={{ color: 'var(--ink)' }}>{rows.length}</b>. Untick anything wrong, fix a category, then import.
          </p>
          <div className="import-list">
            {rows.map((r, i) => (
              <div key={i} className={`import-row ${r.include ? '' : 'off'}`}>
                <input
                  type="checkbox"
                  checked={r.include}
                  aria-label={`Include ${r.merchant}`}
                  onChange={(e) => update(i, { include: e.target.checked })}
                />
                <div className="import-main">
                  <div className="import-merchant">{r.merchant || '—'}</div>
                  <div className="import-sub">{r.date}</div>
                </div>
                {r.amount >= 0 ? (
                  <span className="import-tag">Income</span>
                ) : (
                  <select value={r.category} onChange={(e) => update(i, { category: e.target.value })}>
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
                <div className={`import-amt mono ${r.amount >= 0 ? 'pos' : ''}`}>
                  {r.amount >= 0 ? '+' : ''}
                  {gbp(r.amount)}
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 14 }}
            disabled={!selected.length}
            onClick={() => {
              actions.importTransactions(selected)
              onDone()
            }}
          >
            Import {selected.length} transaction{selected.length === 1 ? '' : 's'}
          </button>
        </>
      )}
    </div>
  )
}
