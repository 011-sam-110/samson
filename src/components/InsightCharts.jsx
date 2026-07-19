// Insights charts, built on recharts and themed from the app's own CSS tokens so
// they stay in the white/blue/navy system and flip cleanly in dark mode.
//
// dataviz notes honoured: single blue hue for magnitude (length carries the
// value, colour says nothing), hairline recessive gridlines, a 2px line with a
// soft wash area, tooltips on hover, ink-token text (never the data colour), and
// clear axis labels. One series → no legend box (the card title names it).

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { gbp, shortDate, fullDate } from '../lib/format.js'

// Read the resolved palette off the root. Cheap, and re-read on every render, so
// a theme toggle (which re-renders the tree) repaints the charts to match.
function palette() {
  if (typeof window === 'undefined') return {}
  const s = getComputedStyle(document.documentElement)
  const v = (n) => s.getPropertyValue(n).trim()
  return {
    blue: v('--blue') || '#2563eb',
    blueEdge: v('--blue-edge') || '#c6dafb',
    line: v('--line') || '#dce4ef',
    muted: v('--muted') || '#5a7088',
    surface: v('--surface') || '#ffffff',
  }
}

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const axisTick = (muted) => ({ fill: muted, fontSize: 12 })
const gbpAxis = (n) => (n >= 1000 ? `£${Math.round(n / 100) / 10}k` : `£${Math.round(n)}`)

function TimeTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="chart-tip">
      <div className="tip-k">{fullDate(p.date)}</div>
      <div className="tip-v">{gbp(p.total)}</div>
    </div>
  )
}

function WeekTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="chart-tip">
      <div className="tip-k">
        {shortDate(p.start)} – {shortDate(p.end)}
      </div>
      <div className="tip-v">{gbp(p.total)}</div>
    </div>
  )
}

// Spending over time — daily £ across the period. Area = magnitude over time.
export function SpendOverTimeChart({ data }) {
  const c = palette()
  return (
    <div className="chart-frame" style={{ height: 232 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 14, bottom: 2, left: -6 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.blue} stopOpacity={0.22} />
              <stop offset="100%" stopColor={c.blue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.line} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => shortDate(d)}
            tickLine={false}
            axisLine={{ stroke: c.line }}
            tick={axisTick(c.muted)}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={gbpAxis}
            tickLine={false}
            axisLine={false}
            tick={axisTick(c.muted)}
            width={46}
            allowDecimals={false}
          />
          <Tooltip content={<TimeTip />} cursor={{ stroke: c.blueEdge, strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="total"
            stroke={c.blue}
            strokeWidth={2}
            fill="url(#spendFill)"
            dot={false}
            activeDot={{ r: 4, fill: c.blue, stroke: c.surface, strokeWidth: 2 }}
            isAnimationActive={!reduceMotion}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Weekly trend — trailing weeks; the current (last) week is the emphasised bar.
export function WeeklyTrendChart({ data }) {
  const c = palette()
  return (
    <div className="chart-frame" style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 2, left: -6 }}>
          <CartesianGrid stroke={c.line} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: c.line }}
            tick={axisTick(c.muted)}
          />
          <YAxis
            tickFormatter={gbpAxis}
            tickLine={false}
            axisLine={false}
            tick={axisTick(c.muted)}
            width={46}
            allowDecimals={false}
          />
          <Tooltip content={<WeekTip />} cursor={{ fill: c.blueEdge, fillOpacity: 0.3 }} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={!reduceMotion}>
            {data.map((d, i) => (
              <Cell key={i} fill={i === data.length - 1 ? c.blue : c.blueEdge} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
