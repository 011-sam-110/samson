import { useEffect, useState } from 'react'

// The signature: a spend speedometer. The marker is your CURRENT daily spend;
// the coloured arc is measured against your TARGET (sustainable) daily rate.
// Green = under the safe line, amber = a touch over, red = spending too fast.
//
//   rate = currentDaily / targetDaily   (1.0 == exactly on the safe line)
//   overCommitted = your fixed commitments already exceed income → pinned red.
//
// Colours come from CSS tokens (--go / --warn / --over, --gauge-*), so the dial
// stays muted-professional and flips cleanly between light and dark.

const CX = 140
const CY = 140
const R = 112
const STROKE = 15

// t ∈ [0,1] across the top semicircle: 0 = far left, 0.5 = top (the safe line), 1 = far right.
function point(t, r = R) {
  const rad = Math.PI * (1 - t)
  return [CX + r * Math.cos(rad), CY - r * Math.sin(rad)]
}

function arc(tA, tB) {
  const [x1, y1] = point(tA)
  const [x2, y2] = point(tB)
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`
}

export function zoneOf(rate, overCommitted) {
  if (overCommitted) return 'over'
  if (rate == null) return 'go'
  if (rate < 1) return 'go'
  if (rate < 1.5) return 'tight'
  return 'over'
}

const ZONE_VAR = { go: 'var(--go)', tight: 'var(--warn)', over: 'var(--over)' }

// Dial ticks, minus the two that would collide with the safe-line notch.
const TICKS = Array.from({ length: 21 }, (_, i) => i / 20).filter((t) => Math.abs(t - 0.5) > 0.02)

export default function Gauge({ pace, overCommitted }) {
  const rate = pace // kept prop name; it's the current/target ratio
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const zone = zoneOf(rate, overCommitted)
  // Marker position. Scale tops out at 2× target so the safe line sits dead centre.
  const t = overCommitted ? 0.94 : rate == null ? 0.5 : Math.max(0, Math.min(rate / 2, 1))
  const rot = ready ? (t - 0.5) * 180 : -90
  const markColor = ZONE_VAR[zone]

  // Target/"safe line" notch at the top.
  const [nx, nyOut] = point(0.5, R + STROKE / 2 + 5)
  const [, nyIn] = point(0.5, R - STROKE / 2 - 4)
  const [mx, my] = point(0.5) // marker's home position (top); rotated into place

  return (
    <svg className="gauge-svg" viewBox="0 0 280 176" role="img" aria-label={`Spending rate: ${zone}`}>
      {/* base track */}
      <path d={arc(0, 1)} style={{ stroke: 'var(--gauge-track)' }} strokeWidth={STROKE} fill="none" strokeLinecap="round" />

      {/* ticks — the "instrument" texture */}
      {TICKS.map((tick) => {
        const major = Math.round(tick * 20) % 5 === 0
        const [x1, y1] = point(tick, R + STROKE / 2 + (major ? 8 : 5))
        const [x2, y2] = point(tick, R + STROKE / 2 + 2)
        return (
          <line
            key={tick}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            style={{ stroke: major ? 'var(--gauge-tick-major)' : 'var(--gauge-tick)' }}
            strokeWidth={major ? 1.8 : 1.2}
            strokeLinecap="round"
          />
        )
      })}

      {/* zones — green → amber → red, left to right (muted tokens) */}
      <path d={arc(0, 0.5)} style={{ stroke: 'var(--go)' }} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      <path d={arc(0.5, 0.75)} style={{ stroke: 'var(--warn)' }} strokeWidth={STROKE} fill="none" />
      <path d={arc(0.75, 1)} style={{ stroke: 'var(--over)' }} strokeWidth={STROKE} fill="none" strokeLinecap="round" />

      {/* the safe line: the whole point of the dial, so it gets a hard notch */}
      <line x1={nx} y1={nyOut} x2={nx} y2={nyIn} style={{ stroke: 'var(--gauge-notch)' }} strokeWidth="3" strokeLinecap="round" />

      {/* "you are here" marker — rides the arc, keeping the centre clear for the number */}
      <g
        style={{
          transform: `rotate(${rot}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: 'transform 900ms cubic-bezier(.2,.85,.25,1)',
        }}
      >
        <circle cx={mx} cy={my} r="12" style={{ fill: 'var(--gauge-face)' }} />
        <circle cx={mx} cy={my} r="12" fill="none" style={{ stroke: markColor }} strokeWidth="3.5" />
        <circle cx={mx} cy={my} r="4.5" style={{ fill: markColor }} />
      </g>
    </svg>
  )
}
