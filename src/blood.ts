/** The 8 ABO/Rh blood types. */
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const

export type BloodType = (typeof BLOOD_TYPES)[number]

/**
 * Directional blood-type compatibility map (blood-help-spec.md §3.1).
 * Key: donor's blood type. Value: request blood types the donor can donate into.
 * Usage: COMPATIBLE_REQUEST_TYPES[donorBloodType].includes(requestBloodType)
 */
export const COMPATIBLE_REQUEST_TYPES: Record<BloodType, BloodType[]> = {
  'O-':  ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+':  ['O+', 'A+', 'B+', 'AB+'],
  'A-':  ['A-', 'A+', 'AB-', 'AB+'],
  'A+':  ['A+', 'AB+'],
  'B-':  ['B-', 'B+', 'AB-', 'AB+'],
  'B+':  ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
}
