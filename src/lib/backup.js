// Portable JSON backup of the whole app state. Pure helpers are unit-tested;
// downloadJSON is a thin DOM wrapper (browser only).

const REQUIRED_KEYS = ['balance', 'incomeSources', 'bills', 'goals', 'events', 'transactions']

export function serializeState(state) {
  return JSON.stringify(state, null, 2)
}

export function parseBackup(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error("That doesn't look like a Leeway backup.")
  }
  for (const k of REQUIRED_KEYS) {
    if (!(k in obj)) throw new Error("That doesn't look like a Leeway backup.")
  }
  return obj
}

export function backupFilename(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `leeway-backup-${y}-${m}-${d}.json`
}

export function downloadJSON(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
