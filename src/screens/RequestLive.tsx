import { useState, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Badge } from '../components/Badge'
import type { Lang } from '../i18n'

// ---- types ----

type Sheet = 'resolve' | 'code' | null
type ClosedReason = 'fulfilled' | 'outside' | 'canceled'

interface RevealedMap {
  [id: string]: boolean
}

interface ToastMsg {
  my: string
  en: string
}

// ---- static dummy donor data ----

const WILL_HELP = [
  { id: 'w1', name: 'ကိုကိုလွင်', initial: 'က', distance: '~၁.၄ km', phone: '09-770-111-001', tel: 'tel:+959770111001' },
  { id: 'w2', name: 'အောင်ကို',   initial: 'အ', distance: '~၂.၂ km', phone: '09-770-111-002', tel: 'tel:+959770111002' },
]

const CAN_CALL = [
  { id: 'c1', name: 'လှလှဝင်း', initial: 'လ',  distance: '~၃.၀ km', phone: '09-250-884-017', tel: 'tel:+959250884017' },
  { id: 'c2', name: 'နွေနွေ',    initial: 'နွ', distance: '~၄.၁ km', phone: '09-421-660-392', tel: 'tel:+959421660392' },
]

// ---- helpers ----

function toMyanmarDigits(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => '၀၁၂၃၄၅၆၇၈၉'[+d])
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

// ---- props ----

export interface RequestLiveProps {
  lang: Lang
  bloodType?: string
  township?: string
  alerting?: boolean
  hasResults?: boolean
  alertedCount?: number
  moreCount?: number
  unitsNeeded?: number
  unitsCollected?: number
  onBack: () => void
  onGoHome: () => void
}

/**
 * RequestLive — live blood request session screen.
 * Shows donor list, resolve bottom sheet, QR/code confirmation sub-sheet,
 * and closed success overlay.
 * Port of Request Live v2.dc.html.
 */
export function RequestLive({
  lang: _lang, // eslint-disable-line @typescript-eslint/no-unused-vars
  bloodType = 'B+',
  township = 'ရန်ကုန် ဆေးရုံကြီး',
  alerting = false,
  hasResults = true,
  alertedCount = 12,
  moreCount = 5,
  unitsNeeded = 2,
  unitsCollected: initCollected = 0,
  onBack,
  onGoHome,
}: RequestLiveProps) {
  const [revealed, setRevealed] = useState<RevealedMap>({})
  const [sheet, setSheet] = useState<Sheet>(null)
  const [closed, setClosed] = useState<ClosedReason | null>(null)
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const [code, setCode] = useState('')
  const [collected, setCollected] = useState(initCollected)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (my: string, en: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ my, en })
    toastTimer.current = setTimeout(() => setToast(null), 3600)
  }

  const handleConfirmInApp = () => {
    const next = collected + 1
    if (next >= unitsNeeded) {
      setClosed('fulfilled')
      setSheet(null)
      setCode('')
      setCollected(next)
    } else {
      setSheet(null)
      setCode('')
      setCollected(next)
      showToast(
        toMyanmarDigits(next) + ' / ' + toMyanmarDigits(unitsNeeded) + ' unit ရရှိပြီး — ကျန်အတွက် ဆက်ရှာနေပါမည်',
        next + ' / ' + unitsNeeded + ' units — still searching for the rest.'
      )
    }
  }

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase().replace(/[^A-Z2-7]/g, '').slice(0, 5))
  }

  const confirmReady = code.trim().length === 5
  const alertingDone = !alerting
  const showProgress = unitsNeeded > 1

  const transparencyLine =
    'အနီးနားရှိ သွေးလှူရှင် ' + toMyanmarDigits(alertedCount) +
    ' ဦးကို အကြောင်းကြားထားသည်။ "ကူညီပါမည်" နှိပ်သူတိုင်း ဤနေရာတွင် ဖုန်းခေါ်ရန်ခလုတ်နှင့်အတူ ပေါ်လာပါမည်။'
  const transparencyLineEn =
    "We've alerted " + alertedCount + " nearby donors. Anyone who taps “I’ll help” appears here with a call button."

  const moreLine = '+ နောက်ထပ် သွေးလှူရှင် ' + toMyanmarDigits(moreCount) + ' ဦးကို အကြောင်းကြားထားသည်'
  const moreLineEn = '+ ' + moreCount + ' more nearby donors notified'

  const closedData: Record<ClosedReason, { iconBg: string; iconColor: string; title: string; body: string; bodyEn: string }> = {
    fulfilled: {
      iconBg: 'var(--color-success-tint)',
      iconColor: 'var(--color-success)',
      title: 'သွေး ရရှိပြီးပါပြီ',
      body: 'ကျေးဇူးတင်ပါသည် — အသက်တစ်ချောင်းကို ကယ်တင်နိုင်ခဲ့ပါသည်။',
      bodyEn: 'You may have just saved a life. Thank you.',
    },
    outside: {
      iconBg: 'var(--color-success-tint)',
      iconColor: 'var(--color-success)',
      title: 'တောင်းခံချက် ပိတ်ပြီးပါပြီ',
      body: 'အပြင်မှ ရရှိကြောင်း မှတ်သားပြီး — ကိုယ်ရေးအချက်အလက်များကို ဖျက်လိုက်ပါပြီ။',
      bodyEn: 'Marked as received outside the app. Your personal data was purged.',
    },
    canceled: {
      iconBg: 'var(--color-bg)',
      iconColor: 'var(--text-hint)',
      title: 'တောင်းခံချက် ပယ်ဖျက်ပြီးပါပြီ',
      body: 'တောင်းခံချက်ကို ပိတ်ပြီး ကိုယ်ရေးအချက်အလက်များကို ဖျက်လိုက်ပါပြီ။',
      bodyEn: 'Request closed and personal data purged.',
    },
  }
  const cl = closedData[closed ?? 'fulfilled']

  const callBtn: CSSProperties = {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: '999px',
    background: '#D13E2F',
    textDecoration: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-cta)',
  }

  const confirmBtnStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 54,
    border: 'none',
    borderRadius: 'var(--radius-button)',
    fontFamily: 'var(--font-burmese)',
    fontSize: 16,
    fontWeight: 600,
    cursor: confirmReady ? 'pointer' : 'not-allowed',
    transition: 'background 120ms ease',
    background: confirmReady ? 'var(--color-primary)' : 'var(--border-field)',
    color: confirmReady ? '#fff' : 'var(--text-hint)',
  }

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card" style={{ position: 'relative' }}>

        {/* ── Header ── */}
        <div style={{ flex: 'none', padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={onBack}
              aria-label="Minimize — keeps request open"
              style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: '999px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 17, fontWeight: 600, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                သွေး တောင်းခံချက်
              </div>
              {showProgress && (
                <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-burmese)', fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>
                    {toMyanmarDigits(collected)} / {toMyanmarDigits(unitsNeeded)} unit ရရှိပြီး
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                    {collected} / {unitsNeeded} units
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSheet('resolve')}
              style={{
                flexShrink: 0, padding: '8px 12px', borderRadius: 'var(--radius-pill)',
                background: 'var(--color-success-tint)', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-burmese)', fontSize: 12, fontWeight: 600,
                lineHeight: 1, color: 'var(--color-success)', whiteSpace: 'nowrap',
              }}
            >
              သွေး ရရှိပြီးပါပြီ
            </button>
          </div>

          {/* Blood type + township row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginTop: 14, paddingBottom: 14, borderBottom: '0.5px solid var(--border-card)',
          }}>
            <Badge>{bloodType}</Badge>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--text-secondary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ fontFamily: 'var(--font-burmese)' }}>{township}</span>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="bh-scroll" style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>

          {/* Sending banner */}
          {alerting && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-primary-tint)', borderRadius: 'var(--radius-card)', padding: '13px 14px' }}>
              <span className="bh-pulse-dot" style={{ flexShrink: 0, width: 9, height: 9, borderRadius: '999px', background: 'var(--color-primary)' }} />
              <div>
                <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: 'var(--color-primary)' }}>
                  အနီးနားရှိ သွေးလှူရှင်များထံ ပို့နေပါသည်... ခဏစောင့်ပါ။
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-primary-press)', marginTop: 2, opacity: 0.8 }}>
                  Sending to nearby donors… please wait.
                </div>
              </div>
            </div>
          )}

          {/* Transparency card */}
          {alertingDone && (
            <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-card)', borderRadius: 'var(--radius-card)', padding: '13px 14px' }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-burmese)', fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                {transparencyLine}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--text-hint)' }}>
                {transparencyLineEn}
              </p>
            </div>
          )}

          {/* Searching spinner */}
          {!hasResults && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 20px 28px' }}>
              <span className="bh-spinner" />
              <div style={{ marginTop: 18, fontFamily: 'var(--font-burmese)', fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                သွေးလှူရှင်များကို ရှာဖွေနေပါသည်...
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 5 }}>
                Searching for donors…
              </div>
            </div>
          )}

          {/* Donor list */}
          {hasResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Will-help donors */}
              {WILL_HELP.map((donor) => (
                <div key={donor.id} style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-card)', borderRadius: 16, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      flexShrink: 0, width: 40, height: 40, borderRadius: '999px',
                      background: 'var(--color-success-tint)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-burmese)', fontSize: 16, fontWeight: 600, color: 'var(--color-success)',
                    }}>
                      {donor.initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-burmese)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {donor.name}
                        </span>
                        <span style={{
                          flexShrink: 0, fontFamily: 'var(--font-burmese)', fontSize: 11, fontWeight: 600,
                          lineHeight: 1, whiteSpace: 'nowrap', color: 'var(--color-success)',
                          background: 'var(--color-success-tint)', borderRadius: 'var(--radius-pill)', padding: '4px 8px',
                        }}>
                          ကူညီမည်
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: 13, color: 'var(--text-hint)' }}>
                        <span style={{ fontFamily: 'var(--font-burmese)', flexShrink: 0, whiteSpace: 'nowrap' }}>{donor.distance}</span>
                        <span style={{ flexShrink: 0, width: 3, height: 3, borderRadius: '999px', background: 'var(--text-hint)' }} />
                        <span style={{ whiteSpace: 'nowrap' }}>{donor.phone}</span>
                      </div>
                    </div>
                    <a href={donor.tel} aria-label="ဖုန်းခေါ်ရန်" style={callBtn}>
                      <PhoneIcon />
                    </a>
                  </div>
                </div>
              ))}

              {/* Can-call donors */}
              {CAN_CALL.map((donor) => (
                <div key={donor.id} style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-card)', borderRadius: 16, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      flexShrink: 0, width: 40, height: 40, borderRadius: '999px',
                      background: 'var(--color-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-burmese)', fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)',
                    }}>
                      {donor.initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-burmese)', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {donor.name}
                        </span>
                        <span style={{
                          flexShrink: 0, fontFamily: 'var(--font-burmese)', fontSize: 11, fontWeight: 600,
                          lineHeight: 1, whiteSpace: 'nowrap', color: 'var(--text-secondary)',
                          background: 'var(--color-bg)', border: '1px solid var(--border-card)',
                          borderRadius: 'var(--radius-pill)', padding: '4px 8px',
                        }}>
                          ခေါ်ဆိုနိုင်သည်
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: 13, color: 'var(--text-hint)' }}>
                        <span style={{ fontFamily: 'var(--font-burmese)', flexShrink: 0, whiteSpace: 'nowrap' }}>{donor.distance}</span>
                        {revealed[donor.id] && (
                          <>
                            <span style={{ flexShrink: 0, width: 3, height: 3, borderRadius: '999px', background: 'var(--text-hint)' }} />
                            <span>{donor.phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <a
                      href={donor.tel}
                      aria-label="ဖုန်းခေါ်ရန်"
                      onClick={() => setRevealed((r) => ({ ...r, [donor.id]: true }))}
                      style={callBtn}
                    >
                      <PhoneIcon />
                    </a>
                  </div>
                </div>
              ))}

              {/* More line */}
              <div style={{ textAlign: 'center', padding: '8px 0 2px', fontFamily: 'var(--font-burmese)', fontSize: 13, color: 'var(--text-hint)' }}>
                {moreLine}
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-hint)', opacity: 0.8 }}>
                {moreLineEn}
              </div>
            </div>
          )}
        </div>

        {/* ── Toast ── */}
        {toast && (
          <div className="bh-toast-anim" style={{
            position: 'absolute', left: '50%', bottom: 24,
            transform: 'translateX(-50%)',
            width: 340, maxWidth: 'calc(100% - 32px)',
            background: 'var(--text-primary)', color: '#fff',
            borderRadius: 12, padding: '12px 14px',
            boxShadow: '0 8px 24px rgba(26,26,26,.28)', zIndex: 30,
          }}>
            <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 13, lineHeight: 1.5 }}>{toast.my}</div>
            <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.7, marginTop: 1 }}>{toast.en}</div>
          </div>
        )}

        {/* ── Resolve bottom sheet ── */}
        {sheet === 'resolve' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div
              className="bh-fade"
              onClick={() => setSheet(null)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,.42)' }}
            />
            <div className="bh-sheet-up" style={{ position: 'relative', background: 'var(--surface-card)', borderRadius: '20px 20px 0 0', padding: '8px 20px 24px' }}>
              <div style={{ width: 38, height: 4, borderRadius: '999px', background: 'var(--border-field)', margin: '8px auto 16px' }} />
              <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 18, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                သွေး ဘယ်ကနေ ရရှိပါသလဲ?
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                Where did you get the blood?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>

                {/* From app donor */}
                <button
                  type="button"
                  onClick={() => setSheet('code')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13,
                    width: '100%', textAlign: 'left',
                    background: 'var(--color-primary-tint)', border: 'none',
                    borderRadius: 14, padding: 15, cursor: 'pointer',
                  }}
                >
                  <span style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                      <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                    </svg>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 15, fontWeight: 600, lineHeight: 1.45, color: 'var(--color-primary)' }}>
                      ဒီအက်ပ်မှ သွေးလှူရှင်ထံမှ
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-primary-press)', opacity: 0.8, marginTop: 1 }}>
                      From a donor in this app
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Outside app */}
                <button
                  type="button"
                  onClick={() => { setClosed('outside'); setSheet(null) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13,
                    width: '100%', textAlign: 'left',
                    background: 'var(--color-bg)', border: '1px solid var(--border-card)',
                    borderRadius: 14, padding: 15, cursor: 'pointer',
                  }}
                >
                  <span style={{
                    flexShrink: 0, width: 42, height: 42, borderRadius: 12,
                    background: 'var(--surface-card)', border: '1px solid var(--border-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 15, fontWeight: 500, lineHeight: 1.45, color: 'var(--text-primary)' }}>
                      အပြင်မှ ရရှိသည်
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                      Got it outside the app
                    </div>
                  </div>
                </button>

                {/* Cancel request */}
                <button
                  type="button"
                  onClick={() => { setClosed('canceled'); setSheet(null) }}
                  style={{
                    width: '100%', textAlign: 'center', background: 'none', border: 'none',
                    padding: '10px 8px 2px', cursor: 'pointer',
                    fontFamily: 'var(--font-burmese)', fontSize: 14, color: 'var(--text-hint)',
                  }}
                >
                  တောင်းခံချက် ပယ်ဖျက်မည်
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Code / scan sub-sheet ── */}
        {sheet === 'code' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div
              className="bh-fade"
              onClick={() => { setSheet(null); setCode('') }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,.42)' }}
            />
            <div className="bh-sheet-up" style={{ position: 'relative', background: 'var(--surface-card)', borderRadius: '20px 20px 0 0', padding: '8px 20px 24px' }}>
              <div style={{ width: 38, height: 4, borderRadius: '999px', background: 'var(--border-field)', margin: '8px auto 16px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSheet('resolve')}
                  aria-label="Back"
                  style={{
                    flexShrink: 0, width: 32, height: 32, borderRadius: '999px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 17, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                    သွေးလှူရှင်၏ ကုဒ်
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Scan or enter the donor's code
                  </div>
                </div>
              </div>

              {/* QR scanner viewport */}
              <button
                type="button"
                onClick={handleConfirmInApp}
                style={{
                  position: 'relative', width: '100%', height: 188, marginTop: 16,
                  border: 'none', borderRadius: 16, background: 'var(--text-primary)',
                  overflow: 'hidden', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div style={{ position: 'absolute', width: 130, height: 130, borderRadius: 14 }}>
                  <span style={{ position: 'absolute', top: 0, left: 0, width: 26, height: 26, borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '8px 0 0 0' }} />
                  <span style={{ position: 'absolute', top: 0, right: 0, width: 26, height: 26, borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 8px 0 0' }} />
                  <span style={{ position: 'absolute', bottom: 0, left: 0, width: 26, height: 26, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderRadius: '0 0 0 8px' }} />
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderRadius: '0 0 8px 0' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.85)' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                    <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                  </svg>
                  <span style={{ fontFamily: 'var(--font-burmese)', fontSize: 12 }}>QR ကို ဤနေရာတွင် ထားပါ</span>
                </div>
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                <span style={{ flex: 1, height: 1, background: 'var(--border-card)' }} />
                <span style={{ fontFamily: 'var(--font-burmese)', fontSize: 12, color: 'var(--text-hint)' }}>သို့မဟုတ် ၅-လုံးကုဒ်</span>
                <span style={{ flex: 1, height: 1, background: 'var(--border-card)' }} />
              </div>

              {/* Code input */}
              <input
                value={code}
                onChange={handleCodeInput}
                inputMode="text"
                autoCapitalize="characters"
                placeholder="• • • • •"
                aria-label="5-char donor code"
                style={{
                  width: '100%', height: 60, textAlign: 'center',
                  border: '1px solid var(--border-field)', borderRadius: 12,
                  background: 'var(--color-bg)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 28, fontWeight: 600, letterSpacing: '0.28em',
                  textTransform: 'uppercase', color: 'var(--text-primary)', outline: 'none',
                }}
              />

              <p style={{ margin: '14px 0 16px', fontFamily: 'var(--font-burmese)', fontSize: 12, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                သွေးလှူရှင်၏ QR ကို စကင်ဖတ်ပါ (သို့) ၅-လုံးကုဒ် ရိုက်ထည့်ပါ။ ဤတောင်းခံချက်သို့ တုံ့ပြန်ထားသူများသာ။
                <span style={{ display: 'block', fontFamily: 'var(--font-sans)', color: 'var(--text-hint)', marginTop: 3 }}>
                  Scan the donor's QR or enter their 5-char code — only valid for donors who responded to this request.
                </span>
              </p>

              <button type="button" onClick={handleConfirmInApp} disabled={!confirmReady} style={confirmBtnStyle}>
                အတည်ပြုမည်
              </button>
            </div>
          </div>
        )}

        {/* ── Closed / success overlay ── */}
        {closed && (
          <div className="bh-fade" style={{
            position: 'absolute', inset: 0, zIndex: 60,
            background: 'var(--color-bg)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '40px 32px',
          }}>
            <div style={{ width: 84, height: 84, borderRadius: '999px', background: cl.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={cl.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ marginTop: 22, fontFamily: 'var(--font-burmese)', fontSize: 22, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)', maxWidth: 300 }}>
              {cl.title}
            </div>
            <div style={{ marginTop: 10, fontFamily: 'var(--font-burmese)', fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', maxWidth: 300 }}>
              {cl.body}
            </div>
            <div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.5, color: 'var(--text-hint)', maxWidth: 300 }}>
              {cl.bodyEn}
            </div>

            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              marginTop: 22, padding: '12px 14px',
              background: 'var(--surface-card)', border: '1px solid var(--border-card)',
              borderRadius: 12, maxWidth: 320, textAlign: 'left',
            }}>
              <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.5 21a1.7 1.7 0 0 1-3 0" />
                </svg>
              </span>
              <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                ကူညီမည် ဟု တုံ့ပြန်ထားသူများကိုသာ "မလိုတော့ပါ — ကျေးဇူးတင်ပါသည်" ဟု အကြောင်းကြားပါမည်။
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: 320, marginTop: 26 }}>
              <button
                type="button"
                onClick={() => { setClosed(null); setSheet(null); onGoHome() }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: 54, border: 'none',
                  borderRadius: 'var(--radius-button)',
                  background: 'var(--color-primary)', color: '#fff',
                  fontFamily: 'var(--font-burmese)', fontSize: 16, fontWeight: 600,
                  cursor: 'pointer', boxShadow: 'var(--shadow-cta)',
                }}
              >
                ပင်မသို့ ပြန်သွားရန်
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default RequestLive
