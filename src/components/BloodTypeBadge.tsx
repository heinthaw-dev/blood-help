import type { ReactNode } from 'react'
import { Badge } from './Badge'

interface BloodTypeBadgeProps {
  children: ReactNode
  /** `sm` (default) = inline pill; `lg` = hero rounded-rect chip. */
  size?: 'sm' | 'lg'
}

/**
 * BloodTypeBadge — semantic wrapper around {@link Badge} for blood-type chips.
 *
 * Gives the blood-group display (`O+`, `B-`, …) a domain name so callers
 * express *what* they're showing, not just *how*. Delegates all rendering to
 * `<Badge variant="primary" size={size}>`.
 *
 * - `size="sm"` (default) — inline pill, used in feed cards and list rows.
 * - `size="lg"` — hero rounded-rect chip, used at the top of request screens.
 */
export function BloodTypeBadge({ children, size = 'sm' }: BloodTypeBadgeProps) {
  return <Badge variant="primary" size={size}>{children}</Badge>
}

export default BloodTypeBadge
