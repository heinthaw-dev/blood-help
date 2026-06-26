import { useState } from 'react'
import QRCode from 'react-qr-code'
import { Switch } from '../components/Switch'
import { Badge } from '../components/Badge'
import { BottomNav } from '../components/BottomNav'
import { ScreenHeader } from '../components/ScreenHeader'
import { LanguageToggle } from '../components/LanguageToggle'
import type { Tab } from '../components/BottomNav'
import type { BloodType } from '../blood'
import type { Lang } from '../i18n'
import { formatNumber } from '../i18n'

// ---- QR code ----

/** Real scannable QR code encoding the donor's 5-char donor_code. */
function DonorQR({ code }: { code: string }) {
  return (
    <QRCode
      value={code.toUpperCase()}
      size={168}
      bgColor="#ffffff"
      fgColor="#1A1A1A"
      style={{ display: 'block' }}
    />
  )
}

// ---- props ----

export interface ProfileProps {
  lang: Lang
  onLangChange: (lang: Lang) => void
  name: string
  bloodType: BloodType
  donationCount: number
  lastDonation: string | null
  /** Whether the user has completed donor profile setup. */
  isDonor: boolean
  /** 5-character donor confirmation code shown on the QR card. */
  donorCode: string
  /** Show the "eligible to donate again" cooldown notice. */
  showCooldown?: boolean
  available: boolean
  onAvailableChange: (v: boolean) => void
  /** Controls whether requesters can see the donor's number in an emergency. */
  emergencyCallable: boolean
  onEmergencyChange: (v: boolean) => void
  onEditProfile: () => void
  onRegisterDonor: () => void
  onLogout: () => void
  onNavigate: (tab: Tab) => void
}

/**
 * Profile — logged-in user profile with stats, donor QR code, and settings.
 * Port of Profile v2.dc.html.
 */
export function Profile({
  lang,
  onLangChange,
  name,
  bloodType,
  donationCount,
  lastDonation,
  isDonor,
  donorCode,
  showCooldown = false,
  available,
  onAvailableChange,
  emergencyCallable,
  onEmergencyChange,
  onEditProfile,
  onRegisterDonor,
  onLogout,
  onNavigate,
}: ProfileProps) {
  const [logoutHover, setLogoutHover] = useState(false)

  const isMy = lang === 'my'
  const langFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'
  const count = formatNumber(donationCount, lang)
  const initial = (name.trim()[0] || '?').toUpperCase()

  const t = {
    my: {
      donatedLine: 'လှူဒါန်းမှု ' + count + ' ကြိမ်',
      donatedLineEn: 'Donated ' + donationCount + ' times',
      lastLine: lastDonation ? 'နောက်ဆုံး လှူဒါန်းသည့်ရက် — ' + lastDonation : 'နောက်ဆုံး လှူဒါန်းသည့်ရက် — —',
      lastLineEn: lastDonation ? 'Last donation — ' + lastDonation : 'Last donation — —',
      cooldownLine: 'နောက်တစ်ကြိမ် လှူဒါန်းနိုင်သည့်ရက် — ၂၀၂၆ ဇွန် ၂၃',
      cooldownLineEn: 'Eligible to donate again — 23 Jun 2026',
      qrTitle: 'သင့် QR ကုဒ်',
      qrCaption: 'လှူဒါန်းမှု အတည်ပြုရန် တောင်းခံသူအား ပြပါ',
      qrCaptionEn: 'Show this to the requester to confirm your donation',
      codeLabel: 'ကုဒ်ဖြင့် အတည်ပြုရန်',
      nudgeTitle: 'သွေးလှူရှင် အချက်အလက် ဖြည့်ပါ',
      nudgeSub: 'Finish your donor profile',
      settingsHeader: 'ဆက်တင်များ',
      availLabel: 'သွေးလှူရန် အသင့်ရှိသည်',
      emergencyLabel: 'အရေးပေါ်တွင် တောင်းခံသူများ တိုက်ရိုက် ဖုန်းခေါ်ဆိုခွင့်ပြုမည်',
      emergencyHelp: 'သင့်နံပါတ်ကို စာရင်းများတွင် ဖော်ပြမည် မဟုတ်ပါ။ အရေးပေါ်အခါတွင်သာ ဖော်ပြခွင့်ပြုသည်။',
      emergencyHelpEn: 'Your number is never shown in lists — only revealed in an emergency.',
      languageLabel: 'ဘာသာစကား',
      editLabel: 'ပရိုဖိုင် ပြင်ဆင်ရန်',
      editSub: 'အမည်၊ မြို့နယ်၊ သွေးအုပ်စုနှင့် ဖုန်းနံပါတ်',
      logoutLabel: 'ထွက်ရန်',
    },
    en: {
      donatedLine: 'Donated ' + count + ' times',
      donatedLineEn: '',
      lastLine: lastDonation ? 'Last donation — ' + lastDonation : 'Last donation — —',
      lastLineEn: '',
      cooldownLine: 'Eligible to donate again — 23 Jun 2026',
      cooldownLineEn: '',
      qrTitle: 'Your QR Code',
      qrCaption: 'Show this to the requester to confirm your donation',
      qrCaptionEn: '',
      codeLabel: 'Or confirm by code',
      nudgeTitle: 'Complete your donor profile',
      nudgeSub: 'Finish your donor profile',
      settingsHeader: 'Settings',
      availLabel: 'Available to donate',
      emergencyLabel: 'Let requesters call me directly in an emergency',
      emergencyHelp: 'Your number is never shown in lists — this only allows it to be revealed in an emergency.',
      emergencyHelpEn: '',
      languageLabel: 'Language',
      editLabel: 'Edit profile',
      editSub: 'Name, township, blood type and phone',
      logoutLabel: 'Log out',
    },
  }[lang]

  const divider = <div style={{ height: 1, background: 'var(--border-card)', margin: '0 16px' }} />

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card">

        {/* Top bar */}
        <ScreenHeader variant="brand" align="left" />

        {/* Scrollable content */}
        <div className="bh-scroll" style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '8px 20px 24px',
          display: 'flex', flexDirection: 'column', gap: 22,
        }}>

          {/* Avatar + name + blood badge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{
              width: 84, height: 84, borderRadius: '999px',
              background: 'var(--color-primary-tint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-burmese)', fontSize: 34, fontWeight: 600, color: 'var(--color-primary)',
            }}>
              {initial}
            </div>
            <div style={{ marginTop: 14, fontFamily: langFont, fontSize: 22, fontWeight: 600, lineHeight: 1.3, color: 'var(--text-primary)' }}>
              {name}
            </div>
            <div style={{ marginTop: 10 }}>
              <Badge>{bloodType}</Badge>
            </div>
          </div>

          {/* Stats card */}
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-card)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Donation count row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '999px', background: 'var(--color-primary-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                  <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: langFont, fontSize: 16, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                  {t.donatedLine}
                </div>
                {t.donatedLineEn && (
                  <div style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {t.donatedLineEn}
                  </div>
                )}
              </div>
            </div>

            {divider}

            {/* Last donation row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '999px', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15 14" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: langFont, fontSize: 15, fontWeight: 500, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                  {t.lastLine}
                </div>
                {t.lastLineEn && (
                  <div style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {t.lastLineEn}
                  </div>
                )}
              </div>
            </div>

            {/* Cooldown notice */}
            {showCooldown && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 10 }}>
                <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.5 21a1.7 1.7 0 0 1-3 0" />
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: langFont, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                    {t.cooldownLine}
                  </div>
                  {t.cooldownLineEn && (
                    <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text-hint)', marginTop: 1 }}>
                      {t.cooldownLineEn}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Donor QR code card */}
          {isDonor ? (
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-card)', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontFamily: langFont, fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                {t.qrTitle}
              </div>
              <div style={{ fontFamily: langFont, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 260 }}>
                {t.qrCaption}
              </div>
              {t.qrCaptionEn && (
                <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--text-hint)', marginTop: 3, maxWidth: 260 }}>
                  {t.qrCaptionEn}
                </div>
              )}

              {/* QR code */}
              <div style={{ width: 184, height: 184, marginTop: 18, padding: 12, background: '#fff', border: '1px solid var(--border-card)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DonorQR code={donorCode} />
              </div>

              {/* 5-char code */}
              <div style={{ width: '100%', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-card)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontFamily: langFont, fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-hint)' }}>
                  {t.codeLabel}
                </div>
                <div style={{ marginTop: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 34, fontWeight: 600, letterSpacing: '.32em', color: 'var(--text-primary)', paddingLeft: '.32em' }}>
                  {donorCode.toUpperCase()}
                </div>
              </div>
            </div>
          ) : (
            /* Not-a-donor nudge */
            <button
              type="button"
              onClick={onRegisterDonor}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                width: '100%', textAlign: 'left',
                background: 'var(--color-primary-tint)', border: 'none',
                borderRadius: 'var(--radius-card)', padding: 16, cursor: 'pointer',
              }}
            >
              <span style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '999px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                  <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: langFont, fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: 'var(--color-primary)' }}>
                  {t.nudgeTitle}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--color-primary-press)', opacity: 0.85, marginTop: 1 }}>
                  {t.nudgeSub}
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: langFont, fontSize: 13, fontWeight: 600, letterSpacing: '.02em', color: 'var(--text-hint)', padding: '0 4px', textTransform: 'uppercase' }}>
              {t.settingsHeader}
            </div>
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>

              {/* Available toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: langFont, fontSize: 16, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                  {t.availLabel}
                </span>
                <Switch checked={available} onChange={onAvailableChange} ariaLabel={t.availLabel} />
              </div>
              {divider}

              {/* Emergency callable toggle */}
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: langFont, fontSize: 16, lineHeight: 1.45, color: 'var(--text-primary)' }}>
                    {t.emergencyLabel}
                  </span>
                  <div style={{ flexShrink: 0, marginTop: 1 }}>
                    <Switch checked={emergencyCallable} onChange={onEmergencyChange} ariaLabel={t.emergencyLabel} />
                  </div>
                </div>
                <div style={{ fontFamily: langFont, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', marginTop: 8 }}>
                  {t.emergencyHelp}
                </div>
                {t.emergencyHelpEn && (
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-hint)', marginTop: 2 }}>
                    {t.emergencyHelpEn}
                  </div>
                )}
              </div>
              {divider}

              {/* Language segmented control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: langFont, fontSize: 16, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                  {t.languageLabel}
                </span>
                <LanguageToggle lang={lang} onChange={onLangChange} track="bg" />
              </div>
              {divider}

              {/* Edit profile */}
              <button
                type="button"
                onClick={onEditProfile}
                style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 16, cursor: 'pointer' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: langFont, fontSize: 16, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                    {t.editLabel}
                  </div>
                  <div style={{ fontFamily: langFont, fontSize: 13, lineHeight: 1.4, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {t.editSub}
                  </div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
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
              width: '100%', height: 54,
              background: logoutHover ? 'var(--color-primary-wash)' : 'var(--surface-card)',
              border: '1px solid var(--border-field)',
              borderRadius: 'var(--radius-button)',
              fontFamily: langFont, fontSize: 16, fontWeight: 600,
              color: logoutHover ? 'var(--color-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'background 120ms ease, color 120ms ease',
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
