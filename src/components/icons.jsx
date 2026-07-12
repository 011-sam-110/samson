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

export const IconEvents = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M4 9h16M8 3v4M16 3v4" />
    <path d="M12 13v3M10.5 14.5h3" />
  </svg>
)

export const IconInsights = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <rect x="7" y="12" width="3" height="5" />
    <rect x="12" y="8" width="3" height="9" />
    <rect x="17" y="14" width="3" height="3" />
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

export const IconSun = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

export const IconMoon = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5z" />
  </svg>
)
