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

export const IconUser = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
)

export const IconSettings = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)

export const IconDownload = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M5 19h14" />
  </svg>
)

export const IconUpload = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M5 19h14" />
  </svg>
)

export const IconRefresh = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M20 11a8 8 0 1 0-.6 4" />
    <path d="M20 4v7h-7" />
  </svg>
)

export const IconWallet = (p) => (
  <svg viewBox="0 0 24 24" {...S} {...p}>
    <path d="M3 8a2 2 0 0 1 2-2h12l2 3v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M16 12h.01" />
    <path d="M3 9h14" />
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

