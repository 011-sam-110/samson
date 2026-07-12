// Minimal stroke icons. Inherit color via currentColor; size via CSS.
const S = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' }

export const IconHome = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M12 4a8 8 0 0 0-8 8 8 8 0 0 0 1 3.9" />
    <path d="M20 15.9A8 8 0 0 0 21 12" />
    <path d="M12 12l4-3" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <path d="M5 19h14" />
  </svg>
)

export const IconLedger = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M6 3h9l3 3v15H6z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </svg>
)

export const IconGoals = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const IconSpend = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M3 8a2 2 0 0 1 2-2h12l2 3v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M16 12h.01" />
    <path d="M3 9h14" />
  </svg>
)

export const IconEvents = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M4 9h16M8 3v4M16 3v4" />
    <path d="M12 13v3M10.5 14.5h3" />
  </svg>
)

export const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconClose = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconTrash = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
)

export const IconAlert = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
)

export const IconInfo = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
)

export const IconCheck = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M4 12l5 5L20 6" />
  </svg>
)
