/**
 * Dummy auth helpers. Tracks which phone numbers have completed login before,
 * so the Intent Choice screen only appears on a user's first login.
 *
 * This is local-only placeholder state for the prototype; a later phase replaces
 * it with the real Supabase profile (whether a profile row already exists).
 */

const SEEN_KEY = 'bloodhelp.seenPhones'

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

/** True if this phone number has logged in before (returning user). */
export function hasLoggedInBefore(phone: string): boolean {
  return readSeen().includes(phone)
}

/** Record that this phone number has now completed login at least once. */
export function markLoggedIn(phone: string): void {
  try {
    const seen = readSeen()
    if (!seen.includes(phone)) {
      seen.push(phone)
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
    }
  } catch {
    // localStorage unavailable (private mode etc.) — first-time gate just
    // defaults to showing Intent Choice, which is the safe fallback.
  }
}
