import type { Lang } from './i18n'
import { formatNumber } from './i18n'

// ---- shared display formatters ----
//
// Extracted from Home.tsx so both Home and RequestLive can share one
// implementation without forking divergent copies, and without tripping
// react-refresh/only-export-components (a component file must export only
// components for Fast Refresh to work).

/** E.164 (+95 9 XXXXXXXXX) → local display "09-XXX-XXX-XXX" */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+95(9\d{9,10})$/)
  if (!m) return e164
  const local = '0' + m[1]                           // 11 or 12 chars
  if (local.length === 11) {
    return local.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1-$2-$3-$4')
  }
  // 12 chars: 09-XXXX-XXX-XXX  (2+4+3+3) (WR-02)
  return local.replace(/^(\d{2})(\d{4})(\d{3})(\d{3})$/, '$1-$2-$3-$4')
}

/** Format distance from meters to a human-readable label with Burmese numerals. */
export function formatDistanceLabel(distMeters: number, lang: Lang): string {
  const km = distMeters / 1000
  const n = km < 1 ? Math.round(distMeters) : Math.round(km * 10) / 10
  const unit = km < 1 ? (lang === 'my' ? 'မီတာ' : 'm') : 'km'
  return `~${formatNumber(n, lang)} ${unit}`
}
