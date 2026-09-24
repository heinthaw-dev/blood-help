import type { CSSProperties } from 'react'
import type { Lang } from '../i18n'
import { formatNumber } from '../i18n'

/** Radius steps a request passes through, in km. Mirrors the DB constraint on
 *  blood_requests.search_radius_km (starts at 10, +5 per widening, capped at 30).
 *  Kept module-local: exporting a non-component from this file breaks fast refresh. */
const RADIUS_STEPS = [10, 15, 20, 25, 30] as const

/** Smallest and largest ring radii in SVG user units. The viewBox is 120×120 with the
 *  request at its centre, so 58 leaves a 2-unit margin for the outer ring's stroke. */
const R_INNER = 18
const R_OUTER = 58
const CENTER = 60

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

export interface SearchRadiusRingsProps {
  lang: Lang
  /** Current reach of the request in km, from blood_requests.search_radius_km. */
  radiusKm: number
  /** Compatible donors the current radius covers — the same truthful count as the D-09 line. */
  donorCount: number
}

/**
 * SearchRadiusRings — the requester's picture of how far their request has travelled.
 *
 * Every ring is a real radius step, so the graphic states the request's reach rather
 * than implying activity. It is deliberately NOT a radar sweep: a sweep would suggest
 * the app is scanning people's positions (it never shows donor locations) and would
 * animate forever on a screen that stays open for half an hour, which the design
 * system's emergency-calm rule rules out.
 *
 * Motion happens once per real widening. The caller keys the newest ring on radiusKm,
 * so React remounts it and the bh-ring-grow keyframe replays exactly once — no
 * interval, no infinite animation, nothing running while the reach is unchanged.
 *
 * Privacy: rings and a centre dot only. No donor markers, no coordinates, nothing
 * derived from a donor's position.
 */
export function SearchRadiusRings({ lang, radiusKm, donorCount }: SearchRadiusRingsProps) {
  const activeIndex = RADIUS_STEPS.findIndex((km) => km >= radiusKm)
  // A radius past the last step (shouldn't happen — the DB caps at 30) still fills every ring.
  const reachedIndex = activeIndex === -1 ? RADIUS_STEPS.length - 1 : activeIndex
  const atCap = radiusKm >= RADIUS_STEPS[RADIUS_STEPS.length - 1]
  const widened = radiusKm > RADIUS_STEPS[0]
  const reachStatus: ReachStatus = atCap ? 'capped' : widened ? 'widened' : 'initial'

  const radiusDisplay = formatNumber(radiusKm, lang)
  const countDisplay = formatNumber(donorCount, lang)

  const headline = REACH_HEADLINES[reachStatus][lang](radiusDisplay)

  const subline =
    lang === 'my'
      ? `သွေးလှူနိုင်သူ ${countDisplay} ဦးထံ ရောက်ရှိပြီး`
      : `Reaching ${countDisplay} compatible donors`

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
        width="72"
        height="72"
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
        {/* The request itself. Static — the rings carry the change, not this. */}
        <circle cx={CENTER} cy={CENTER} r={5} fill="var(--color-primary)" />
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
