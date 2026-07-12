import { describe, it, expect } from 'vitest'
import { buildPool, callLLM } from './llm.js'

const ok = (content) => ({ status: 200, ok: true, json: async () => ({ choices: [{ message: { content } }] }) })
const fail = (status) => ({ status, ok: false, json: async () => ({}) })

describe('buildPool', () => {
  it('includes only providers whose key is present, in order', () => {
    const pool = buildPool({ OPENROUTER_API_KEY: 'x', GROQ_API_KEY: 'g' })
    expect(pool.map((p) => p.name)).toEqual(['groq', 'openrouter'])
    expect(pool[0].key).toBe('g')
  })

  it('is empty when no keys are set', () => {
    expect(buildPool({})).toEqual([])
  })
})

describe('callLLM', () => {
  it('throws when the pool is empty', async () => {
    await expect(callLLM({ pool: [], messages: [] })).rejects.toThrow(/No LLM providers/)
  })

  it('returns the first provider that succeeds', async () => {
    const pool = buildPool({ GROQ_API_KEY: 'g' })
    const r = await callLLM({ pool, messages: [], fetchImpl: async () => ok('hello') })
    expect(r).toMatchObject({ provider: 'groq', text: 'hello' })
  })

  it('fails over to the next provider on a 429', async () => {
    const pool = buildPool({ GROQ_API_KEY: 'g', GEMINI_API_KEY: 'm' })
    let call = 0
    const fetchImpl = async () => (++call === 1 ? fail(429) : ok('from-gemini'))
    const r = await callLLM({ pool, messages: [], fetchImpl })
    expect(call).toBe(2)
    expect(r).toMatchObject({ provider: 'gemini', text: 'from-gemini' })
  })

  it('picks the vision model when vision:true', async () => {
    const pool = buildPool({ GROQ_API_KEY: 'g' })
    let sentModel
    const fetchImpl = async (_url, opts) => {
      sentModel = JSON.parse(opts.body).model
      return ok('ok')
    }
    await callLLM({ pool, messages: [], vision: true, fetchImpl })
    expect(sentModel).toBe('meta-llama/llama-4-scout-17b-16e-instruct')
  })

  it('throws when every provider fails', async () => {
    const pool = buildPool({ GROQ_API_KEY: 'g', GEMINI_API_KEY: 'm' })
    await expect(callLLM({ pool, messages: [], fetchImpl: async () => fail(500) })).rejects.toThrow(/HTTP 500/)
  })
})
