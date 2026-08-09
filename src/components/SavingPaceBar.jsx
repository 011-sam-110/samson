// The saving-pace bar.
//
// Deliberately not a gauge: the spending gauge is the one hero instrument on Overview,
// and giving saving an identical dial would make two things compete for the same job.
// A bar reads as progress toward a rate, which is what a saving pace is.
//
// 1.00 — exactly on track — is marked, because that is the number the ratio is
// measured against. Past it the bar keeps filling but the marker stays put, so
// "ahead of pace" is visible without the scale running away.

const FULL_AT = 1.5 // ratio that fills the bar; above this it simply stays full

const BAND_CLASS = {
  ahead: 'is-good',
  'on-pace': 'is-good',
  'slightly-behind': 'is-warn',
  behind: 'is-bad',
  done: 'is-good',
  missed: 'is-bad',
  unknown: 'is-unknown',
}

export default function SavingPaceBar({ pace }) {
  const known = pace.dataQuality === 'ok' && pace.ratio != null
  const fill = known ? Math.min(pace.ratio / FULL_AT, 1) : 0
  const onTrackAt = 1 / FULL_AT

  return (
    <div
      className={`spb ${BAND_CLASS[pace.band] || 'is-unknown'}`}
      role="img"
      aria-label={
        known
          ? `Saving pace: ${pace.ratio.toFixed(2)} times what this goal needs`
          : 'No transfers logged yet, so there is no saving pace to show'
      }
    >
      <div className="spb-track">
        <span className="spb-fill" style={{ width: `${fill * 100}%` }} />
        <span className="spb-mark" style={{ left: `${onTrackAt * 100}%` }} />
      </div>
      <div className="spb-scale">
        <span>0</span>
        <span className="spb-scale-mark" style={{ left: `${onTrackAt * 100}%` }}>
          on track
        </span>
      </div>
    </div>
  )
}
