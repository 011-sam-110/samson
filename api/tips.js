// Serverless: pre-computed spending facts -> one short student-toned cut-back tip.
// The LLM writes words only; every number is computed in the engine and passed in.
import { buildPool, callLLM } from '../src/lib/llm.js'

const SYSTEM = `You are Leeway, a UK student's blunt-but-friendly money mate. You are given pre-computed facts about their spending as JSON. Write ONE short tip (max 2 sentences) about the easiest thing to cut back, in plain British English - encouraging, never preachy. Use only the numbers provided; never invent figures. No emojis, no markdown, no preamble.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { facts } = req.body || {}
  if (!facts) return res.status(400).json({ error: 'Missing facts.' })

  const pool = buildPool(process.env)
  try {
    const { text, provider } = await callLLM({
      pool,
      maxTokens: 200,
      temperature: 0.5,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify(facts) },
      ],
    })
    return res.status(200).json({ tip: text.trim(), provider })
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) })
  }
}
