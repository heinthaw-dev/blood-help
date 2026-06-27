import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Button } from './Button'
import type { Lang } from '../i18n'
import { formatNumber } from '../i18n'
import { formatPhone, formatDistanceLabel } from '../format'
import { supabase } from '../lib/supabase'

/** Shape of the donor FCM alert (structurally matches App.tsx's FcmDonorAlert). */
interface IncomingAlert {
  requestId: string
  bloodType: string
  urgency: string
  address: string
}

interface IncomingRequestAlertProps {
  alert: IncomingAlert
  lang: Lang
  /** Donor's last-known coarsened coords — used to estimate distance to the request. */
  donorLat: number | null
  donorLng: number | null
  /** Records the donor's response (status='responding') + notifies the requester.
   *  The modal stays open and reveals the phone number. */
  onHelp: (requestId: string) => void
  onClose: () => void
}

/** Phone shown before the donor responds — masked to honor the gated-reveal rule. */
const MASKED_PHONE = '09 •••• ••••'

/** Great-circle distance in metres between two lat/lng points (Haversine). */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * IncomingRequestAlert — the modal a donor sees after tapping a blood-request
 * push notification. Port of the "Incoming Request Alert" design: a centered,
 * two-state modal. Locked (default) shows blood type / urgency / location /
 * units / distance with the requester's phone MASKED; tapping "I'll help"
 * records the response and reveals the number with a Call button.
 *
 * The contact phone, units, and coordinates aren't in the FCM payload, so they
 * are fetched by request id (RLS allows reading active requests). The phone is
 * only *shown* after responding — matching the rest of the app's privacy model.
 *
 * Reset across alerts is handled by the parent passing key={requestId}, so this
 * component always mounts fresh for a new alert (no in-effect state reset).
 */
export function IncomingRequestAlert({
  alert,
  lang,
  donorLat,
  donorLng,
  onHelp,
  onClose,
}: IncomingRequestAlertProps) {
  const isMy = lang === 'my'
  const bodyFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'

  const [helped, setHelped] = useState(false)
  const [details, setDetails] = useState<{
    units: number
    phone: string
    lat: number | null
    lng: number | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadDetails() {
      const { data, error } = await supabase
        .from('blood_requests')
        .select('units_needed, contact_phone, lat, lng')
        .eq('id', alert.requestId)
        .maybeSingle()
      if (cancelled || error || !data) return
      setDetails({ units: data.units_needed, phone: data.contact_phone, lat: data.lat, lng: data.lng })
    }
    void loadDetails()
    return () => {
      cancelled = true
    }
  }, [alert.requestId])

  const t = {
    my: {
      urgent: 'အရေးပေါ်',
      title: 'သင့်အနီးနားတွင် သွေးလိုအပ်နေပါသည်',
      unitsLabel: (n: number) => `${formatNumber(n, 'my')} အိတ် လိုအပ်သည်`,
      lockHint: "'ကူညီမည်' ကို နှိပ်၍ ဖုန်းနံပါတ်ကို ကြည့်ပါ",
      helpingNote: 'သင် ကူညီနေပါသည် — တောင်းခံသူထံ အကြောင်းကြားပြီးပါပြီ',
      help: 'ကူညီမည်',
      decline: 'ယခု မကူညီနိုင်ပါ',
      call: 'ဖုန်းခေါ်ရန်',
      phoneLoading: 'ဖုန်းနံပါတ် ရယူနေသည်…',
      close: 'ပိတ်ရန်',
    },
    en: {
      urgent: 'Urgent',
      title: 'Blood is needed near you',
      unitsLabel: (n: number) => `${formatNumber(n, 'en')} unit${n === 1 ? '' : 's'} needed`,
      lockHint: "Tap 'I'll help' to see the phone number",
      helpingNote: "You're helping — the requester has been notified",
      help: "I'll help",
      decline: "Can't help right now",
      call: 'Call',
      phoneLoading: 'Getting number…',
      close: 'Close',
    },
  }[lang]

  const distMeters =
    details && details.lat != null && details.lng != null && donorLat != null && donorLng != null
      ? haversineMeters(donorLat, donorLng, details.lat, details.lng)
      : null

  function handleHelp() {
    onHelp(alert.requestId)
    setHelped(true)
  }

  // Detail rows — only those with available data are shown.
  const detailRows: { icon: ReactNode; text: string }[] = []
  if (alert.address.trim()) {
    detailRows.push({
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none', marginTop: 2 }}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
      text: alert.address,
    })
  }
  if (details) {
    detailRows.push({
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none', marginTop: 2 }}>
          <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
        </svg>
      ),
      text: t.unitsLabel(details.units),
    })
  }
  if (distMeters != null) {
    detailRows.push({
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none', marginTop: 2 }}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      ),
      text: formatDistanceLabel(distMeters, lang),
    })
  }

  // Shared ghost-button style (kept inline — below the 54 px action-button threshold).
  const ghostBtn: CSSProperties = {
    width: '100%',
    height: 44,
    marginTop: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: bodyFont,
    fontSize: 14.5,
    fontWeight: 500,
    lineHeight: 1,
    cursor: 'pointer',
    borderRadius: 'var(--radius-button)',
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Scrim */}
      <div className="bh-fade" style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.46)' }} onClick={onClose} />

      {/* Modal card */}
      <div
        className="bh-modal-in"
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 340,
          background: 'var(--surface-card)',
          borderRadius: 20,
          boxShadow: '0 18px 50px rgba(26,26,26,.32)',
          padding: '26px 22px 18px',
        }}
      >
        {/* Blood-type token */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            className="bh-ring-pulse"
            style={{
              width: 78,
              height: 78,
              borderRadius: 999,
              background: 'var(--color-primary-tint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--color-primary)' }}>
              {alert.bloodType}
            </span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {alert.urgency === 'urgent' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-pill)', padding: '4px 11px', fontFamily: bodyFont, fontSize: 12, fontWeight: 600, lineHeight: 1, marginBottom: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: '#fff' }} />
              {t.urgent}
            </div>
          )}
          <h1 style={{ margin: 0, fontFamily: bodyFont, fontSize: 19, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)' }}>
            {t.title}
          </h1>
        </div>

        {/* Detail card */}
        {detailRows.length > 0 && (
          <div style={{ marginTop: 18, background: 'var(--color-bg)', border: '1px solid var(--border-card)', borderRadius: 14, padding: '4px 14px' }}>
            {detailRows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: i < detailRows.length - 1 ? '1px solid var(--border-card)' : 'none',
                }}
              >
                {r.icon}
                <div style={{ flex: 1, minWidth: 0, fontFamily: bodyFont, fontSize: 14.5, fontWeight: 500, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                  {r.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Phone row — masked until the donor responds */}
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            padding: '13px 14px',
            background: helped ? 'var(--color-primary-wash)' : 'var(--color-bg)',
            border: `1px solid ${helped ? 'var(--color-primary-tint)' : 'var(--border-card)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ flex: 'none', display: 'flex' }}>
            {helped ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 600, letterSpacing: '.04em', lineHeight: 1.2, color: helped ? 'var(--text-primary)' : 'var(--text-hint)' }}>
              {!helped ? MASKED_PHONE : details ? formatPhone(details.phone) : t.phoneLoading}
            </div>
            {!helped && (
              <div style={{ fontFamily: bodyFont, fontSize: 12, lineHeight: 1.45, color: 'var(--text-secondary)', marginTop: 3 }}>
                {t.lockHint}
              </div>
            )}
          </div>
        </div>

        {/* Helping confirmation */}
        {helped && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--color-success-tint)', borderRadius: 12, padding: '11px 13px' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none', marginTop: 2 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div style={{ flex: 1, minWidth: 0, fontFamily: bodyFont, fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: 'var(--color-success)' }}>
              {t.helpingNote}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 18 }}>
          {helped ? (
            <>
              {/* Call link only once the phone has loaded; otherwise a disabled
                  placeholder so we never produce a broken `tel:` href. The
                  response is already recorded, so the number activates as soon
                  as the fetch resolves. */}
              {details ? (
                <Button
                  fullWidth
                  href={`tel:${details.phone}`}
                  aria-label={t.call}
                  icon={
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  }
                >
                  {t.call}
                </Button>
              ) : (
                <Button fullWidth disabled aria-label={t.phoneLoading}>
                  {t.phoneLoading}
                </Button>
              )}
              <button type="button" onClick={onClose} style={ghostBtn}>
                {t.close}
              </button>
            </>
          ) : (
            <>
              <Button
                fullWidth
                onClick={handleHelp}
                icon={
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1z" />
                  </svg>
                }
              >
                {t.help}
              </Button>
              <button type="button" onClick={onClose} style={ghostBtn}>
                {t.decline}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default IncomingRequestAlert
