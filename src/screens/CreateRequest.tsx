import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { BloodTypeSelector } from '../components/BloodTypeSelector'
import { ScreenHeader } from '../components/ScreenHeader'
import { LanguageToggle } from '../components/LanguageToggle'
import type { BloodType } from '../blood'
import { AlertDialog } from '../components/AlertDialog'
import { getCurrentPosition, coarsenCoordinates } from '../geolocation'
import type { Lang } from '../i18n'

type Urgency = 'urgent' | 'today'

/** The submitted request payload (location attached after GPS grant). */
export interface RequestDraft {
  bloodType: BloodType
  phone: string
  address: string
  units: number
  urgency: Urgency
  lat: number
  lng: number
}

interface CreateRequestProps {
  lang: Lang
  onLangChange: (lang: Lang) => void
  onBack: () => void
  /** Default contact number to prefill (the user's own callback phone). */
  defaultPhone?: string
  onPosted: (draft: RequestDraft) => void
}

type GeoPhase = 'idle' | 'prealert' | 'requesting' | 'denied'

export function CreateRequest({
  lang,
  onLangChange,
  onBack,
  defaultPhone = '',
  onPosted,
}: CreateRequestProps) {
  const [bloodType, setBloodType] = useState<BloodType | null>(null)
  const [phone, setPhone] = useState(defaultPhone)
  const [address, setAddress] = useState('')
  const [units, setUnits] = useState(1)
  const [urgency, setUrgency] = useState<Urgency>('urgent')
  const [geoPhase, setGeoPhase] = useState<GeoPhase>('idle')

  const isMy = lang === 'my'
  const bodyFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'
  const lh = isMy ? 1.75 : 1.5
  const postDisabled = !bloodType || phone.replace(/\D/g, '').length === 0 || address.trim().length === 0

  const strings = {
    my: {
      navTitle: 'သွေး တောင်းခံရန်',
      subtitle: 'ကိုက်ညီသော အနီးနားရှိ သွေးလှူရှင်များထံ ချက်ချင်း အကြောင်းကြားပေးပါမည်။',
      bloodTypeLabel: 'လိုအပ်သော သွေးအုပ်စု',
      phoneLabel: 'ဆက်သွယ်ရန် ဖုန်းနံပါတ်',
      phoneHint: 'သွေးလှူရှင်များက ဤနံပါတ်သို့ ဖုန်းဆက်ပါမည်။',
      addressLabel: 'လက်ရှိ တည်နေရာ',
      addressExample: 'ဥပမာ — ရန်ကုန် ဆေးရုံကြီး (သို့) စမ်းချောင်းမြို့နယ်',
      unitsLabel: 'လိုအပ်သော သွေးအိတ် အရေအတွက်',
      urgencyLabel: 'အရေးပေါ်ဆန်မှု',
      urgent: 'အရေးပေါ်',
      today: 'ယနေ့အတွင်း',
      cta: 'တောင်းခံချက် တင်ရန်',
      geoTitle: 'တည်နေရာ ခွင့်ပြုချက် လိုအပ်ပါသည်',
      geoMsg: 'အနီးနားရှိ သွေးလှူရှင်များကို ရှာရန် သင့်တည်နေရာ လိုအပ်ပါသည်။ နောက်တွင် ဘရောက်ဇာက မေးပါက “Allow / ခွင့်ပြုသည်” ကို နှိပ်ပါ။',
      geoConfirm: 'ဆက်လုပ်ရန်',
      geoCancel: 'မလုပ်တော့ပါ',
      geoLoading: 'သင့်တည်နေရာကို ရှာဖွေနေသည်...',
      deniedTitle: 'တည်နေရာ ပိတ်ထားသည်',
      deniedMsg: 'တည်နေရာ ခွင့်ပြုချက် မရှိဘဲ တောင်းခံချက် မတင်နိုင်ပါ။ ဘရောက်ဇာ ဆက်တင်တွင် တည်နေရာကို ဖွင့်ပြီး ထပ်ကြိုးစားပါ။',
      deniedConfirm: 'ရပါပြီ',
    },
    en: {
      navTitle: 'Request blood',
      subtitle: "We'll alert matching donors near you right away.",
      bloodTypeLabel: 'Blood type needed',
      phoneLabel: 'Contact number',
      phoneHint: 'Donors will call you on this number.',
      addressLabel: 'Current address',
      addressExample: 'E.g: Yangon Hospital (or) Sanchaung Township',
      unitsLabel: 'Units needed',
      urgencyLabel: 'Urgency',
      urgent: 'Urgent',
      today: 'Within today',
      cta: 'Post request',
      geoTitle: 'We need your location',
      geoMsg: 'To find donors near you, we need your location. When the browser asks next, tap “Allow”.',
      geoConfirm: 'Continue',
      geoCancel: 'Not now',
      geoLoading: 'Getting your location…',
      deniedTitle: 'Location is off',
      deniedMsg: "We can't post the request without location permission. Enable location in your browser settings and try again.",
      deniedConfirm: 'OK',
    },
  }
  const copy = strings[lang]

  const fieldLabelStyle: CSSProperties = {
    margin: 0,
    fontFamily: bodyFont,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: lh,
    color: 'var(--text-primary)',
  }
  const hintStyle: CSSProperties = {
    margin: '6px 0 0',
    fontFamily: bodyFont,
    fontSize: 13,
    fontWeight: 400,
    lineHeight: lh,
    color: 'var(--text-hint)',
  }

  const stepperBtn = (dimmed: boolean): CSSProperties => ({
    width: 44,
    height: 44,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    border: '1px solid var(--border-field)',
    borderRadius: 12,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: 22,
    fontWeight: 400,
    color: 'var(--text-primary)',
    lineHeight: 1,
    opacity: dimmed ? 0.35 : 1,
    transition: 'opacity 120ms ease',
  })

  const urgBtn = (selected: boolean): CSSProperties => ({
    flex: 1,
    height: 44,
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: bodyFont,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1,
    transition: 'background 120ms ease, color 120ms ease',
    background: selected ? 'var(--color-primary)' : 'transparent',
    color: selected ? '#fff' : 'var(--text-secondary)',
  })

  // Post → warn about location → native prompt → grant/deny.
  const handlePost = () => setGeoPhase('prealert')

  const requestLocation = async () => {
    setGeoPhase('requesting')
    const res = await getCurrentPosition()
    if (res.ok && bloodType) {
      setGeoPhase('idle')
      const { lat, lng } = coarsenCoordinates(res.lat, res.lng)
      onPosted({ bloodType, phone, address, units, urgency, lat, lng })
    } else {
      setGeoPhase('denied')
    }
  }

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card" style={{ height: '100dvh' }}>
        {/* Nav bar */}
        <ScreenHeader
          variant="nav"
          onBack={onBack}
          title={copy.navTitle}
          right={<LanguageToggle lang={lang} onChange={onLangChange} />}
          divider
        />

        {/* Scrollable form */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            padding: '20px 24px 0',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: bodyFont,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: lh,
              color: 'var(--text-secondary)',
            }}
          >
            {copy.subtitle}
          </p>

          {/* Blood type */}
          <div style={{ marginTop: 24 }}>
            <p style={fieldLabelStyle}>{copy.bloodTypeLabel}</p>
            <div style={{ marginTop: 10 }}>
              <BloodTypeSelector value={bloodType} onChange={setBloodType} />
            </div>
          </div>

          {/* Contact number */}
          <div style={{ marginTop: 24 }}>
            <p style={fieldLabelStyle}>{copy.phoneLabel}</p>
            <div style={{ marginTop: 10 }}>
              <Input
                prefix="+95"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <p style={hintStyle}>{copy.phoneHint}</p>
          </div>

          {/* Current address */}
          <div style={{ marginTop: 24 }}>
            <p style={fieldLabelStyle}>{copy.addressLabel}</p>
            <div style={{ marginTop: 10 }}>
              <Input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <p style={hintStyle}>{copy.addressExample}</p>
          </div>

          {/* Units stepper */}
          <div style={{ marginTop: 20 }}>
            <p style={fieldLabelStyle}>{copy.unitsLabel}</p>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 0 }}>
              <button
                type="button"
                onClick={() => setUnits((u) => Math.max(u - 1, 1))}
                style={stepperBtn(units === 1)}
              >
                −
              </button>
              <span
                style={{
                  minWidth: 52,
                  textAlign: 'center',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 22,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                }}
              >
                {units}
              </span>
              <button
                type="button"
                onClick={() => setUnits((u) => Math.min(u + 1, 10))}
                style={stepperBtn(units === 10)}
              >
                +
              </button>
            </div>
          </div>

          {/* Urgency segmented */}
          <div style={{ marginTop: 20 }}>
            <p style={fieldLabelStyle}>{copy.urgencyLabel}</p>
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                background: 'var(--surface-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-input)',
                padding: 4,
                gap: 4,
              }}
            >
              <button type="button" onClick={() => setUrgency('urgent')} style={urgBtn(urgency === 'urgent')}>
                {copy.urgent}
              </button>
              <button type="button" onClick={() => setUrgency('today')} style={urgBtn(urgency === 'today')}>
                {copy.today}
              </button>
            </div>
          </div>

          <div style={{ height: 24 }} />
        </div>

        {/* Sticky footer */}
        <div
          style={{
            flex: 'none',
            padding: '12px 24px 28px',
            background: 'var(--color-bg)',
            boxShadow: '0 -1px 0 var(--border-card)',
          }}
        >
          <Button
            fullWidth
            height={54}
            disabled={postDisabled || geoPhase === 'requesting'}
            onClick={handlePost}
          >
            {copy.cta}
          </Button>
        </div>

        {/* Loading overlay while GPS is pending — gives feedback during 'requesting'
            and has no button, so it cannot be double-tapped (preserves CR-03 intent) */}
        {geoPhase === 'requesting' && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: 24,
              background: 'rgba(26, 26, 26, 0.45)',
            }}
          >
            <div className="bh-spinner" />
            <p
              style={{
                margin: 0,
                fontFamily: bodyFont,
                fontSize: 16,
                fontWeight: 500,
                color: '#fff',
                textAlign: 'center',
              }}
            >
              {copy.geoLoading}
            </p>
          </div>
        )}

        {/* Pre-permission warning before the native location prompt */}
        {/* open only for 'prealert' — closes immediately when GPS request starts (CR-03) */}
        <AlertDialog
          open={geoPhase === 'prealert'}
          bodyFont={bodyFont}
          title={copy.geoTitle}
          message={copy.geoMsg}
          confirmLabel={copy.geoConfirm}
          cancelLabel={copy.geoCancel}
          onConfirm={requestLocation}
          onCancel={() => setGeoPhase('idle')}
        />

        {/* Permission denied / unavailable */}
        <AlertDialog
          open={geoPhase === 'denied'}
          bodyFont={bodyFont}
          title={copy.deniedTitle}
          message={copy.deniedMsg}
          confirmLabel={copy.deniedConfirm}
          onConfirm={() => setGeoPhase('idle')}
          onCancel={() => setGeoPhase('idle')}
        />
      </div>
    </div>
  )
}

export default CreateRequest
