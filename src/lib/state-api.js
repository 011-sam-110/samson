// src/lib/state-api.js
// Core GET/PUT logic for /api/state, with the DB pool and token verifier INJECTED
// (same seam as src/lib/llm.js's fetchImpl) so it is unit-tested offline.
// user_id ALWAYS comes from the verified token, never the request body.
import { migrate } from '../store/migrate.js'
import { rowsToState, stateToRows, validateState } from './state-serialize.js'

const NUMERIC = new Set(['amount', 'target', 'saved'])
const DATE = new Set(['date', 'next_due', 'next_date', 'deadline', 'start', 'end'])
const castFor = (col) => (col === 'user_id' ? 'text' : NUMERIC.has(col) ? 'numeric' : DATE.has(col) ? 'date' : 'text')

const CHILD = {
  transactions: ['id', 'type', 'label', 'amount', 'category', 'date'],
  bills: ['id', 'label', 'amount', 'freq', 'next_due'],
  income_sources: ['id', 'label', 'kind', 'amount', 'next_date'],
  goals: ['id', 'label', 'target', 'saved', 'deadline'],
  events: ['id', 'label', 'amount', 'date'],
  term_spans: ['id', 'kind', 'label', 'start', 'end'],
}

function bearer(headers) {
  const h = (headers && (headers.authorization || headers.Authorization)) || ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

// timestamptz comes back from the driver as a JS Date (live) or a string (tests).
// Normalize to a canonical ISO string for the client; null on anything unparseable.
function toIso(v) {
  if (v == null) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function handleState(req, deps) {
  const token = bearer(req.headers)
  if (!token) return { status: 401, body: { error: 'Missing token' } }
  let userId
  try {
    const claims = await deps.verifyToken(token, { secretKey: deps.secretKey, authorizedParties: deps.authorizedParties })
    userId = claims && claims.sub
  } catch {
    return { status: 401, body: { error: 'Invalid token' } }
  }
  if (!userId) return { status: 401, body: { error: 'Invalid token' } }

  if (req.method === 'GET') return getState(userId, deps.db)
  if (req.method === 'PUT') return putState(userId, req.body, deps.db)
  return { status: 405, body: { error: 'GET or PUT only' } }
}

async function getState(userId, db) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId])
    const q = (sql) => client.query(sql, [userId])
    const profile = await q('SELECT * FROM profiles WHERE user_id = $1')
    if (!profile.rows.length) {
      await client.query('COMMIT')
      return { status: 200, body: null }
    }
    const transactions = await q('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC')
    const bills = await q('SELECT * FROM bills WHERE user_id = $1')
    const income_sources = await q('SELECT * FROM income_sources WHERE user_id = $1')
    const goals = await q('SELECT * FROM goals WHERE user_id = $1')
    const events = await q('SELECT * FROM events WHERE user_id = $1')
    const term_spans = await q('SELECT * FROM term_spans WHERE user_id = $1')
    await client.query('COMMIT')
    const state = migrate(rowsToState({
      profile: profile.rows[0],
      transactions: transactions.rows, bills: bills.rows, income_sources: income_sources.rows,
      goals: goals.rows, events: events.rows, term_spans: term_spans.rows,
    }))
    return { status: 200, body: { state, updatedAt: toIso(profile.rows[0].updated_at) } }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch { /* ignore */ }
    return { status: 500, body: { error: String((e && e.message) || e) } }
  } finally {
    client.release()
  }
}

async function putState(userId, body, db) {
  let state
  try {
    state = validateState(migrate((body && body.state) || {}))
  } catch (e) {
    return { status: 400, body: { error: String((e && e.message) || e) } }
  }
  const baseUpdatedAt = body && body.baseUpdatedAt != null ? String(body.baseUpdatedAt) : null
  const rows = stateToRows(state, userId)

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId])

    // FOR UPDATE locks the row so two concurrent PUTs can't both pass the guard and
    // then lost-update each other at COMMIT.
    const cur = await client.query('SELECT updated_at FROM profiles WHERE user_id = $1 FOR UPDATE', [userId])
    // A new account (no row) and a null base are allowed through — intended last-write-wins
    // first-write semantics; M7's guest->account import must send the base it last read.
    // Compare as instants: the driver returns a Date, the client echoes back an ISO string.
    if (cur.rows.length && baseUpdatedAt !== null && new Date(cur.rows[0].updated_at).getTime() !== new Date(baseUpdatedAt).getTime()) {
      await client.query('ROLLBACK')
      return { status: 409, body: { error: 'stale', currentUpdatedAt: toIso(cur.rows[0].updated_at) } }
    }

    const upserted = await client.query(
      `INSERT INTO profiles (user_id, balance, last_reconciled, survive_until, schema_version, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE SET
         balance = EXCLUDED.balance, last_reconciled = EXCLUDED.last_reconciled,
         survive_until = EXCLUDED.survive_until, schema_version = EXCLUDED.schema_version, updated_at = now()
       RETURNING updated_at`,
      [userId, rows.profile.balance, rows.profile.last_reconciled, rows.profile.survive_until, rows.profile.schema_version],
    )

    for (const table of Object.keys(CHILD)) {
      await replaceCollection(client, table, CHILD[table], rows[table], userId)
    }

    await client.query('COMMIT')
    return { status: 200, body: { updatedAt: toIso(upserted.rows[0].updated_at) } }
  } catch (e) {
    try { await client.query('ROLLBACK') } catch { /* ignore */ }
    return { status: 500, body: { error: String((e && e.message) || e) } }
  } finally {
    client.release()
  }
}

// Delete the user's rows for one table, then bulk-insert via unnest() — one
// parameterized statement regardless of row count (N=0 short-circuits). Table
// and column names come from the fixed CHILD map, never client input.
async function replaceCollection(client, table, cols, rows, userId) {
  // Identifiers (table + columns) come only from the fixed CHILD map, so quoting them is
  // safe and makes a reserved word like `end` (term_spans) valid; values stay parameterized.
  await client.query(`DELETE FROM "${table}" WHERE user_id = $1`, [userId])
  if (!rows.length) return
  const allCols = ['user_id', ...cols]
  const arrays = allCols.map((c) => rows.map((r) => (c === 'user_id' ? userId : r[c] ?? null)))
  const casts = allCols.map((c, i) => `$${i + 1}::${castFor(c)}[]`)
  const colList = allCols.map((c) => `"${c}"`).join(', ')
  await client.query(
    `INSERT INTO "${table}" (${colList}) SELECT * FROM unnest(${casts.join(', ')})`,
    arrays,
  )
}
