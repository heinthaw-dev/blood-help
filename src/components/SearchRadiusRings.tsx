import type { CSSProperties } from 'react'
import type { Lang } from '../i18n'
import { formatNumber } from '../i18n'

/** Radius steps a request passes through, in km. Mirrors the DB constraint on
 *  blood_requests.search_radius_km (starts at 10, +5 per widening, capped at 30).
 *  Kept module-local: exporting a non-component from this file breaks fast refresh. */
const RADIUS_STEPS = [10, 15, 20, 25, 30] as const

/** Smallest and largest ring radii in SVG user units. The viewBox is 120×120 with the
 *  request at its centre, so 56 leaves room for the outer ring's stroke.
 *  R_INNER is pulled well inside the first ring rather than sitting just outside the
 *  dot: it widens the gap between every pair of rings, and it gives the reach ping a
 *  visible distance to travel before it meets the innermost ring. */
const R_INNER = 14
const R_OUTER = 56
const CENTER = 60
/** The request itself. Small on purpose — it marks a point, it is not a third ring. */
const R_DOT = 4
/** Rendered size in CSS pixels. The viewBox stays 120 so every radius above is
 *  resolution-independent; only this number changes to resize the graphic. */
const RENDER_PX = 100

/** SVG radius for the ring at RADIUS_STEPS[i] — evenly spaced, not to scale.
 *  Real-distance scaling would crowd the inner rings together and read as noise;
 *  the number beside the graphic carries the actual distance. */
function ringRadius(i: number): number {
  const step = (R_OUTER - R_INNER) / (RADIUS_STEPS.length - 1)
  return R_INNER + i * step
}

/** The three states the headline describes, in the order a request moves through them. */
type ReachStatus = 'initial' | 'widened' | 'capped'

/** Localized headline per reach status, keyed the same way as the app's other
 *  Record<Lang, ...> copy tables. Module-level so the lookup isn't rebuilt every render. */
const REACH_HEADLINES: Record<ReachStatus, Record<Lang, (radiusDisplay: string) => string>> = {
  initial: {
    my: (km) => `${km} km အတွင်း ရှာနေပါသည်`,
    en: (km) => `Searching within ${km} km`,
  },
  widened: {
    my: (km) => `${km} km အထိ တိုးရှာနေပါသည်`,
    en: (km) => `Widened the search to ${km} km`,
  },
  capped: {
    my: (km) => `အများဆုံး ${km} km အထိ ရှာပြီးပါပြီ`,
    en: (km) => `Searched the full ${km} km`,
  },
}

/** Whether the current reach has turned anybody up. */
type DonorPresence = 'some' | 'none'

/** Localized subline per presence, keyed like REACH_HEADLINES above.
 *  An empty reach gets direction, not a dead end: "ရှာမတွေ့သေးပါ" carries "not yet",
 *  which is the truth — the radius is still widening. The line it replaces,
 *  "reaching 0 donors", read as a final answer. */
const REACH_SUBLINES: Record<
  DonorPresence,
  Record<Lang, (radiusDisplay: string, countDisplay: string) => string>
> = {
  some: {
    my: (_km, count) => `သွေးလှူနိုင်သူ ${count} ဦးထံ ရောက်ရှိပြီး`,
    en: (_km, count) => `Reaching ${count} compatible donors`,
  },
  none: {
    my: (km) => `${km} km အတွင်း သွေးလှူနိုင်သူ ရှာမတွေ့သေးပါ`,
    en: (km) => `No compatible donors found within ${km} km yet`,
  },
}

/** Radius of a donor dot, in SVG user units. Deliberately smaller than R_DOT: the
 *  centre is the request, the small marks are people who can answer it. */
const R_DONOR_DOT = 2.5

/** A compatible donor the current reach covers.
 *
 *  Distance and an opaque id, never coordinates. The rings plot how FAR somebody is,
 *  never which way — see the angle note on angleForDonor. */
export interface ReachedDonor {
  /** donors.id — used only to pick a stable angle, never displayed. */
  id: string
  distanceKm: number
}

/**
 * A stable angle in [0, 2π) for a donor dot.
 *
 * Stable, because Math.random() would re-roll on every render and the dots would
 * twitch around the graphic once a second. Hashing the id pins each donor to one
 * spot for as long as the screen is open.
 *
 * Pseudo-random, because the angle must carry no information. A donor's real bearing
 * is never sent to this component and must never be inferable from it: the dot says
 * "somebody is about this far away", and the direction is meaningless by construction.
 *
 * FNV-1a — small, dependency-free, and well spread for short string keys like a UUID.
 */
function angleForDonor(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) / 4294967296) * Math.PI * 2
}

/** The ring a donor sits on: the first radius step that reaches them. A donor at 13 km
 *  is drawn on the 15 km ring, which is the band the widening job would have alerted
 *  them in. Snapping to the band rather than interpolating the true distance is also
 *  the more private of the two — the graphic states a band, not a measurement. */
function bandIndexFor(distanceKm: number): number {
  const i = RADIUS_STEPS.findIndex((km) => km >= distanceKm)
  return i === -1 ? RADIUS_STEPS.length - 1 : i
}

export interface SearchRadiusRingsProps {
  lang: Lang
  /** Current reach of the request in km, from blood_requests.search_radius_km. */
  radiusKm: number
  /** Compatible donors the current radius covers — the same set the D-09 count reports.
   *  One dot is drawn per entry; the count in the subline is this array's length, so the
   *  picture and the sentence cannot disagree. */
  donors: ReachedDonor[]
  /** Whether the request is still looking. False once somebody has answered: a wave
   *  still going out while a donor is on their way says the wrong thing. Defaults to
   *  true so a caller that does not track responders still animates. */
  searching?: boolean
}

/**
 * SearchRadiusRings — the requester's picture of how far their request has travelled.
 *
 * Every ring is a real radius step, so the graphic states the request's reach rather
 * than implying activity. It is deliberately NOT a radar sweep: a sweep has a bearing,
 * which would suggest the app is scanning people's positions — it never shows donor
 * locations, and it must not imply that it does.
 *
 * Two kinds of motion, for two different facts:
 *
 *   The ping (continuous) says the request is still travelling outward. It expands
 *   from the dot to the ring for the CURRENT reach, so the distance it covers is
 *   search_radius_km itself — at 10 km the wave dies close in, at 30 km it crosses the
 *   whole graphic. It keeps going at the cap, because the request is still live and
 *   donors can still answer; a still graphic on an open request reads as "gave up".
 *   It stops when somebody has answered, and under prefers-reduced-motion.
 *
 *   The grow (once per widening) says the reach just got bigger. The caller keys the
 *   newest ring on radiusKm, so React remounts it and bh-ring-grow replays exactly
 *   once.
 *
 * An earlier cut had no continuous motion at all, on the grounds that infinite
 * animation is not emergency-calm. That held while the radius was a constant and
 * the graphic genuinely had nothing to report between widenings. Now that the radius
 * really moves, three silent minutes between steps read as frozen rather than calm,
 * so the ping carries "still searching" and the slow 3s cadence carries the calm.
 *
 * Privacy: rings and a centre dot only. No donor markers, no coordinates, nothing
 * derived from a donor's position.
 */
export function SearchRadiusRings({ lang, radiusKm, donors, searching = true }: SearchRadiusRingsProps) {
  const activeIndex = RADIUS_STEPS.findIndex((km) => km >= radiusKm)
  // A radius past the last step (shouldn't happen — the DB caps at 30) still fills every ring.
  const reachedIndex = activeIndex === -1 ? RADIUS_STEPS.length - 1 : activeIndex
  const atCap = radiusKm >= RADIUS_STEPS[RADIUS_STEPS.length - 1]
  const widened = radiusKm > RADIUS_STEPS[0]
  const reachStatus: ReachStatus = atCap ? 'capped' : widened ? 'widened' : 'initial'

  const radiusDisplay = formatNumber(radiusKm, lang)
  const countDisplay = formatNumber(donors.length, lang)

  const headline = REACH_HEADLINES[reachStatus][lang](radiusDisplay)

  const subline = REACH_SUBLINES[donors.length > 0 ? 'some' : 'none'][lang](
    radiusDisplay,
    countDisplay,
  )

  const labelStyle: CSSProperties = {
    fontFamily: 'var(--font-burmese)',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.45,
    color: 'var(--text-primary)',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg
        width={RENDER_PX}
        height={RENDER_PX}
        viewBox="0 0 120 120"
        role="img"
        aria-label={`${headline}. ${subline}.`}
        style={{ display: 'block', flexShrink: 0 }}
      >
        {/* Wash over the area the request currently covers — reached reach, not donors. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={ringRadius(reachedIndex)}
          fill="rgba(209, 62, 47, 0.05)"
        />

        {/* Reach ping — see the note above the component. Each wave is a circle the
            size of the current reach, scaled up from the dot and faded out by CSS, so
            the animation's travel distance is the request's actual reach.
            Keyed on radiusKm: a widening changes r, and remounting restarts the wave
            cleanly instead of letting an in-flight one jump to the new size.
            vector-effect keeps the stroke one width throughout — a wave that thickened
            as it faded would be telling two stories at once. */}
        {searching &&
          [0, 1].map((i) => (
            <circle
              key={`ping-${i}-${radiusKm}`}
              className={
                i === 0 ? 'bh-reach-ping' : 'bh-reach-ping bh-reach-ping--trailing'
              }
              cx={CENTER}
              cy={CENTER}
              r={ringRadius(reachedIndex)}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        {RADIUS_STEPS.map((_step, i) => {
          const reached = i <= reachedIndex
          const isNewest = i === reachedIndex
          return (
            <circle
              /* Keying the newest ring on radiusKm remounts it when the reach grows,
                 which is what makes the grow keyframe fire once per widening. */
              key={isNewest ? `ring-${i}-${radiusKm}` : `ring-${i}`}
              className={isNewest && widened ? 'bh-ring-grow' : undefined}
              cx={CENTER}
              cy={CENTER}
              r={ringRadius(i)}
              fill="none"
              stroke={reached ? 'rgba(209, 62, 47, 0.32)' : 'var(--border-card)'}
              strokeWidth={isNewest ? 2 : 1}
            />
          )
        })}
        {/* One dot per compatible donor the reach has found, sitting on the ring for
            the band they fall in. The angle is a hash of the donor's id: stable so the
            dot stays put across renders, and meaningless so the picture never implies
            a direction. Drawn after the rings so a dot is never hidden under one, and
            keyed on the id so bh-ring-grow plays once, as the donor is found. */}
        {donors.map((d) => {
          const a = angleForDonor(d.id)
          const r = ringRadius(bandIndexFor(d.distanceKm))
          return (
            <circle
              key={`donor-${d.id}`}
              className="bh-ring-grow"
              cx={CENTER + r * Math.cos(a)}
              cy={CENTER + r * Math.sin(a)}
              r={R_DONOR_DOT}
              fill="var(--color-primary)"
            />
          )
        })}

        {/* The request itself. Static — the ping and the rings carry the motion, not this. */}
        <circle cx={CENTER} cy={CENTER} r={R_DOT} fill="var(--color-primary)" />
      </svg>

      <div style={{ minWidth: 0 }}>
        <div style={labelStyle}>{headline}</div>
        <div
          style={{
            fontFamily: 'var(--font-burmese)',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            marginTop: 2,
          }}
        >
          {subline}
        </div>
      </div>
    </div>
  )
}

export default SearchRadiusRings
