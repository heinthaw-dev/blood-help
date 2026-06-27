import type { CSSProperties, ReactNode } from 'react'

type Variant = 'brand' | 'nav'
type Align = 'left' | 'center'

interface ScreenHeaderProps {
  /** `brand` = Blood Help wordmark. `nav` = back button + centered title. */
  variant: Variant
  /** Nav title (single owned size 18/600). Ignored for `brand`. */
  title?: string
  /** Wordmark alignment for `brand` (default left). */
  align?: Align
  /** Renders the standard 40px back button when provided. Works on both `brand` and `nav` variants. */
  onBack?: () => void
  /** Right-slot content — e.g. <LanguageToggle/>, the Home bell, or nothing. */
  right?: ReactNode
  /**
   * Draw a 1px bottom border. Used by the form screens (CreateRequest,
   * DonorProfileSetup) whose fixed header sits above a scrolling body.
   */
  divider?: boolean
}

/** Single owned header padding for every screen. */
const HEADER_PADDING = '24px 20px 16px'

/** Blood Help blood-drop + wordmark — identical across all brand screens. */
function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="22" height="26" viewBox="0 0 24 28" fill="none" style={{ display: 'block' }}>
        <path d="M12 1.5s9 9 9 15.5a9 9 0 0 1-18 0C3 10.5 12 1.5 12 1.5z" fill="var(--color-primary)" />
      </svg>
      <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        Blood Help
      </span>
    </div>
  )
}

/** The single standardized 40px back button (arrow icon). */
function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back"
      style={{
        flexShrink: 0,
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        color: 'var(--text-primary)',
        padding: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
        <line x1="19" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <polyline
          points="12 19 5 12 12 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </button>
  )
}

/** A 40px spacer that balances the back button so the nav title stays centered. */
function Spacer() {
  return <span style={{ flexShrink: 0, width: 40, height: 40 }} aria-hidden="true" />
}

/**
 * ScreenHeader — the one top-bar component every screen routes through. Replaces
 * the ~6 hand-written header systems with a single owned padding, nav-title size,
 * and back button. See ui-consistency-report.md §1.
 */
export function ScreenHeader({ variant, title, align = 'left', onBack, right, divider = false }: ScreenHeaderProps) {
  const base: CSSProperties = {
    flex: 'none',
    padding: HEADER_PADDING,
    ...(divider ? { borderBottom: '1px solid var(--border-card)' } : null),
  }

  if (variant === 'brand') {
    return (
      <div
        style={{
          ...base,
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : 'space-between',
          gap: 8,
        }}
      >
        {onBack && <BackButton onBack={onBack} />}
        <Wordmark />
        {right ?? null}
      </div>
    )
  }

  return (
    <div style={{ ...base, display: 'flex', alignItems: 'center', gap: 8 }}>
      {onBack ? <BackButton onBack={onBack} /> : <Spacer />}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'center',
          fontFamily: 'var(--font-sans)',
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1.3,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </div>
      {right ?? <Spacer />}
    </div>
  )
}

export default ScreenHeader
