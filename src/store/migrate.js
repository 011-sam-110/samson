import { LEGACY_TYPE_TO_CATEGORY } from '../lib/categories.js'

export const CURRENT_VERSION = 2

// Pure, ordered state migrations. Each step upgrades exactly one version so old
// localStorage data is never wiped on a schema change.
export function migrate(state) {
  if (!state || typeof state !== 'object') return state
  let s = state
  if ((s.version ?? 1) < 2) s = toV2(s)
  return s
}

// v1 stored the spending type ('fixed'|'variable'|'discretionary') in each
// expense's `category`. v2 uses real student categories; map the old tags over.
function toV2(s) {
  const transactions = (s.transactions ?? []).map((t) =>
    t.type === 'expense' && LEGACY_TYPE_TO_CATEGORY[t.category]
      ? { ...t, category: LEGACY_TYPE_TO_CATEGORY[t.category] }
      : t,
  )
  return { ...s, version: 2, transactions }
}
