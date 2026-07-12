// Hand-built chart primitives for Insights. Single-hue magnitude bars in brand
// indigo on a muted track - no chart library, no status-colour reuse. Text wears
// ink tokens; the bar length alone carries magnitude.
import { gbp, pct } from '../lib/format.js'

// One ranked magnitude bar: label, £ value, share of total, sized against `max`.
export function BarRow({ label, value, share, max, note }) {
  const width = max > 0 ? Math.max((value / max) * 100, 2) : 0
  return (
    <div className="bar-row">
      <div className="bar-head">
        <span className="bar-label">
          {label}
          {note ? <span className="bar-note"> · {note}</span> : null}
        </span>
        <span className="bar-val mono">{gbp(value)}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${width}%` }} />
      </div>
      {share != null && <div className="bar-share">{pct(share)} of spend</div>}
    </div>
  )
}

// Two-value comparison (e.g. weekday vs weekend £/day). The higher value is the
// emphasised bar; both share the single hue at different weights.
export function SplitBar({ aLabel, aValue, bLabel, bValue }) {
  const max = Math.max(aValue, bValue, 0.01)
  const bar = (label, value, strong) => (
    <div className="bar-row">
      <div className="bar-head">
        <span className="bar-label">{label}</span>
        <span className="bar-val mono">{gbp(value)}/day</span>
      </div>
      <div className="bar-track">
        <div className={`bar-fill ${strong ? '' : 'bar-fill-soft'}`} style={{ width: `${Math.max((value / max) * 100, 2)}%` }} />
      </div>
    </div>
  )
  return (
    <div>
      {bar(aLabel, aValue, aValue >= bValue)}
      {bar(bLabel, bValue, bValue > aValue)}
    </div>
  )
}
