// scripts/db-integration.mjs
// Real end-to-end check of the account + cloud-sync backend against an actual
// Postgres, driving the SAME handler code the serverless functions use (no mocks,
// no production-code changes). Run:  DATABASE_URL=... node scripts/db-integration.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'
import { handleSignup, handleLogin, handleMe, handleUsage } from '../src/lib/auth-handlers.js'
import { handleState } from '../src/lib/state-api.js'
import { userIdFromRequest, parseCookies, SESSION_COOKIE } from '../src/lib/auth.js'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:leeway@localhost:5433/leeway'
const SECRET = 'integration-secret-please-32-chars-long'
const { Pool } = pg
const db = new Pool({ connectionString: DATABASE_URL })

let failures = 0
const check = (name, cond, extra = '') =>
  cond ? console.log('  ✓', name) : (console.log('  ✗', name, extra), failures++)

const cookieHeader = (res) => `${SESSION_COOKIE}=${parseCookies(res.cookies?.[0] || '')[SESSION_COOKIE]}`
const authenticate = (req) => userIdFromRequest(req, SECRET)

const sampleState = () => ({
  version: 3, balance: 512.4, lastReconciled: '2026-07-01', surviveUntil: null,
  incomeSources: [{ id: 'i1', label: 'Maintenance loan', kind: 'termly', amount: 2000, nextDate: '2026-09-30' }],
  bills: [{ id: 'b1', label: 'Rent', amount: 450, freq: 'monthly', nextDue: '2026-08-01' }],
  goals: [{ id: 'g1', label: 'Interrail', target: 300, saved: 50, deadline: '2026-12-01' }],
  events: [{ id: 'e1', label: 'Night out', amount: 40, date: '2026-07-20' }],
  termSpans: [{ id: 't1', kind: 'term', label: 'Autumn', start: '2026-09-21', end: '2026-12-11' }],
  transactions: [{ id: 'x1', type: 'expense', label: 'Tesco', amount: 23.4, category: 'groceries', date: '2026-07-18' }],
})

async function main() {
  for (let i = 0; i < 40; i++) {
    try { await db.query('select 1'); break } catch (e) {
      if (i === 39) throw e
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  console.log('DB reachable, applying schema…')
  const here = dirname(fileURLToPath(import.meta.url))
  await db.query(readFileSync(join(here, '..', 'schema.sql'), 'utf8'))

  const deps = { db, sessionSecret: SECRET, secure: false }
  const email = `stud${Date.now()}@uni.ac.uk`
  const password = 'longenough1'

  console.log('\nAccounts:')
  const su = await handleSignup({ body: { email, password, username: 'Stud' } }, deps)
  check('signup returns 201 + session cookie', su.status === 201 && !!parseCookies(su.cookies?.[0] || '')[SESSION_COOKIE], JSON.stringify(su.body))
  const uid = su.body.user.id
  const cookie = cookieHeader(su)

  const me = await handleMe({ headers: { cookie } }, deps)
  check('me() resolves the session to the right user', me.status === 200 && me.body.user.id === uid)

  const dup = await handleSignup({ body: { email, password } }, deps)
  check('duplicate email is rejected (409)', dup.status === 409)

  const li = await handleLogin({ body: { email, password } }, deps)
  check('login with correct password (200)', li.status === 200 && li.body.user.id === uid)
  const bad = await handleLogin({ body: { email, password: 'wrongpass99' } }, deps)
  check('login with wrong password (401)', bad.status === 401)

  console.log('\nCloud sync (state):')
  const put1 = await handleState({ method: 'PUT', headers: { cookie }, body: { state: sampleState(), baseUpdatedAt: null } }, { db, authenticate })
  check('first PUT saves (200)', put1.status === 200, JSON.stringify(put1.body))
  const base = put1.body.updatedAt

  const get1 = await handleState({ method: 'GET', headers: { cookie }, body: null }, { db, authenticate })
  check('GET returns the saved state', get1.status === 200 && get1.body?.state?.balance === 512.4)
  check('numeric round-trips exactly (23.40)', get1.body?.state?.transactions?.[0]?.amount === 23.4)
  check('reserved-word column "end" round-trips', get1.body?.state?.termSpans?.[0]?.end === '2026-12-11')
  check('dates round-trip as YYYY-MM-DD', get1.body?.state?.bills?.[0]?.nextDue === '2026-08-01')

  const stale = await handleState({ method: 'PUT', headers: { cookie }, body: { state: sampleState(), baseUpdatedAt: '2020-01-01T00:00:00.000Z' } }, { db, authenticate })
  check('stale write is rejected (409)', stale.status === 409)

  const put2 = await handleState({ method: 'PUT', headers: { cookie }, body: { state: { ...sampleState(), balance: 300 }, baseUpdatedAt: base } }, { db, authenticate })
  check('matching-base update saves (200)', put2.status === 200)

  console.log('\nUsage + isolation:')
  const us = await handleUsage({ headers: { cookie }, body: { event: 'view_insights', meta: { tab: 'spend' } } }, { db, sessionSecret: SECRET })
  check('usage event accepted (202)', us.status === 202)
  const cnt = await db.query('select count(*)::int n from usage_events where user_id=$1', [uid])
  check('usage row persisted', cnt.rows[0].n === 1)

  const su2 = await handleSignup({ body: { email: `other${Date.now()}@uni.ac.uk`, password } }, deps)
  const get2 = await handleState({ method: 'GET', headers: { cookie: cookieHeader(su2) }, body: null }, { db, authenticate })
  check('a fresh user sees no one else’s data (null)', get2.body === null)

  const anon = await handleState({ method: 'GET', headers: {}, body: null }, { db, authenticate })
  check('no session is refused (401)', anon.status === 401)

  console.log(failures === 0 ? '\n✅ ALL INTEGRATION CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
  await db.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('ERROR', e); try { await db.end() } catch { /* */ } process.exit(1) })
