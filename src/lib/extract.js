// Statement-extraction prompt + robust parsing of the model's reply into transaction
// rows. Kept in src/ (not /api) so the fiddly parsing is unit-tested.

export const EXTRACT_PROMPT = `You are a bank-statement transaction extractor. Read the image and extract every transaction row.
Return ONLY a JSON array (no prose, no markdown fences). Each element:
{"date": string exactly as shown, "merchant": string, "amount": number - negative for money out, positive for money in}.
If you cannot read it or there are no transactions, return [].`

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
