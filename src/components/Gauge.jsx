import { useEffect, useState } from 'react'

// The signature: a spend speedometer. The marker is your CURRENT daily spend;
// the coloured arc is measured against your TARGET (sustainable) daily rate.
// Aqua = under the safe line, coral = a touch over, raspberry = speeding.
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

const ZONE_COLOR = { go: '#78EBE5', tight: '#FF7F50', over: '#E43673' }

// Dial ticks, minus the two that would collide with the safe-line notch.
const TICKS = Array.from({ length: 21 }, (_, i) => i / 20).filter((t) => Math.abs(t - 0.5) > 0.02)

export default function Gauge({ pace, overCommitted }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const zone = zoneOf(pace, overCommitted)
  // Marker position. Scale tops out at 2× target so the safe line sits dead centre.
  const t = overCommitted ? 0.94 : pace == null ? 0.5 : Math.max(0, Math.min(pace / 2, 1))
  const rot = ready ? (t - 0.5) * 180 : -90
  const markColor = ZONE_COLOR[zone]

  // Target/"safe line" notch at the top.
  const [nx, nyOut] = point(0.5, R + STROKE / 2 + 5)
  const [, nyIn] = point(0.5, R - STROKE / 2 - 4)
  const [mx, my] = point(0.5) // marker's home position (top); rotated into place

  return (
    <svg className="gauge-svg" viewBox="0 0 280 176" role="img" aria-label={`Spending pace: ${zone}`}>
      <defs>
        <linearGradient id="g-go" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4BD9D1" />
          <stop offset="100%" stopColor="#78EBE5" />
        </linearGradient>
        <linearGradient id="g-tight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFA9E7" />
          <stop offset="100%" stopColor="#FF7F50" />
        </linearGradient>
        <linearGradient id="g-over" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF7F50" />
          <stop offset="100%" stopColor="#E43673" />
        </linearGradient>
        <filter id="g-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* base track */}
      <path d={arc(0, 1)} stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />

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
            stroke={major ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.14)'}
            strokeWidth={major ? 1.8 : 1.2}
            strokeLinecap="round"
          />
        )
      })}

      {/* zones — cool to hot, left to right */}
      <path d={arc(0, 0.5)} stroke="url(#g-go)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      <path d={arc(0.5, 0.75)} stroke="url(#g-tight)" strokeWidth={STROKE} fill="none" />
      <path d={arc(0.75, 1)} stroke="url(#g-over)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />

      {/* the safe line: the whole point of the dial, so it gets a hard white notch */}
      <line x1={nx} y1={nyOut} x2={nx} y2={nyIn} stroke="#fff" strokeWidth="3" strokeLinecap="round" />

      {/* "you are here" marker — rides the arc, keeping the centre clear for the number */}
      <g
        style={{
          transform: `rotate(${rot}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: 'transform 900ms cubic-bezier(.2,.85,.25,1)',
        }}
      >
        <circle cx={mx} cy={my} r="13" fill={markColor} opacity="0.3" filter="url(#g-glow)" />
        <circle cx={mx} cy={my} r="12" fill="#150B26" />
        <circle cx={mx} cy={my} r="12" fill="none" stroke={markColor} strokeWidth="3.5" />
        <circle cx={mx} cy={my} r="4.5" fill={markColor} />
      </g>
    </svg>
  )
}
