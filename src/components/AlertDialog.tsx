import type { ReactNode } from 'react'
import { Button } from './Button'

interface AlertDialogProps {
  open: boolean
  bodyFont?: string
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Centered modal dialog over a scrim. Used to warn the user before a native
 * browser prompt (e.g. location permission) so they know what's about to
 * appear and which button to press.
 */
export function AlertDialog({
  open,
  bodyFont = 'var(--font-sans)',
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: AlertDialogProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(26, 26, 26, 0.45)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 320,
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-sheet)',
          padding: 24,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: bodyFont,
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1.4,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: '12px 0 0',
            fontFamily: bodyFont,
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          {message}
        </p>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button fullWidth height={50} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          {cancelLabel && (
            <Button tone="secondary" fullWidth height={50} onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AlertDialog
