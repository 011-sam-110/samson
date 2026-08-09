import { LEGACY_TYPE_TO_CATEGORY } from '../lib/categories.js'

export const CURRENT_VERSION = 4

// Pure, ordered state migrations. Each step upgrades exactly one version so old
// localStorage data is never wiped on a schema change.
export function migrate(state) {
  if (!state || typeof state !== 'object') return state
  let s = state
  if ((s.version ?? 1) < 2) s = toV2(s)
  if ((s.version ?? 1) < 3) s = toV3(s)
  if ((s.version ?? 1) < 4) s = toV4(s)
  return s
}

// v4 introduces the dated contribution ledger, which saving pace depends on.
//
// Before v4 a goal carried one running `saved` number, so nothing recorded WHEN
// money went in — "saved in the last 7 days" had no answer and the pace could not
// be computed at all. Contributions are now their own dated rows.
//
// The existing total becomes `openingBalance`: money the student had already put
// aside before Pocko. It still counts toward visible progress (nobody watches
// their goal bar drop on upgrade) but deliberately counts for NOTHING in the
// saving pace, because it was never saved inside a window we measured.
function toV4(s) {
  const goals = (s.goals ?? []).map(({ saved, ...g }) => ({
    ...g,
    openingBalance: Number(saved) || 0,
  }))
  return {
    ...s,
    version: 4,
    goals,
    contributions: Array.isArray(s.contributions) ? s.contributions : [],
  }
}

// v3 introduces the term calendar (M5). Old data simply gains an empty term list.
function toV3(s) {
  return { ...s, version: 3, termSpans: Array.isArray(s.termSpans) ? s.termSpans : [] }
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
