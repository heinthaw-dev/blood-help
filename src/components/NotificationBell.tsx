interface NotificationBellProps {
  onClick: () => void
}

/**
 * Notification bell — the shared header affordance for the three tab screens
 * (Home, Leaderboard, Profile). A tappable button wrapping the bell icon; pass
 * it into ScreenHeader's `right` slot. Visually identical to the static bell
 * that was previously inlined in Home's header.
 */
export function NotificationBell({ onClick }: NotificationBellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Notifications"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'var(--text-secondary)',
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'block', flexShrink: 0 }}
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.5 21a1.7 1.7 0 0 1-3 0" />
      </svg>
    </button>
  )
}

export default NotificationBell
