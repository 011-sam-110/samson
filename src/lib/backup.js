// Portable JSON backup of the whole app state. Pure helpers are unit-tested;
// downloadJSON is a thin DOM wrapper (browser only).

// The collections the whole app indexes into. A backup that merely *mentions*
// these keys isn't enough: `{"transactions": {}}` used to satisfy an `in` check,
// then blow up on `.map` deep inside migrate() - past the import handler's catch
// and into a render, which takes the app down with a blank screen. An imported
// file is untrusted input, so check the shapes here, where we can still say so
// in English, rather than trusting them and crashing later.
const ARRAY_KEYS = ['incomeSources', 'bills', 'goals', 'events', 'transactions']

// Collections added after v1 backups existed. Older exports predate them, so a
// missing key is fine (migration fills it) — but a present value that isn't an
// array is the same crash class as ARRAY_KEYS and must be rejected here.
const OPTIONAL_ARRAY_KEYS = ['termSpans', 'contributions']

const NOT_A_BACKUP = "That doesn't look like a Leeway backup."

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
    throw new Error(NOT_A_BACKUP)
  }
  if (typeof obj.balance !== 'number' || !Number.isFinite(obj.balance)) {
    throw new Error(NOT_A_BACKUP)
  }
  for (const k of ARRAY_KEYS) {
    if (!Array.isArray(obj[k])) throw new Error(NOT_A_BACKUP)
  }
  for (const k of OPTIONAL_ARRAY_KEYS) {
    if (k in obj && !Array.isArray(obj[k])) throw new Error(NOT_A_BACKUP)
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
