const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isValidBloodType(value: unknown): boolean {
  return typeof value === 'string' && /^(O|A|B|AB)[+-]$/.test(value)
}

export function isValidUrgency(value: unknown): boolean {
  return value === 'urgent' || value === 'today'
}

export function sanitizeLength(value: unknown, max: number): string {
  return String(value ?? '').slice(0, max)
}
