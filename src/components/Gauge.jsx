import { useEffect, useState } from 'react'

// The signature: a spend speedometer. The needle is your CURRENT daily spend;
// the coloured arc is measured against your TARGET (sustainable) daily rate.
// Green = under the safe line, amber = a touch over, red = speeding.
//
//   pace = currentDaily / targetDaily   (1.0 == exactly on the safe line)
//   overCommitted = your fixed commitments already exceed income → pinned red.

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

export function zoneOf(pace, overCommitted) {
  if (overCommitted) return 'over'
  if (pace == null) return 'go'
  if (pace < 1) return 'go'
  if (pace < 1.5) return 'tight'
  return 'over'
}

const ZONE_COLOR = { go: '#17c98a', tight: '#f4b03e', over: '#ff6b6b' }

export default function Gauge({ pace, overCommitted }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const zone = zoneOf(pace, overCommitted)
  // Marker position. Scale tops out at 2× target so the safe line sits dead centre.
  let t = overCommitted ? 0.94 : pace == null ? 0.5 : Math.max(0, Math.min(pace / 2, 1))
  const rot = ready ? (t - 0.5) * 180 : -90
  const markColor = ZONE_COLOR[zone]

  // Target/"safe line" notch at the top.
  const [nx, nyOut] = point(0.5, R + STROKE / 2 + 4)
  const [, nyIn] = point(0.5, R - STROKE / 2 - 3)
  const [mx, my] = point(0.5) // marker's home position (top); rotated into place

  return (
    <svg className="gauge-svg" viewBox="0 0 280 172" role="img" aria-label={`Spending pace: ${zone}`}>
      {/* base track */}
      <path d={arc(0, 1)} stroke="rgba(255,255,255,0.10)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      {/* zones */}
      <path d={arc(0, 0.5)} stroke={ZONE_COLOR.go} strokeWidth={STROKE} fill="none" strokeLinecap="round" opacity="0.92" />
      <path d={arc(0.5, 0.75)} stroke={ZONE_COLOR.tight} strokeWidth={STROKE} fill="none" opacity="0.92" />
      <path d={arc(0.75, 1)} stroke={ZONE_COLOR.over} strokeWidth={STROKE} fill="none" strokeLinecap="round" opacity="0.92" />

      {/* safe-line notch */}
      <line x1={nx} y1={nyOut} x2={nx} y2={nyIn} stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" />

      {/* "you are here" marker - rides on the arc, keeping the centre clear for the number */}
      <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: 'transform 900ms cubic-bezier(.2,.85,.25,1)' }}>
        <circle cx={mx} cy={my} r="12" fill="#12132a" />
        <circle cx={mx} cy={my} r="12" fill="none" stroke={markColor} strokeWidth="3.5" />
        <circle cx={mx} cy={my} r="4.5" fill={markColor} />
      </g>
    </svg>
  )
}
