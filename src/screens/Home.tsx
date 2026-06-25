import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import { Badge } from '../components/Badge'
import { Switch } from '../components/Switch'
import { BottomNav } from '../components/BottomNav'
import type { Tab } from '../components/BottomNav'
import type { BloodType } from '../blood'
import { COMPATIBLE_REQUEST_TYPES } from '../blood'
import type { Lang } from '../i18n'
import { formatNumber } from '../i18n'
import { supabase } from '../lib/supabase'
import { formatPhone, formatDistanceLabel } from '../format'

interface FcmDonorAlert {
  requestId: string
  bloodType: string
  urgency: string
  address: string
}

// ---- constants ----

const DISPLAY_RADIUS_KM = 10

// ---- types ----

interface NearbyRequest {
  id: string
  bloodType: BloodType
  currentAddress: string
  distMeters: number
  createdAt: string
  urgent: boolean
  phone: string
}

// ---- helpers ----

/** Format ISO timestamp to a "X min ago" / "X hr ago" label with Burmese numerals. */
function formatTimeAgo(createdAt: string, lang: Lang): string {
  // Clamp to 0 to guard against server clock skew producing negative values (WR-03)
  const diffMs = Math.max(0, Date.now() - new Date(createdAt).getTime())
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) {
    return lang === 'my'
      ? `${formatNumber(diffMin, lang)} မိနစ်က`
      : `${formatNumber(diffMin, lang)} min ago`
  }
  const diffHr = Math.floor(diffMin / 60)
  return lang === 'my'
    ? `${formatNumber(diffHr, lang)} နာရီက`
    : `${formatNumber(diffHr, lang)} hr ago`
}

// ---- sub-component ----

interface RequestCardProps {
  req: NearbyRequest
  lang: Lang
  urgentLabel: string
  callLabel: string
  helpLabel: string
  /** Whether the current donor has already responded to this request. */
  responded: boolean
  /** Called when the donor taps "I'll help". */
  onRespond: () => void
}

function RequestCard({ req, lang, urgentLabel, callLabel, helpLabel, responded, onRespond }: RequestCardProps) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 24, flexWrap: 'wrap' }}>
          <span style={{
            minWidth: 0,
            fontFamily: 'var(--font-burmese)',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {req.currentAddress}
          </span>
          {/* Green "✓ responded" tag — appears by the address only after responding (D-01) */}
          {responded && (
            <span style={{
              flexShrink: 0,
              fontFamily: 'var(--font-burmese)',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              color: 'var(--color-success)',
              background: 'var(--color-success-tint)',
              borderRadius: 'var(--radius-pill)',
              padding: '4px 8px',
            }}>
              ✓ ကူညီမည်
            </span>
          )}
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
          <span>{formatDistanceLabel(req.distMeters, lang)}</span>
          <span style={{ width: 3, height: 3, borderRadius: '999px', background: 'var(--text-hint)', flexShrink: 0 }} />
          <span>{formatTimeAgo(req.createdAt, lang)}</span>
        </div>
        {/* Phone row — hidden until the donor has responded (D-02) */}
        {responded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatPhone(req.phone)}
            </span>
          </div>
        )}
      </div>

      {/* Action slot — state machine (D-01):
          not responded → "I'll help" pill;
          responded     → round red call button */}
      {responded ? (
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
      ) : (
        <button
          type="button"
          onClick={onRespond}
          aria-label={helpLabel}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 36,
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            background: 'var(--color-primary-tint)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-burmese)',
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            padding: '0 14px',
            cursor: 'pointer',
          }}
        >
          {helpLabel}
        </button>
      )}
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
  /** Donor's last-known coarsened latitude — used by feed query. */
  donorLat?: number | null
  /** Donor's last-known coarsened longitude — used by feed query. */
  donorLng?: number | null
  /** Supabase user ID of the logged-in user — used to exclude own request from feed. */
  currentUserId?: string | null
  /** Donor's blood type — used for blood-type compatibility filtering. */
  donorBloodType?: BloodType
  /** Set of request IDs the current donor has already responded to. */
  respondedIds?: Set<string>
  /** Called when the donor taps "I'll help" on a request card. */
  onRespond?: (reqId: string) => void
  /** Whether to show the expiring-soon extend banner on the active-request card (D-17). */
  showExtendBanner?: boolean
  /** Called when the requester taps "Extend +12h" on the banner (D-18). */
  onExtend?: () => void
  /** FCM donor alert to show as an overlay modal when app opens via notification tap. */
  fcmDonorAlert?: FcmDonorAlert | null
  /** Clears the FCM donor alert (after dismiss or "Will Help"). */
  onDismissFcmDonorAlert?: () => void
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
  donorLat = null,
  donorLng = null,
  currentUserId = null,
  donorBloodType,
  respondedIds,
  onRespond,
  showExtendBanner,
  onExtend,
  fcmDonorAlert = null,
  onDismissFcmDonorAlert,
}: HomeProps) {
  const [requests, setRequests] = useState<NearbyRequest[]>([])

  useEffect(() => {
    // Pitfall 6: guard on null coords — render empty state without calling RPC
    // Use explicit null/undefined checks to avoid silently suppressing feed if coords are 0 (WR-04)
    if (donorLat === null || donorLat === undefined ||
        donorLng === null || donorLng === undefined ||
        !donorBloodType) {
      setRequests([])
      return
    }

    let cancelled = false
    async function loadFeed() {
      const { data, error } = await supabase.rpc('requests_within_radius', {
        lat: donorLat as number,
        lng: donorLng as number,
        radius_km: DISPLAY_RADIUS_KM,
      })
      if (error || !data || cancelled) return

      const filtered = data
        .filter((r) => r.requester_id !== currentUserId)
        .filter((r) => COMPATIBLE_REQUEST_TYPES[donorBloodType as BloodType].includes(r.blood_type as BloodType))
        .map((r) => ({
          id: r.id,
          bloodType: r.blood_type as BloodType,
          currentAddress: r.current_address,
          distMeters: r.dist_meters,
          createdAt: r.created_at,
          urgent: r.urgency === 'urgent',
          phone: r.contact_phone,
        }))
      setRequests(filtered)
    }
    void loadFeed()
    return () => { cancelled = true }
  }, [donorLat, donorLng, donorBloodType, currentUserId])

  const t = {
    my: {
      availTitle: 'သွေးလှူရန် အသင့်ရှိသည်',
      availOn:    'Available to donate · အသင့်ရှိသည်',
      availOff:   'Available to donate · မရရှိနိုင်ပါ',
      setupTitle: 'သွေးလှူရှင် အချက်အလက် ဖြည့်ပါ',
      setupSub:   'Finish your donor profile',
      activeTitle:'သင့်တောင်းခံချက် ဆောင်ရွက်ဆဲ ဖြစ်သည်',
      activeSub:  'Your request is active',
      activityLine: 'အနီးနားရှိ သွေးလှူနိုင်သူများ မြင်နိုင်ပါပြီ — တုံ့ပြန်မှု စောင့်ဆဲ',
      activitySub:  'Nearby donors can see your request — waiting for responses',
      viewBtn:    'ကြည့်ရန်',
      requestBtn: 'သွေး တောင်းခံရန်',
      feedTitle:  'အနီးနားရှိ တောင်းခံချက်များ',
      feedSub:    'Nearby requests',
      emptyTitle: 'အနီးနားတွင် သွေးလိုအပ်သူ မရှိသေးပါ။',
      emptySub:   'လိုအပ်သည့်အခါ ချက်ချင်း အကြောင်းကြားပါမည်။',
      emptyHint:  "We'll alert you the moment someone does.",
      urgentLabel:'အရေးပေါ်',
      callLabel:  'ဖုန်းခေါ်ရန်',
      helpLabel:  'ကူညီမည်',
    },
    en: {
      availTitle: 'Available to donate',
      availOn:    'Tap to mark unavailable',
      availOff:   'Tap to mark available',
      setupTitle: 'Complete your donor profile',
      setupSub:   'Finish your donor profile',
      activeTitle:'Your request is active',
      activeSub:  'Your request is active',
      activityLine: 'Nearby donors can see your request — waiting for responses',
      activitySub:  'Nearby donors can see your request — waiting for responses',
      viewBtn:    'View',
      requestBtn: 'Request Blood',
      feedTitle:  'Nearby Requests',
      feedSub:    'Nearby requests',
      emptyTitle: 'No nearby blood requests yet.',
      emptySub:   "We'll alert you the moment someone needs help.",
      emptyHint:  "You'll be notified immediately when someone nearby needs a donor.",
      urgentLabel:'Urgent',
      callLabel:  'Call',
      helpLabel:  "I'll help",
    },
  }[lang]

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card" style={{ position: 'relative' }}>

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
              {/* Expiring-soon extend banner (D-17) — renders inside the active-request card before View button.
                  Uses inline amber tokens (#B45309, rgba(230,120,0,.18)) matching RequestLive banner since
                  no --color-warning CSS token exists in the current theme. */}
              {showExtendBanner && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid rgba(230,120,0,.18)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 13.5, fontWeight: 600, color: '#B45309', lineHeight: 1.4 }}>
                      {lang === 'my' ? 'တောင်းခံချက် မကြာမီ သက်တမ်းကုန်မည်' : 'Request expiring soon'}
                    </div>
                  </div>
                  <button type="button" onClick={onExtend} style={{
                    flexShrink: 0,
                    height: 32,
                    padding: '0 12px',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    background: '#B45309',
                    color: '#fff',
                    fontFamily: 'var(--font-burmese)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    {lang === 'my' ? '+12 နာရီ' : '+12h'}
                  </button>
                </div>
              )}
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
              {requests.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-burmese)',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                    {t.emptyTitle}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.55 }}>
                    {t.emptyHint}
                  </div>
                </div>
              ) : (
                requests.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    lang={lang}
                    urgentLabel={t.urgentLabel}
                    callLabel={t.callLabel}
                    helpLabel={t.helpLabel}
                    responded={respondedIds?.has(req.id) ?? false}
                    onRespond={() => onRespond?.(req.id)}
                  />
                ))
              )}
            </div>
          </div>

        </div>

        {/* Bottom nav */}
        <BottomNav active="home" lang={lang} onNavigate={onNavigate} />

      </div>

      {/* FCM donor alert modal — shown when app opens via notification tap */}
      {fcmDonorAlert && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}>
          {/* Scrim */}
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.45)' }}
            onClick={onDismissFcmDonorAlert}
          />
          {/* Sheet */}
          <div style={{
            position: 'relative',
            background: 'var(--surface-card)',
            borderRadius: '20px 20px 0 0',
            padding: '8px 20px 32px',
          }}>
            <div style={{ width: 38, height: 4, borderRadius: '999px', background: 'var(--border-field)', margin: '8px auto 20px' }} />

            {/* Urgency + blood type row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              {fcmDonorAlert.urgency === 'urgent' && (
                <span style={{
                  background: 'var(--color-primary)', color: '#fff',
                  borderRadius: 6, padding: '3px 9px',
                  fontFamily: 'var(--font-burmese)', fontSize: 12, fontWeight: 600,
                }}>
                  {lang === 'my' ? 'အရေးပေါ်' : 'Urgent'}
                </span>
              )}
              <Badge size="lg">{fcmDonorAlert.bloodType}</Badge>
            </div>

            {/* Title */}
            <div style={{
              fontFamily: 'var(--font-burmese)', fontSize: 18, fontWeight: 600,
              lineHeight: 1.4, color: 'var(--text-primary)', marginBottom: 6,
            }}>
              {lang === 'my' ? 'သွေး လိုအပ်နေသည်' : 'Blood needed nearby'}
            </div>

            {/* Address */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 7,
              fontFamily: 'var(--font-burmese)', fontSize: 14,
              color: 'var(--text-secondary)', marginBottom: 20,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0, marginTop: 2 }}>
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{fcmDonorAlert.address}</span>
            </div>

            {/* Will Help button */}
            <button
              type="button"
              onClick={() => {
                onRespond?.(fcmDonorAlert.requestId)
                onDismissFcmDonorAlert?.()
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: 54, border: 'none',
                borderRadius: 'var(--radius-button)',
                background: 'var(--color-primary)', color: '#fff',
                fontFamily: 'var(--font-burmese)', fontSize: 16, fontWeight: 600,
                cursor: 'pointer', boxShadow: 'var(--shadow-cta)',
              }}
            >
              {lang === 'my' ? 'ကူညီမည်' : "I'll help"}
            </button>

            {/* Dismiss link */}
            <button
              type="button"
              onClick={onDismissFcmDonorAlert}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                background: 'none', border: 'none', marginTop: 12,
                fontFamily: 'var(--font-burmese)', fontSize: 14,
                color: 'var(--text-hint)', cursor: 'pointer',
              }}
            >
              {lang === 'my' ? 'ပိတ်ရန်' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default Home
