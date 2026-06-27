import { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ScreenHeader } from '../components/ScreenHeader'
import { pushSupported, registerPushToken } from '../lib/push'
import type { BloodType } from '../blood'
import type { Lang } from '../i18n'

export interface DonorThankYouProps {
  lang: Lang
  bloodType: BloodType
  /** Donor's profile id (auth uid) — required to register the FCM token. */
  supabaseId: string | null
  onContinue: () => void
}

/** Bell icon — used in the enable card chip and the enable button. */
function BellIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flex: 'none' }}
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

/**
 * Detect iOS Safari running as a normal browser tab (not an installed PWA).
 * In that mode web push is unavailable, so the user must "Add to Home Screen"
 * before notifications can be enabled.
 */
function isIosSafariTab(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIOS) return false
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return !standalone
}

/**
 * Donor Thank You screen — shown immediately after a donor completes
 * registration. Confirms their blood type, then owns the push-notification
 * opt-in so the donor can be alerted for nearby compatible requests.
 *
 * Three states for the opt-in block:
 *  - idle / canEnable → notification card + red "Turn on alerts" button
 *  - needsInstall (iOS Safari tab) → "Add to Home Screen" guidance
 *  - enabled → green success card
 *
 * Port of Donor Thank You.dc.html, wired to the real push infra in lib/push.
 */
export function DonorThankYou({ lang, bloodType, supabaseId, onContinue }: DonorThankYouProps) {
  const bodyFont = lang === 'my' ? 'var(--font-burmese)' : 'var(--font-sans)'

  // Derived-from-environment initial state (client-only SPA — both are known at
  // first render). Never auto-requests permission, only reads the current grant.
  const [enabled, setEnabled] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  // iOS-Safari-tab needs install before web push works; fixed for the session.
  const [needsInstall] = useState(
    () =>
      !(typeof Notification !== 'undefined' && Notification.permission === 'granted') &&
      isIosSafariTab(),
  )
  const [continueHover, setContinueHover] = useState(false)

  // Side effect only: if permission was already granted before this screen
  // (e.g. a returning donor), silently refresh the FCM token. Reads permission
  // directly — not `enabled` — so it runs once on mount and not again when the
  // user taps to enable (handleEnable registers the token itself).
  useEffect(() => {
    const granted =
      typeof Notification !== 'undefined' && Notification.permission === 'granted'
    if (granted && supabaseId) void registerPushToken(supabaseId)
  }, [supabaseId])

  // canEnable: not already on, and the device can actually receive web push here.
  const canEnable = !enabled && !needsInstall && pushSupported()

  /** Request push permission + register the FCM token (tap only). */
  const handleEnable = async () => {
    if (!supabaseId) return
    const result = await registerPushToken(supabaseId)
    if (result === 'granted') setEnabled(true)
  }

  const t = {
    my: {
      headline: 'ကျေးဇူးတင်ပါတယ်!',
      subheadline: 'သင် တစ်စုံတစ်ဦး၏ အသက်ကို ကယ်တင်နိုင်ပါပြီ',
      bloodTypeLabel: 'သင့်သွေးအုပ်စု —',
      body: 'သွေးလှူရှင်အဖြစ် ပါဝင်ခဲ့သည့်အတွက် ကျေးဇူးအများကြီး တင်ပါသည်။ သင့်အနီးနားတွင် ကိုက်ညီသော သွေးအုပ်စု လိုအပ်သည့်အခါ ချက်ချင်း အကြောင်းကြားပေးပါမည်။',
      enablePrompt: 'အရေးပေါ် သွေးလိုအပ်မှုများကို ချက်ချင်း သိရှိနိုင်ရန် အသိပေးချက်များ ဖွင့်ပါ။',
      enableCta: 'အသိပေးချက်များ ဖွင့်ရန်',
      installGuide: 'အသိပေးချက်များ ရယူရန် Blood Help ကို Home Screen သို့ ထည့်ပါ',
      enabledLabel: 'အသိပေးချက်များ ဖွင့်ပြီးပါပြီ',
      continueCta: 'ပင်မသို့ ဆက်သွားရန်',
    },
    en: {
      headline: 'Thank you!',
      subheadline: 'You can now help save a life',
      bloodTypeLabel: 'Your blood type —',
      body: "Thank you for joining as a blood donor. When someone nearby needs a matching blood type, we'll alert you right away.",
      enablePrompt: "Turn on alerts so you'll know the moment blood is urgently needed nearby.",
      enableCta: 'Turn on alerts',
      installGuide: 'Add Blood Help to your Home Screen to receive alerts',
      enabledLabel: 'Alerts are on',
      continueCta: 'Continue to home',
    },
  }

  const s = t[lang]

  return (
    <div className="phone-entry-stage">
      <div
        className="phone-entry-card"
        style={{ display: 'flex', flexDirection: 'column', fontFamily: bodyFont }}
      >
        {/* Top bar: centered wordmark */}
        <ScreenHeader variant="brand" align="center" />

        {/* Main content — flows from the top, centered horizontally */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '24px 24px 12px',
          }}
        >
          {/* Heart icon */}
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: '999px',
              background: 'var(--color-primary-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
              flex: 'none',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block' }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>

          {/* Headline */}
          <h1 style={{ margin: 0, fontFamily: bodyFont, fontSize: '30px', fontWeight: 600, lineHeight: 1.3, color: 'var(--text-primary)' }}>
            {s.headline}
          </h1>

          {/* Subheadline */}
          <p style={{ margin: '18px 0 0', fontFamily: bodyFont, fontSize: '18px', fontWeight: 500, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
            {s.subheadline}
          </p>

          {/* Blood type badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
            <span style={{ fontFamily: bodyFont, fontSize: '14px', color: 'var(--text-secondary)' }}>
              {s.bloodTypeLabel}
            </span>
            <Badge>{bloodType}</Badge>
          </div>

          {/* Warm message */}
          <p style={{ margin: '24px 0 0', fontFamily: bodyFont, fontSize: '15px', lineHeight: 1.75, color: 'var(--text-secondary)', maxWidth: '300px' }}>
            {s.body}
          </p>
        </div>

        {/* Notification opt-in block (primary action) */}
        <div style={{ flex: 'none', padding: '0 24px 24px' }}>
          {enabled ? (
            /* Enabled: green success card */
            <Card
              padding="lg"
              background="var(--color-success-tint)"
              borderColor="var(--color-success-tint)"
              style={{ display: 'flex', alignItems: 'center', gap: '13px' }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  flex: 'none',
                  borderRadius: '999px',
                  background: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ margin: 0, flex: 1, minWidth: 0, textAlign: 'left', fontFamily: bodyFont, fontSize: '15px', fontWeight: 600, lineHeight: 1.5, color: 'var(--color-success)' }}>
                {s.enabledLabel}
              </p>
            </Card>
          ) : (
            /* Idle: prompt card with enable button or install guidance */
            <Card padding="lg" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '13px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    flex: 'none',
                    borderRadius: '999px',
                    background: 'var(--color-primary-tint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BellIcon size={20} color="var(--color-primary)" />
                </div>
                <p style={{ margin: 0, flex: 1, minWidth: 0, textAlign: 'left', fontFamily: bodyFont, fontSize: '14.5px', fontWeight: 500, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {s.enablePrompt}
                </p>
              </div>

              {canEnable ? (
                <Button
                  type="button"
                  fullWidth
                  onClick={handleEnable}
                  icon={<BellIcon size={19} color="#fff" />}
                  style={{ marginTop: '16px' }}
                >
                  <span style={{ fontFamily: bodyFont }}>{s.enableCta}</span>
                </Button>
              ) : (
                /* iOS Safari tab: web push unavailable → add-to-home-screen guidance */
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '11px',
                    marginTop: '16px',
                    borderRadius: 'var(--radius-button)',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--border-card)',
                    padding: '13px 14px',
                    textAlign: 'left',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none' }}>
                    <path d="M12 16V4" />
                    <path d="m8 8 4-4 4 4" />
                    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                  </svg>
                  <p style={{ margin: 0, flex: 1, minWidth: 0, fontFamily: bodyFont, fontSize: '13.5px', fontWeight: 500, lineHeight: 1.55, color: 'var(--text-primary)' }}>
                    {s.installGuide}
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Skip / continue — quiet secondary text link */}
          <button
            type="button"
            onClick={onContinue}
            onMouseEnter={() => setContinueHover(true)}
            onMouseLeave={() => setContinueHover(false)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '18px',
              padding: '6px 0',
              border: 'none',
              background: 'transparent',
              fontFamily: bodyFont,
              fontSize: '15px',
              fontWeight: 500,
              lineHeight: 1.4,
              color: continueHover ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 120ms ease',
            }}
          >
            {s.continueCta}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DonorThankYou
