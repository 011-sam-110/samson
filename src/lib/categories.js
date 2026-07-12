// Single source of truth for spending categories.
// Each student-facing category derives the fixed|variable|discretionary "type"
// the finance engine's run-rate already depends on, so the engine stays untouched.

export const CATEGORIES = [
  { key: 'groceries', label: 'Groceries', type: 'variable' },
  { key: 'eating_out', label: 'Eating out', type: 'discretionary' },
  { key: 'going_out', label: 'Going out', type: 'discretionary' },
  { key: 'transport', label: 'Transport', type: 'variable' },
  { key: 'coffee', label: 'Coffee & snacks', type: 'discretionary' },
  { key: 'shopping', label: 'Shopping', type: 'discretionary' },
  { key: 'subscriptions', label: 'Subscriptions', type: 'fixed' },
  { key: 'bills', label: 'Bills', type: 'fixed' },
  { key: 'rent', label: 'Rent', type: 'fixed' },
  { key: 'health', label: 'Health', type: 'variable' },
  { key: 'course', label: 'Course & books', type: 'variable' },
  { key: 'other', label: 'Other', type: 'discretionary' },
]

const BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]))
const LEGACY_TYPES = new Set(['fixed', 'variable', 'discretionary'])
const LEGACY_LABELS = { fixed: 'Fixed', variable: 'Variable', discretionary: 'Fun' }

// v1 stored the spending type in the `category` field; map it to a real category on migrate.
export const LEGACY_TYPE_TO_CATEGORY = { fixed: 'bills', variable: 'groceries', discretionary: 'other' }

export function typeOf(category) {
  if (LEGACY_TYPES.has(category)) return category
  return BY_KEY[category]?.type ?? 'discretionary'
}

export function categoryLabel(category) {
  if (BY_KEY[category]) return BY_KEY[category].label
  return LEGACY_LABELS[category] ?? 'Spend'
}
