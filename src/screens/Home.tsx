import type { CSSProperties } from 'react'
import { Badge } from '../components/Badge'
import { Switch } from '../components/Switch'
import { BottomNav } from '../components/BottomNav'
import type { Tab } from '../components/BottomNav'
import type { BloodType } from '../blood'
import type { Lang } from '../i18n'

// ---- types ----

interface NearbyRequest {
  id: string
  bloodType: BloodType
  township: Record<Lang, string>
  distance: Record<Lang, string>
  timeAgo: Record<Lang, string>
  urgent: boolean
  phone: string
}

// ---- static dummy feed ----

const DUMMY_REQUESTS: NearbyRequest[] = [
  {
    id: 'r1',
    bloodType: 'B+',
    township: { my: 'ရန်ကုန် ဆေးရုံကြီး', en: 'Yangon General Hospital' },
    distance: { my: '~၂ km', en: '~2 km' },
    timeAgo: { my: '၁၅ မိနစ်က', en: '15 min ago' },
    urgent: true,
    phone: '+959678901234',
  },
  {
    id: 'r2',
    bloodType: 'A-',
    township: { my: 'မြောက်ဥက္ကလာပ', en: 'North Okkalapa' },
    distance: { my: '~၃ km', en: '~3 km' },
    timeAgo: { my: '၂၂ မိနစ်က', en: '22 min ago' },
    urgent: false,
    phone: '+959250884017',
  },
  {
    id: 'r3',
    bloodType: 'O+',
    township: { my: 'သင်္ဂန်းကျွန်း', en: 'Thingangkyun' },
    distance: { my: '~၅ km', en: '~5 km' },
    timeAgo: { my: '၁ နာရီက', en: '1 hr ago' },
    urgent: false,
    phone: '+959421660392',
  },
]

/** E.164 (+95 9 XXXXXXXXX) → local display "09-XXX-XXX-XXX" */
function formatPhone(e164: string): string {
  const m = e164.match(/^\+95(9\d{9,10})$/)
  if (!m) return e164
  const local = '0' + m[1]
  return local.length === 11
    ? local.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1-$2-$3-$4')
    : local.replace(/^(\d{2})(\d{3})(\d{2})(\d{3})$/, '$1-$2-$3-$4')
}

// ---- sub-component ----

interface RequestCardProps {
  req: NearbyRequest
  lang: Lang
  urgentLabel: string
  callLabel: string
}

function RequestCard({ req, lang, urgentLabel, callLabel }: RequestCardProps) {
  const card: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-card)',
    borderRadius: 16,
    padding: 15,
  }

  return (
    <div style={card}>
      {/* Blood type column (urgent tag + badge) */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
        {req.urgent && (
          <span style={{
            background: 'var(--color-primary)',
            color: '#fff',
            borderRadius: 6,
            padding: '3px 8px',
            fontFamily: 'var(--font-burmese)',
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>
            {urgentLabel}
          </span>
        )}
        <Badge>{req.bloodType}</Badge>
      </div>

      {/* Info column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 24 }}>
          <span style={{
            flex: 1,
            minWidth: 0,
            fontFamily: 'var(--font-burmese)',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {req.township[lang]}
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 5,
          fontFamily: 'var(--font-burmese)',
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          <span>{req.distance[lang]}</span>
          <span style={{ width: 3, height: 3, borderRadius: '999px', background: 'var(--text-hint)', flexShrink: 0 }} />
          <span>{req.timeAgo[lang]}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatPhone(req.phone)}
          </span>
        </div>
      </div>

      {/* Call button */}
      <a
        href={`tel:${req.phone}`}
        aria-label={callLabel}
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: '999px',
          background: 'var(--color-primary)',
          color: '#fff',
          textDecoration: 'none',
          boxShadow: 'var(--shadow-cta)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </a>
    </div>
  )
}

// ---- main screen ----

export interface HomeProps {
  lang: Lang
  /** Whether the user has completed their donor profile setup. */
  donorReady: boolean
  available: boolean
  onAvailableChange: (v: boolean) => void
  /** Whether the user has an active open blood request. */
  hasOpenRequest?: boolean
  onRequestBlood: () => void
  /** Navigate to the active request session screen (Phase 3). */
  onViewRequest?: () => void
  onFinishSetup: () => void
  onNavigate: (tab: Tab) => void
}

/**
 * Home screen — donor feed and blood-request CTA. Shows nearby blood
 * requests, the donor availability toggle, and a CTA to post a new request.
 * Port of Home v2.dc.html.
 */
export function Home({
  lang,
  donorReady,
  available,
  onAvailableChange,
  hasOpenRequest = false,
  onRequestBlood,
  onViewRequest,
  onFinishSetup,
  onNavigate,
}: HomeProps) {
  const t = {
    my: {
      availTitle: 'သွေးလှူရန် အသင့်ရှိသည်',
      availOn:    'Available to donate · အသင့်ရှိသည်',
      availOff:   'Available to donate · မရရှိနိုင်ပါ',
      setupTitle: 'သွေးလှူရှင် အချက်အလက် ဖြည့်ပါ',
      setupSub:   'Finish your donor profile',
      activeTitle:'သင့်တောင်းခံချက် ဆောင်ရွက်ဆဲ ဖြစ်သည်',
      activeSub:  'Your request is active',
      activityLine: 'အကြောင်းကြားပြီး — တုံ့ပြန်မှု စောင့်ဆဲ',
      activitySub:  'Alerted — waiting for responses',
      viewBtn:    'ကြည့်ရန်',
      requestBtn: 'သွေး တောင်းခံရန်',
      feedTitle:  'အနီးနားရှိ တောင်းခံချက်များ',
      feedSub:    'Nearby requests',
      emptyTitle: 'အနီးနားတွင် သွေးလိုအပ်သူ မရှိသေးပါ။',
      emptySub:   'လိုအပ်သည့်အခါ ချက်ချင်း အကြောင်းကြားပါမည်။',
      emptyHint:  "We'll alert you the moment someone does.",
      urgentLabel:'အရေးပေါ်',
      callLabel:  'ဖုန်းခေါ်ရန်',
    },
    en: {
      availTitle: 'Available to donate',
      availOn:    'Tap to mark unavailable',
      availOff:   'Tap to mark available',
      setupTitle: 'Complete your donor profile',
      setupSub:   'Finish your donor profile',
      activeTitle:'Your request is active',
      activeSub:  'Your request is active',
      activityLine: 'Alerted — waiting for responses',
      activitySub:  'Alerted — waiting for responses',
      viewBtn:    'View',
      requestBtn: 'Request Blood',
      feedTitle:  'Nearby Requests',
      feedSub:    'Nearby requests',
      emptyTitle: 'No nearby blood requests yet.',
      emptySub:   "We'll alert you the moment someone needs help.",
      emptyHint:  "You'll be notified immediately when someone nearby needs a donor.",
      urgentLabel:'Urgent',
      callLabel:  'Call',
    },
  }[lang]

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card">

        {/* Top bar */}
        <div style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '22px 20px 14px',
          background: 'var(--color-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="22" height="26" viewBox="0 0 24 28" fill="none" style={{ display: 'block' }}>
              <path d="M12 1.5s9 9 9 15.5a9 9 0 0 1-18 0C3 10.5 12 1.5 12 1.5z" fill="var(--color-primary)" />
            </svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Blood Help
            </span>
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.5 21a1.7 1.7 0 0 1-3 0" />
          </svg>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '0 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>

          {/* Availability row OR donor-setup nudge */}
          {donorReady ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'var(--surface-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-card)',
              padding: '14px 16px',
            }}>
              <span style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: available ? 'var(--color-primary-tint)' : 'var(--color-bg)',
                transition: 'background 150ms ease',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={available ? 'var(--color-primary)' : 'var(--text-hint)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                  <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 16, fontWeight: 500, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                  {t.availTitle}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 1 }}>
                  {available ? t.availOn : t.availOff}
                </div>
              </div>
              <Switch checked={available} onChange={onAvailableChange} ariaLabel={t.availTitle} />
            </div>
          ) : (
            <button
              type="button"
              onClick={onFinishSetup}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                textAlign: 'left',
                background: 'var(--color-primary-tint)',
                border: 'none',
                borderRadius: 'var(--radius-card)',
                padding: '14px 16px',
                cursor: 'pointer',
              }}
            >
              <span style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                  <circle cx="12" cy="8" r="4" />
                  <path d="M5.5 21a7.5 7.5 0 0 1 13 0" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: 'var(--color-primary)' }}>
                  {t.setupTitle}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-primary-press)', opacity: 0.85, marginTop: 1 }}>
                  {t.setupSub}
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Active request card OR request blood CTA */}
          {hasOpenRequest ? (
            <div style={{
              background: 'var(--color-primary-tint)',
              borderRadius: 'var(--radius-card)',
              padding: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ position: 'relative', flexShrink: 0, display: 'flex', marginTop: 1 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                    <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                  </svg>
                  <span style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: '999px',
                    background: 'var(--color-primary)',
                    border: '2px solid var(--color-primary-tint)',
                  }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: 'var(--color-primary)' }}>
                    {t.activeTitle}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--color-primary-press)', opacity: 0.7, marginTop: 1 }}>
                    {t.activeSub}
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid rgba(154,45,34,.14)',
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0, marginTop: 2 }}>
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.5 21a1.7 1.7 0 0 1-3 0" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-primary)' }}>
                    {t.activityLine}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {t.activitySub}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onViewRequest}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  width: '100%',
                  height: 46,
                  marginTop: 14,
                  border: 'none',
                  borderRadius: 'var(--radius-button)',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontFamily: 'var(--font-burmese)',
                  fontSize: 15,
                  fontWeight: 600,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                {t.viewBtn}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequestBlood}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: 54,
                border: 'none',
                borderRadius: 'var(--radius-button)',
                background: 'var(--color-primary)',
                color: '#fff',
                fontFamily: 'var(--font-burmese)',
                fontSize: 16,
                fontWeight: 600,
                lineHeight: 1,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-cta)',
              }}
            >
              {t.requestBtn}
            </button>
          )}

          {/* Nearby requests section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 4 }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-burmese)', fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                {t.feedTitle}
              </h2>
              {lang === 'my' && (
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-hint)' }}>
                  {t.feedSub}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {DUMMY_REQUESTS.map((req) => (
                <RequestCard key={req.id} req={req} lang={lang} urgentLabel={t.urgentLabel} callLabel={t.callLabel} />
              ))}
            </div>
          </div>

        </div>

        {/* Bottom nav */}
        <BottomNav active="home" lang={lang} onNavigate={onNavigate} />

      </div>
    </div>
  )
}

export default Home
