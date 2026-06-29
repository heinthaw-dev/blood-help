import { ScreenHeader } from '../components/ScreenHeader'
import type { Lang } from '../i18n'

const STRINGS: Record<Lang, { title: string; empty: string }> = {
  my: {
    title: 'သတိပေးချက်များ',
    empty: 'လောလောဆယ် သတိပေးချက် မရှိသေးပါ။',
  },
  en: {
    title: 'Notifications',
    empty: 'There are no notifications for now.',
  },
}

interface NotificationsProps {
  lang: Lang
  /** Return to the tab the user opened notifications from. */
  onBack: () => void
}

/**
 * Notifications screen — opened from the shared header bell. Currently a calm
 * empty state; the list itself lands in a later phase. Uses the standard
 * ScreenHeader (nav) so the back button returns to the originating tab.
 */
export function Notifications({ lang, onBack }: NotificationsProps) {
  const isMy = lang === 'my'
  const bodyFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'
  const copy = STRINGS[lang]

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card">
        <ScreenHeader variant="nav" onBack={onBack} title={copy.title} />

        {/* Empty state */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 12px',
          }}
        >
          <p
            style={{
              margin: 0,
              maxWidth: 280,
              textAlign: 'center',
              fontFamily: bodyFont,
              fontSize: 16,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            {copy.empty}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Notifications
