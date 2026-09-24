/**
 * Minimum age to register as a blood donor — the Myanmar donation minimum.
 * Mirrors the `profiles_date_of_birth_age_check` constraint in the database, so
 * the form never offers to save something the DB will reject.
 */
export const MIN_DONOR_AGE = 18

/**
 * Whole years between an ISO `YYYY-MM-DD` birth date and today.
 *
 * Parses the parts by hand rather than via `new Date(iso)`: that constructor reads
 * a bare date string as UTC midnight, which lands on the previous day for anyone
 * west of UTC and would shift the age by one on birthdays.
 *
 * Returns `NaN` for an unparseable string so callers can treat it as "not a date"
 * rather than as age 0.
 */
export function calculateAge(isoBirthDate: string, today: Date = new Date()): number {
  const [y, m, d] = isoBirthDate.split('-').map(Number)
  if (!y || !m || !d) return NaN

  let age = today.getFullYear() - y
  const monthsFromBirthday = today.getMonth() + 1 - m
  // Birthday has not come round yet this year.
  if (monthsFromBirthday < 0 || (monthsFromBirthday === 0 && today.getDate() < d)) {
    age -= 1
  }
  return age
}
