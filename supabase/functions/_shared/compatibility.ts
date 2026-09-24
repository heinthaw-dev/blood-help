/**
 * Directional blood compatibility, shared by every function that decides who to alert.
 *
 * This table used to live inline in notify-donors. A second copy in the ring-alert
 * worker would be two matrices that can drift, and a drifted matrix in this app
 * means alerting a donor whose blood cannot be given to the patient. One copy.
 */

/** Which donor blood types can donate TO a given requester blood type. */
export const COMPATIBLE_DONOR_TYPES: Record<string, string[]> = {
  'O-':  ['O-'],
  'O+':  ['O-', 'O+'],
  'A-':  ['O-', 'A-'],
  'A+':  ['O-', 'O+', 'A-', 'A+'],
  'B-':  ['O-', 'B-'],
  'B+':  ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
}
