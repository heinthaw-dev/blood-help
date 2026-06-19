import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Switch } from '../components/Switch'
import { Badge } from '../components/Badge'
import { BottomNav } from '../components/BottomNav'
import type { Tab } from '../components/BottomNav'
import type { BloodType } from '../blood'
import type { Lang } from '../i18n'
import { formatNumber } from '../i18n'

interface ProfileProps {
  lang: Lang
  /** App-wide language switch — this screen is where the global setting lives. */
  onLangChange: (lang: Lang) => void
  name: string
  bloodType: BloodType
  donationCount: number
  /** Display string for the last donation date, or null if never donated. */
  lastDonation: string | null
  available: boolean
  onAvailableChange: (v: boolean) => void
  showNumber: boolean
  onShowNumberChange: (v: boolean) => void
  onEditProfile: () => void
  onLogout: () => void
  onNavigate: (tab: Tab) => void
}

export function Profile({
  lang,
  onLangChange,
  name,
  bloodType,
  donationCount,
  lastDonation,
  available,
  onAvailableChange,
  showNumber,
  onShowNumberChange,
  onEditProfile,
  onLogout,
  onNavigate,
}: ProfileProps) {
  const [logoutHover, setLogoutHover] = useState(false)

  const isMy = lang === 'my'
  const langFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'
  const count = formatNumber(donationCount, lang)

  const t = {
    my: {
      donatedLabel: `လှူဒါန်းမှု ${count} ကြိမ်`,
      lastLabel: 'နောက်ဆုံး လှူဒါန်းသည့်ရက်',
      settingsHeader: 'ဆက်တင်များ',
      availLabel: 'သွေးလှူရန် အသင့်ရှိသည်',
      showNumLabel: 'ကျွန်ုပ်၏ နံပါတ်ကို တောင်းခံသူများအား ပြသမည်',
      languageLabel: 'ဘာသာစကား',
      editLabel: 'ပရိုဖိုင် ပြင်ဆင်ရန်',
      editSub: 'အမည်၊ မြို့နယ်၊ သွေးအုပ်စုနှင့် ဖုန်းနံပါတ်',
      logoutLabel: 'ထွက်ရန်',
      none: 'မရှိသေးပါ',
    },
    en: {
      donatedLabel: `Donated ${count} times`,
      lastLabel: 'Last donation',
      settingsHeader: 'Settings',
      availLabel: 'Available to donate',
      showNumLabel: 'Show my number to requesters',
      languageLabel: 'Language',
      editLabel: 'Edit profile',
      editSub: 'Name, township, blood type and phone',
      logoutLabel: 'Log out',
      none: 'None yet',
    },
  }[lang]

  const initial = (name.trim()[0] || '?').toUpperCase()

  const tabBase: CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1,
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    padding: '7px 13px',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
  }
  const activeTab: CSSProperties = { ...tabBase, background: 'var(--color-primary)', color: '#fff' }
  const idleTab: CSSProperties = { ...tabBase, background: 'transparent', color: 'var(--text-secondary)' }

  const rowLabel: CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontFamily: langFont,
    fontSize: 16,
    lineHeight: 1.4,
    color: 'var(--text-primary)',
  }
  const settingRow = (children: ReactNode): ReactNode => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>{children}</div>
  )
  const divider = <div style={{ height: 1, background: 'var(--border-card)', margin: '0 16px' }} />

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card" style={{ height: '100dvh' }}>
        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            padding: '30px 20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* App title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="22" height="26" viewBox="0 0 24 28" fill="none" style={{ display: 'block' }}>
              <path d="M12 1.5s9 9 9 15.5a9 9 0 0 1-18 0C3 10.5 12 1.5 12 1.5z" fill="var(--color-primary)" />
            </svg>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Blood Help
            </span>
          </div>

          {/* Header: avatar + name + blood badge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 999,
                background: 'var(--color-primary-tint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-burmese)',
                fontSize: 34,
                fontWeight: 600,
                color: 'var(--color-primary)',
              }}
            >
              {initial}
            </div>
            <div
              style={{
                marginTop: 14,
                fontFamily: langFont,
                fontSize: 22,
                fontWeight: 600,
                lineHeight: 1.3,
                color: 'var(--text-primary)',
              }}
            >
              {name}
            </div>
            <div style={{ marginTop: 10 }}>
              <Badge>{bloodType}</Badge>
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
            }}
          >
            <div style={{ flex: 1, padding: 16, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 24, fontWeight: 600, lineHeight: 1.2, color: 'var(--color-primary)' }}>
                {count}
              </div>
              <div style={{ marginTop: 4, fontFamily: langFont, fontSize: 13, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                {t.donatedLabel}
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--border-card)' }} />
            <div style={{ flex: 1, padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 16, fontWeight: 600, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                {lastDonation ?? t.none}
              </div>
              <div style={{ marginTop: 4, fontFamily: langFont, fontSize: 13, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                {t.lastLabel}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                fontFamily: langFont,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '.02em',
                color: 'var(--text-hint)',
                padding: '0 4px',
                textTransform: 'uppercase',
              }}
            >
              {t.settingsHeader}
            </div>
            <div
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-card)',
                overflow: 'hidden',
              }}
            >
              {settingRow(
                <>
                  <span style={rowLabel}>{t.availLabel}</span>
                  <Switch checked={available} onChange={onAvailableChange} ariaLabel={t.availLabel} />
                </>,
              )}
              {divider}
              {settingRow(
                <>
                  <span style={rowLabel}>{t.showNumLabel}</span>
                  <Switch checked={showNumber} onChange={onShowNumberChange} ariaLabel={t.showNumLabel} />
                </>,
              )}
              {divider}
              {settingRow(
                <>
                  <span style={rowLabel}>{t.languageLabel}</span>
                  <div
                    style={{
                      display: 'inline-flex',
                      flex: 'none',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--border-card)',
                      borderRadius: 'var(--radius-pill)',
                      padding: 3,
                      gap: 2,
                    }}
                  >
                    <button type="button" onClick={() => onLangChange('my')} style={isMy ? activeTab : idleTab}>
                      မြန်မာ
                    </button>
                    <button type="button" onClick={() => onLangChange('en')} style={isMy ? idleTab : activeTab}>
                      ENG
                    </button>
                  </div>
                </>,
              )}
              {divider}
              <button
                type="button"
                onClick={onEditProfile}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: 16,
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: langFont, fontSize: 16, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                    {t.editLabel}
                  </div>
                  <div style={{ fontFamily: langFont, fontSize: 13, lineHeight: 1.4, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {t.editSub}
                  </div>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-hint)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block', flexShrink: 0 }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Log out */}
          <button
            type="button"
            onClick={onLogout}
            onMouseEnter={() => setLogoutHover(true)}
            onMouseLeave={() => setLogoutHover(false)}
            style={{
              width: '100%',
              height: 54,
              background: logoutHover ? 'var(--color-primary-wash)' : 'var(--surface-card)',
              border: '1px solid var(--border-field)',
              borderRadius: 'var(--radius-button)',
              fontFamily: langFont,
              fontSize: 16,
              fontWeight: 600,
              color: logoutHover ? 'var(--color-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {t.logoutLabel}
          </button>
        </div>

        {/* Bottom nav */}
        <BottomNav active="profile" lang={lang} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export default Profile
