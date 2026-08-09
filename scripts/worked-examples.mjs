// Prints the worked examples as a table: the hand-calculation next to what Pocko
// actually returns. Run with `node scripts/worked-examples.mjs`, or
// `node scripts/worked-examples.mjs --json` to feed the client review page.
//
// This exists because the client asked to be able to check the maths against a
// spreadsheet. Reading a test file is not that; reading a table is.

import { SCENARIOS, SAVING_SCENARIOS } from '../src/engine/worked-examples.js'
import { spendingPace, canISpend, gaugePosition } from '../src/engine/pace.js'
import { savingPace, savingStreak } from '../src/engine/saving.js'

const round = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)

// Each working row NAMES the quantity it describes. An earlier version paired the
// rows against Object.keys(expect) by POSITION, which silently mismatched wherever
// the two lists differed in length or order — printing "£360 ÷ 18 ... 360" for a
// row whose answer is 20. The tests never had the bug (they look up by name); only
// this client-facing table did, which is the worse place for it.
function rowsFor(scenario, engine) {
  return scenario.workings.map(([label, working, key]) => ({
    label,
    working,
    key,
    byHand: key in scenario.expect ? scenario.expect[key] : undefined,
    byPocko: key ? round(engine[key]) : undefined,
  }))
}

const near = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : a === b)

function spendingEngine(s) {
  const r = spendingPace(s.state, s.asOf, s.period ? { period: s.period } : {})
  return { ...r, gauge: gaugePosition(r.ratio), canSpend40: canISpend(s.state, 40, s.asOf).fraction }
}

function savingEngine(s) {
  const r = savingPace(s.goal, s.contributions, s.asOf)
  const st = savingStreak(s.goal, s.contributions, s.asOf)
  return { ...r, bestStreak: st.best, currentStreak: st.current }
}

const report = [
  ...SCENARIOS.map((s) => ({ kind: 'spending', id: s.id, title: s.title, story: s.story, rows: rowsFor(s, spendingEngine(s)) })),
  ...SAVING_SCENARIOS.map((s) => ({ kind: 'saving', id: s.id, title: s.title, story: s.story, rows: rowsFor(s, savingEngine(s)) })),
]

// Every row must agree, or this table is not evidence of anything.
const disagreements = report.flatMap((sc) => sc.rows.filter((r) => r.key && !near(r.byHand, r.byPocko)))
if (disagreements.length) {
  console.error('MISMATCH between the hand calculation and the engine:')
  for (const d of disagreements) console.error(`  ${d.label}: by hand ${d.byHand}, Pocko ${d.byPocko}`)
  process.exit(1)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  for (const sc of report) {
    console.log(`\n## ${sc.title}\n`)
    console.log(`${sc.story}\n`)
    console.log('| Quantity | Worked out by hand | By hand | Pocko |')
    console.log('|---|---|---|---|')
    for (const row of sc.rows) console.log(`| ${row.label} | ${row.working} | ${row.byHand} | ${row.byPocko} |`)
  }
  console.log('\nEvery row above is asserted against the engine in worked-examples.test.js.')
}
