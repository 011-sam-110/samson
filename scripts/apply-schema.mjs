// scripts/apply-schema.mjs
// Apply schema.sql to a real database (Neon in prod) and verify the tables + RLS,
// WITHOUT writing any test data. Reads DATABASE_URL from the environment or .env.local.
// Never prints the connection string. Safe to re-run (schema.sql is idempotent).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/)
      if (m && m[1]) return m[1].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env.local */
  }
  return ''
}

const url = loadDatabaseUrl()
if (!url) {
  console.error('No DATABASE_URL found. Put the Neon connection string in .env.local (DATABASE_URL=...).')
  process.exit(2)
}

const ssl = /neon\.tech|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined
const { Pool } = pg
const db = new Pool({ connectionString: url, ssl })
const here = dirname(fileURLToPath(import.meta.url))
const EXPECT = ['users', 'profiles', 'transactions', 'bills', 'income_sources', 'goals', 'events', 'term_spans', 'usage_events']

async function main() {
  await db.query('select 1')
  console.log('Connected.')
  await db.query(readFileSync(join(here, '..', 'schema.sql'), 'utf8'))
  console.log('Schema applied.\n')
  const r = await db.query("select tablename, rowsecurity from pg_tables where schemaname='public'")
  const present = new Map(r.rows.map((x) => [x.tablename, x.rowsecurity]))
  let ok = true
  for (const t of EXPECT) {
    const has = present.has(t)
    if (!has) ok = false
    const rls = t === 'users' || t === 'usage_events' ? '(no RLS by design)' : present.get(t) ? '(RLS on)' : '(RLS OFF!)'
    console.log(`  ${has ? '✓' : '✗'} ${t} ${has ? rls : 'MISSING'}`)
  }
  await db.end()
  console.log(ok ? '\n✅ Database is ready for accounts.' : '\n❌ Some tables are missing.')
  process.exit(ok ? 0 : 1)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
