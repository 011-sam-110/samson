// Best-effort merchant -> category guess for imported transactions. Deterministic
// keyword rules; the user can correct any guess in the review step before importing.

const RULES = [
  [/tesco|sainsbury|asda|aldi|lidl|morrison|co-?op|waitrose|iceland|spar|ocado/i, 'groceries'],
  [/netflix|spotify|disney|amazon prime|prime video|youtube|icloud|patreon|audible|now tv|apple\.com\/bill/i, 'subscriptions'],
  [/pret|costa|starbucks|greggs|caffe|nero|coffee/i, 'coffee'],
  [/deliveroo|uber\s?eats|just\s?eat|mcdonald|kfc|nando|domino|pizza|burger|subway|wagamama/i, 'eating_out'],
  [/tfl|uber|bolt|trainline|railway|\brail\b|\bbus\b|lner|national express|stagecoach|northern|gwr/i, 'transport'],
  [/amazon|asos|primark|h&m|zara|boots|superdrug|argos|urban outfitters|depop|vinted/i, 'shopping'],
  [/\bpub\b|\bbar\b|spoons|wetherspoon|\bclub\b|brewdog|vodka|revolution|tequila/i, 'going_out'],
  [/rent|landlord|lettings|accommodation/i, 'rent'],
  [/gym|pharmacy|dentist|doctor|pure gym|puregym/i, 'health'],
  [/waterstones|blackwell|tuition|university|\bcourse\b|textbook/i, 'course'],
  [/water|energy|british gas|octopus|edf|council tax|vodafone|\bo2\b|three|giffgaff|ee\b/i, 'bills'],
]

export function guessCategory(merchant) {
  const m = String(merchant || '')
  for (const [re, cat] of RULES) if (re.test(m)) return cat
  return 'other'
}
