// Statement-extraction prompt + robust parsing of the model's reply into transaction
// rows. Kept in src/ (not /api) so the fiddly parsing is unit-tested.

export const EXTRACT_PROMPT = `You are a bank-statement transaction extractor. Read the image and extract every transaction row.
Return ONLY a JSON array (no prose, no markdown fences). Each element:
{"date": string exactly as shown, "merchant": string, "amount": number - negative for money out, positive for money in}.
If you cannot read it or there are no transactions, return [].`

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

function iso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

// Statement dates come in many shapes ("11 Jul", "2026-07-11", "11/07/2026").
// Normalise to ISO. When the year is missing and the date would be in the future,
// assume it belongs to last year (statements are of the past).
export function normalizeDate(str, asOf = new Date()) {
  const s = String(str || '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  const yr = s.match(/\b(20\d{2})\b/)
  m = s.match(/(\d{1,2})\s*([a-z]{3})/i) || s.match(/([a-z]{3})\s*(\d{1,2})/i)
  if (m) {
    const day = /^\d/.test(m[1]) ? +m[1] : +m[2]
    const mon = /^\d/.test(m[1]) ? MONTHS[m[2].toLowerCase()] : MONTHS[m[1].toLowerCase()]
    if (mon != null && day) {
      let year = yr ? +yr[1] : asOf.getFullYear()
      if (!yr && new Date(year, mon, day) > asOf) year -= 1
      return iso(new Date(year, mon, day))
    }
  }

  m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (m) {
    let year = +m[3]
    if (year < 100) year += 2000
    return iso(new Date(year, +m[2] - 1, +m[1])) // assume DD/MM/YYYY (UK)
  }

  return iso(asOf)
}

export function parseTransactions(text) {
  if (!text) return []
  const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return []
  let arr
  try {
    arr = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []
  return arr
    .filter((t) => t && typeof t === 'object' && t.amount != null && (t.merchant || t.date))
    .map((t) => ({
      date: String(t.date ?? ''),
      merchant: String(t.merchant ?? '').trim(),
      amount: Number(t.amount) || 0,
    }))
}
