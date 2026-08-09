import { useEffect, useState } from 'react'
import { gaugePosition, GAUGE_BAND_STOPS } from '../engine/pace.js'

// The green/amber/red semicircle.
//
//   "The 'slider' isn't interactive. It's simply a visual gauge showing where the
//    user's current spending pace sits relative to their sustainable pace... The
//    important thing is that the maths and the visual are separate: formula
//    determines the user's position, gauge simply communicates that position."
//
// So this component decides nothing. It is handed a Spending Pace Ratio and asks the
// engine where that sits on the arc. Every threshold lives in src/engine/pace.js and
// is unit-tested there; changing a band changes the picture automatically.
//
// This replaces the dial the client said "does nothing". The old one compared spending
// to a long-run sustainable rate rather than to the safe-to-spend figure printed
// beside it — so the needle answered a different question from the number — and went
// null whenever no income was configured, freezing it in place.

const CX = 140
const CY = 140
const R = 112
const STROKE = 16

// t ∈ [0,1] across the top semicircle: 0 = far left, 1 = far right.
function point(t, r = R) {
  const rad = Math.PI * (1 - t)
  return [CX + r * Math.cos(rad), CY - r * Math.sin(rad)]
}

function arc(tA, tB) {
  const [x1, y1] = point(tA)
  const [x2, y2] = point(tB)
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`
}

// Where each band starts and ends on the arc, taken from the engine's stops so the
// paint and the needle can never disagree.
const AT = Object.fromEntries(GAUGE_BAND_STOPS.map(([ratio, pos]) => [ratio, pos]))
const GREEN_END = AT[1.05]
const AMBER_END = AT[1.25]

const BAND_COLOR = {
  comfortable: 'var(--good)',
  'on-pace': 'var(--good)',
  over: 'var(--warn)',
  attention: 'var(--bad)',
  overcommitted: 'var(--bad)',
  unknown: 'var(--muted)',
}

const TICKS = Array.from({ length: 21 }, (_, i) => i / 20)

export default function Gauge({ ratio, band = 'unknown', dataQuality = 'ok' }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const known = dataQuality === 'ok' && ratio != null
  const pos = band === 'overcommitted' ? 0.96 : known ? gaugePosition(ratio) : null
  const rot = ready && pos != null ? (pos - 0.5) * 180 : -90
  const markColor = BAND_COLOR[band] || 'var(--muted)'

  // The reference the client named: 1.00 is exactly on pace. It gets a hard notch,
  // because "where am I against the line" is the only question the dial answers.
  const onPaceAt = gaugePosition(1)
  const [nx1, ny1] = point(onPaceAt, R + STROKE / 2 + 6)
  const [nx2, ny2] = point(onPaceAt, R - STROKE / 2 - 4)
  const [mx, my] = point(0.5)

  const label = known
    ? `Spending pace: ${ratio.toFixed(2)} times your sustainable rate`
    : band === 'overcommitted'
      ? 'Your commitments are more than the money available'
      : 'Not enough logged yet to show a spending pace'

  return (
    <svg className="gauge-svg" viewBox="0 0 280 176" role="img" aria-label={label}>
      <path d={arc(0, 1)} style={{ stroke: 'var(--gauge-track)' }} strokeWidth={STROKE} fill="none" strokeLinecap="round" />

      {TICKS.map((tick) => {
        const major = Math.round(tick * 20) % 5 === 0
        const [x1, y1] = point(tick, R + STROKE / 2 + (major ? 8 : 5))
        const [x2, y2] = point(tick, R + STROKE / 2 + 2)
        return (
          <line
            key={tick} x1={x1} y1={y1} x2={x2} y2={y2}
            style={{ stroke: major ? 'var(--gauge-tick-major)' : 'var(--gauge-tick)' }}
            strokeWidth={major ? 1.8 : 1.2} strokeLinecap="round"
          />
        )
      })}

      {/* Green through to red — but only once we actually know where the student is.
          A dial fed nothing used to sit far-left and green, which reads as "you're
          doing great" when it means "I know nothing about you". */}
      {known || band === 'overcommitted' ? (
        <>
          <path d={arc(0, GREEN_END)} style={{ stroke: 'var(--good)' }} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          <path d={arc(GREEN_END, AMBER_END)} style={{ stroke: 'var(--warn)' }} strokeWidth={STROKE} fill="none" />
          <path d={arc(AMBER_END, 1)} style={{ stroke: 'var(--bad)' }} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          <line x1={nx1} y1={ny1} x2={nx2} y2={ny2} style={{ stroke: 'var(--gauge-notch)' }} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : null}

      {pos != null && (
        <g
          style={{
            transform: `rotate(${rot}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: 'transform 900ms cubic-bezier(.2,.85,.25,1)',
          }}
        >
          <circle cx={mx} cy={my} r="12.5" style={{ fill: 'var(--gauge-face)' }} />
          <circle cx={mx} cy={my} r="12.5" fill="none" style={{ stroke: markColor }} strokeWidth="3.5" />
          <circle cx={mx} cy={my} r="4.5" style={{ fill: markColor }} />
        </g>
      )}
    </svg>
  )
}
