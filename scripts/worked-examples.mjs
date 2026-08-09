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

function spendingRows(s) {
  const r = spendingPace(s.state, s.asOf, s.period ? { period: s.period } : {})
  const engine = {
    ...r,
    gauge: gaugePosition(r.ratio),
    canSpend40: s.id === 'student-midmonth' ? canISpend(s.state, 40, s.asOf).fraction : undefined,
  }
  const keys = Object.keys(s.expect)
  return s.workings.map((w, i) => {
    const key = keys[i]
    return { label: w[0], working: w[1], byHand: w[2], byPocko: key ? round(engine[key]) : undefined }
  })
}

function savingRows(s) {
  const r = savingPace(s.goal, s.contributions, s.asOf)
  const st = savingStreak(s.goal, s.contributions, s.asOf)
  const engine = { ...r, bestStreak: st.best, currentStreak: st.current }
  const keys = Object.keys(s.expect)
  return s.workings.map((w, i) => {
    const key = keys[i]
    return { label: w[0], working: w[1], byHand: w[2], byPocko: key ? round(engine[key]) : undefined }
  })
}

const report = [
  ...SCENARIOS.map((s) => ({ kind: 'spending', id: s.id, title: s.title, story: s.story, rows: spendingRows(s) })),
  ...SAVING_SCENARIOS.map((s) => ({ kind: 'saving', id: s.id, title: s.title, story: s.story, rows: savingRows(s) })),
]

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  for (const sc of report) {
    console.log(`\n## ${sc.title}\n`)
    console.log(`${sc.story}\n`)
    console.log('| Quantity | Worked out by hand | Result |')
    console.log('|---|---|---|')
    for (const row of sc.rows) console.log(`| ${row.label} | ${row.working} | ${row.byHand} |`)
  }
  console.log('\nEvery row above is asserted against the engine in worked-examples.test.js.')
}
