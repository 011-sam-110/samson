import { useEffect, useId, useRef, useState } from 'react'
import { IconClose, IconInfo } from './icons.jsx'

// A small ⓘ button that reveals a plain-English explanation. Built for the
// "no unexplained jargon" rule: keyboard-focusable, toggles on click/Enter,
// closes on Escape or an outside click, and announces itself to screen readers.
export function Explain({ label, children }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className="explain" ref={wrapRef}>
      <button
        type="button"
        className="explain-btn"
        aria-label={`What does "${label}" mean?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <IconInfo />
      </button>
      {open && (
        <span className="explain-pop" role="tooltip" id={id}>
          {children}
        </span>
      )}
    </span>
  )
}

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
