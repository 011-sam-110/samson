// Theme: follow the OS by default, and remember an explicit choice for ever.
//
// Three states, not two — "system" is a real setting, not the absence of one.
// Someone whose phone goes dark at sunset should see Leeway go dark at sunset,
// until the moment they say otherwise. So we only ever write to storage when
// the user actually picks, and a stored value always wins.

import { useCallback, useEffect, useState } from 'react'

const KEY = 'leeway:theme' // kept out of the finance state: it's a device
// preference, not data, and it must not travel in an export/import backup

const DARK_Q = '(prefers-color-scheme: dark)'

export function storedTheme() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null // private mode — fall back to the OS for the session
  }
}

export function systemTheme() {
  return typeof matchMedia === 'function' && matchMedia(DARK_Q).matches ? 'dark' : 'light'
}

export function resolveTheme() {
  return storedTheme() ?? systemTheme()
}

// The single place the DOM is touched. index.html runs this same logic inline
// before first paint, so there is never a white flash on a dark-mode load.
function apply(theme) {
  document.documentElement.dataset.theme = theme
}

export function useTheme() {
  const [theme, setTheme] = useState(resolveTheme)
  const [pinned, setPinned] = useState(() => storedTheme() != null)

  useEffect(() => apply(theme), [theme])

  // While unpinned, keep tracking the OS — including a change made mid-session.
  useEffect(() => {
    if (pinned || typeof matchMedia !== 'function') return
    const mq = matchMedia(DARK_Q)
    const onChange = (e) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pinned])

  // Picking a theme pins it: from here on the OS no longer gets a vote.
  const choose = useCallback((next) => {
    if (next !== 'light' && next !== 'dark') return
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* private mode — the choice still holds for this session */
    }
    setPinned(true)
    setTheme(next)
  }, [])

  return { theme, setTheme: choose }
}
