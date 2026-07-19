// src/lib/sync.js
// Pull/push the whole state document to the cloud for a signed-in user. The server
// keys everything to the verified session, so there is no user id to pass here.
export async function pullState() {
  const res = await fetch('/api/state', { credentials: 'same-origin' })
  if (res.status === 401) throw new Error('Not signed in')
  if (!res.ok) throw new Error('Could not load your saved data')
  return res.json() // { state, updatedAt } | null
}

// Returns { updatedAt } on success, or { conflict: true, currentUpdatedAt } when a
// newer version exists on the server (another device/tab saved since we last read).
export async function pushState(state, baseUpdatedAt) {
  const res = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ state, baseUpdatedAt: baseUpdatedAt ?? null }),
  })
  if (res.status === 409) {
    const d = await res.json().catch(() => ({}))
    return { conflict: true, currentUpdatedAt: d.currentUpdatedAt || null }
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error || 'Could not save your data')
  }
  return res.json() // { updatedAt }
}
