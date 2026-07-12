// Serverless: bank-statement screenshot -> structured transactions (vision LLM).
// Deploys to Vercel as-is; served locally by the Vite dev middleware.
import { buildPool, callLLM } from '../src/lib/llm.js'
import { EXTRACT_PROMPT, parseTransactions } from '../src/lib/extract.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { image } = req.body || {}
  if (!image || typeof image !== 'string') return res.status(400).json({ error: 'Missing image data URL.' })

  const pool = buildPool(process.env)
  try {
    const { text, provider } = await callLLM({
      pool,
      vision: true,
      maxTokens: 1500,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACT_PROMPT },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
    })
    return res.status(200).json({ transactions: parseTransactions(text), provider })
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) })
  }
}
