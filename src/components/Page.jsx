// The page contract.
//
// "Every major page should effectively answer: what does all this actually mean for
//  me? at the very top. The detailed graphs can remain underneath for people who want
//  them, but the user shouldn't need to understand a graph to understand their
//  financial situation. Summary first. Evidence second. That's probably the single
//  biggest principle of the redesign."
//
// So the order is a component, not a convention. Every page renders:
//
//   1. Summary      — the largest type on the page, plain English, no jargon
//   2. Hero         — exactly one per page
//   3. Detail       — supporting information
//   4. Tools        — tips and advanced things, always last
//
// A page cannot accidentally put its analytics above its summary, because it does not
// control the order. That is the whole point: hierarchy that survives the next edit.

import { Children, isValidElement } from 'react'

const SLOTS = ['summary', 'hero', 'detail', 'tools']

export function Page({ title, children }) {
  const bySlot = Object.fromEntries(SLOTS.map((s) => [s, []]))
  const loose = []

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const slot = child.props?.slot
    if (slot && bySlot[slot]) bySlot[slot].push(child)
    else loose.push(child)
  })

  return (
    <div className="page">
      {title && <h1 className="page-title">{title}</h1>}
      {bySlot.summary}
      {bySlot.hero.length > 0 && <div className="page-hero">{bySlot.hero}</div>}
      {bySlot.detail}
      {loose}
      {bySlot.tools.length > 0 && <div className="page-tools">{bySlot.tools}</div>}
    </div>
  )
}

// A slot wrapper, so a page reads as its own outline:
//   <Section slot="hero"> … </Section>
export function Section({ children, className = '' }) {
  return <section className={className}>{children}</section>
}

const TONE_CLASS = { good: 'is-good', warn: 'is-warn', bad: 'is-bad', neutral: 'is-neutral' }

/**
 * The summary block. One of these at the top of every page, fed by a pure function
 * from src/engine/summaries.js — never generated text.
 *
 * The tone drives a single restrained accent (a rule down the left edge), not a
 * coloured panel. Colour is rationed on purpose: if the page shouts in green every
 * time things are fine, it has nothing left for the day they are not.
 */
export function PageSummary({ summary }) {
  if (!summary) return null
  const { headline, lines = [], tone = 'neutral' } = summary
  return (
    <section className={`page-summary ${TONE_CLASS[tone] || 'is-neutral'}`} aria-label="Summary">
      <p className="page-summary-headline">{headline}</p>
      {lines.length > 0 && (
        <div className="page-summary-lines">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </section>
  )
}
