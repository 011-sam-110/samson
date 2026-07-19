// src/lib/track.js
// Fire-and-forget usage ping. Best-effort: never awaited, never throws, never blocks
// the UI. No-ops for guests (401 is swallowed). `keepalive` lets it survive a page nav.
export function track(event, meta) {
  try {
    fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({ event, meta }),
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}
