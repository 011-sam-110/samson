// Rotating pool of OpenAI-compatible LLM providers, built from whichever keys are
// present in the environment. Used ONLY server-side (in /api) - never bundled to the
// client. Fails over to the next provider on rate-limit/5xx so a pool of the user's
// own free-tier keys stays resilient.

export const PROVIDERS = [
  {
    name: 'groq',
    base: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    textModel: 'llama-3.3-70b-versatile',
    visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
  {
    name: 'gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    textModel: 'gemini-2.5-flash-lite',
    visionModel: 'gemini-2.5-flash-lite',
  },
  {
    name: 'openrouter',
    base: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    textModel: 'meta-llama/llama-3.3-70b-instruct:free',
    visionModel: 'meta-llama/llama-4-scout:free',
  },
]

// Ordered list of usable providers (those with a key present in `env`).
export function buildPool(env = {}) {
  return PROVIDERS.filter((p) => env[p.keyEnv]).map((p) => ({ ...p, key: env[p.keyEnv] }))
}

// Try each provider in order; skip on 429/5xx; return the first success.
// `fetchImpl` is injectable for tests. Throws if the pool is empty or all fail.
export async function callLLM({ pool, messages, vision = false, maxTokens = 1024, temperature = 0.2, fetchImpl }) {
  const doFetch = fetchImpl || fetch
  if (!pool || pool.length === 0) {
    throw new Error('No LLM providers configured. Add a key (e.g. GROQ_API_KEY) to .env.local.')
  }
  let lastErr
  for (const p of pool) {
    const model = vision ? p.visionModel : p.textModel
    try {
      const res = await doFetch(`${p.base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p.key}`,
          'User-Agent': 'Pocko/1.0',
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      })
      if (res.status === 429 || res.status >= 500 || !res.ok) {
        lastErr = new Error(`${p.name} HTTP ${res.status}`)
        continue
      }
      const data = await res.json()
      return { provider: p.name, model, text: data?.choices?.[0]?.message?.content ?? '' }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('All LLM providers failed')
}
