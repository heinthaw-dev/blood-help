/** The 8 ABO/Rh blood types. */
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const

export type BloodType = (typeof BLOOD_TYPES)[number]
