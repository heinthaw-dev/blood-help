/** Supported UI languages. Burmese (`my`) is the default. */
export type Lang = 'my' | 'en'

const BURMESE_DIGITS = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉']

/** Render a number in the given language's digits (Burmese numerals for `my`). */
export function formatNumber(n: number, lang: Lang): string {
  const s = String(n)
  if (lang !== 'my') return s
  return s.replace(/\d/g, (d) => BURMESE_DIGITS[Number(d)])
}
