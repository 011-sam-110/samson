import { useEffect, useRef, useState } from 'react'
import { IconClose } from './icons.jsx'

// Bottom-sheet / modal dialog. Closes on backdrop click or Escape.
export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// A labelled field wrapper, with an optional hint under the control.
export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

// Segmented control (radio-as-buttons).
export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Count-up for the hero readout (respects reduced motion).
export function useCountUp(target, ms = 700) {
  const [val, setVal] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setVal(target)
      from.current = target
      return
    }
    const start = performance.now()
    const a = from.current
    let raf
    const tick = (now) => {
      const t = Math.min((now - start) / ms, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(a + (target - a) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}
