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

/**
 * E.164 (+959XXXXXXXXX) → display "+959-XXX-XXX-XXX", keeping the international
 * +95 prefix (unlike formatPhone, which renders the local 09- form). Used where a
 * donor's contact number is shown in full international form.
 */
export function formatPhoneIntl(e164: string): string {
  const m = e164.match(/^\+95(9\d{9,10})$/)
  if (!m) return e164
  const nat = m[1]                                   // '9' + 9 or 10 digits
  if (nat.length === 10) {
    // +959-XXX-XXX-XXX  (1 / 3 / 3 / 3)
    return nat.replace(/^(9)(\d{3})(\d{3})(\d{3})$/, '+95$1-$2-$3-$4')
  }
  // 11 chars → +959-XXXX-XXX-XXX  (1 / 4 / 3 / 3), mirrors formatPhone's long grouping
  return nat.replace(/^(9)(\d{4})(\d{3})(\d{3})$/, '+95$1-$2-$3-$4')
}

/** Format distance from meters to a human-readable label with Burmese numerals. */
export function formatDistanceLabel(distMeters: number, lang: Lang): string {
  const km = distMeters / 1000
  const n = km < 1 ? Math.round(distMeters) : Math.round(km * 10) / 10
  const unit = km < 1 ? (lang === 'my' ? 'မီတာ' : 'm') : 'km'
  return `~${formatNumber(n, lang)} ${unit}`
}
