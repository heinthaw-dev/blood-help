import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { BloodTypeSelector } from '../components/BloodTypeSelector'
import { Switch } from '../components/Switch'
import { ScreenHeader } from '../components/ScreenHeader'
import { LanguageToggle } from '../components/LanguageToggle'
import { AlertDialog } from '../components/AlertDialog'
import { getCurrentPosition, coarsenCoordinates } from '../geolocation'
import type { BloodType } from '../blood'
import type { Lang } from '../i18n'

/** The donor profile the user sets up. */
export interface DonorProfile {
  name: string
  bloodType: BloodType
  phone: string
  showNumber: boolean
  available: boolean
  /** Coarsened GPS latitude captured on Save (after AlertDialog pre-permission flow). */
  lat: number
  /** Coarsened GPS longitude captured on Save (after AlertDialog pre-permission flow). */
  lng: number
}

interface DonorProfileSetupProps {
  lang: Lang
  onLangChange: (lang: Lang) => void
  onBack: () => void
  /** Default contact number to prefill (the user's login phone). */
  defaultPhone?: string
  onSave: (profile: DonorProfile) => void
}

type GeoPhase = 'idle' | 'prealert' | 'requesting' | 'denied'

export function DonorProfileSetup({
  lang,
  onLangChange,
  onBack,
  defaultPhone = '',
  onSave,
}: DonorProfileSetupProps) {
  const [name, setName] = useState('')
  const [bloodType, setBloodType] = useState<BloodType | null>(null)
  const [phone, setPhone] = useState(defaultPhone)
  const [showNumber, setShowNumber] = useState(false)
  const [available, setAvailable] = useState(true)
  const [geoPhase, setGeoPhase] = useState<GeoPhase>('idle')

  const isMy = lang === 'my'
  const bodyFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'
  const lh = isMy ? 1.75 : 1.5
  const saveDisabled = !name.trim() || !bloodType || phone.replace(/\D/g, '').length === 0

  const strings = {
    my: {
      navTitle: 'သွေးလှူရှင် ပရိုဖိုင် ပြင်ဆင်ရန်',
      subtitle: 'အနီးနားတွင် သင့်သွေးအုပ်စု လိုအပ်သည့်အခါ အကြောင်းကြားနိုင်ရန်အတွက် ဖြစ်ပါသည်။',
      nameLabel: 'သင့်အမည်',
      namePlaceholder: 'ဥပမာ — မောင်မောင်',
      nameHint: 'သင်ကူညီသူများ မြင်ရပါမည်။',
      bloodTypeLabel: 'သင့်သွေးအုပ်စု',
      phoneLabel: 'ဆက်သွယ်ရန် ဖုန်းနံပါတ်',
      phoneHint: 'အကောင့်ဝင်ရန်နှင့် အကြောင်းကြားရန် အသုံးပြုပါမည်။',
      showNumberLabel: 'ကျွန်ုပ်၏ နံပါတ်ကို တောင်းခံသူများအား ပြသမည်',
      showNumberHint:
        'ဖွင့်ထားပါက — သွေးလိုအပ်သူများ သင့်ထံ တိုက်ရိုက် ဖုန်းဆက်နိုင်သည်။ ပိတ်ထားပါက — သင် အကြောင်းကြားချက် ရရှိပြီး ဖုန်းဆက်မည်/မဆက်မည် ရွေးချယ်နိုင်သည်။',
      availableLabel: 'သွေးလှူရန် အသင့်ရှိသည်',
      availableHint: 'သွေးမလှူနိုင်သည့်အခါ ဤခလုတ်ကို ပိတ်ထားနိုင်သည်။',
      cta: 'သိမ်းဆည်း၍ ဆက်လုပ်ရန်',
      geoTitle: 'တည်နေရာ ခွင့်ပြုချက် လိုအပ်ပါသည်',
      geoMsg: 'အနီးနားရှိ သွေးတောင်းခံမှုများ ပြသရန် သင့်တည်နေရာ လိုအပ်ပါသည်။ နောက်တွင် ဘရောက်ဇာက မေးပါက "Allow / ခွင့်ပြုသည်" ကို နှိပ်ပါ။',
      geoConfirm: 'ဆက်လုပ်ရန်',
      geoCancel: 'မလုပ်တော့ပါ',
      geoLoading: 'သင့်တည်နေရာကို ရှာဖွေနေသည်...',
      deniedTitle: 'တည်နေရာ ပိတ်ထားသည်',
      deniedMsg: 'တည်နေရာ ခွင့်ပြုချက် မရှိဘဲ ပရိုဖိုင် သိမ်းဆည်း၍ မရပါ။ ဘရောက်ဇာ ဆက်တင်တွင် တည်နေရာကို ဖွင့်ပြီး ထပ်ကြိုးစားပါ။',
      deniedConfirm: 'ရပါပြီ',
    },
    en: {
      navTitle: 'Set up your donor profile',
      subtitle: 'So we can alert you when someone nearby needs your blood type.',
      nameLabel: 'Your name',
      namePlaceholder: 'e.g. Aung Ko',
      nameHint: 'This is what people you help will see.',
      bloodTypeLabel: 'Your blood type',
      phoneLabel: 'Contact number',
      phoneHint: 'Used to sign you in and send you alerts.',
      showNumberLabel: 'Show my number to requesters',
      showNumberHint:
        'On — people who need blood can call you directly. Off — you get notified and choose whether to call.',
      availableLabel: 'Available to donate',
      availableHint: "Turn this off when you can't donate.",
      cta: 'Save & continue',
      geoTitle: 'We need your location',
      geoMsg: 'To show you nearby blood requests, we need your location. When the browser asks next, tap "Allow".',
      geoConfirm: 'Continue',
      geoCancel: 'Not now',
      geoLoading: 'Getting your location…',
      deniedTitle: 'Location is off',
      deniedMsg: "We can't save the profile without location permission. Enable location in your browser settings and try again.",
      deniedConfirm: 'OK',
    },
  }
  const copy = strings[lang]

  /** Open the pre-permission AlertDialog. Actual GPS request happens after user confirms. */
  const handleSave = () => {
    if (!bloodType || !name.trim() || phone.replace(/\D/g, '').length === 0) return
    setGeoPhase('prealert')
  }

  /** Called when user confirms in the pre-permission dialog. Requests GPS then saves. */
  const requestLocationAndSave = async () => {
    setGeoPhase('requesting')
    const res = await getCurrentPosition()
    if (res.ok && bloodType) {
      setGeoPhase('idle')
      const { lat, lng } = coarsenCoordinates(res.lat, res.lng)
      onSave({ name: name.trim(), bloodType, phone, showNumber, available, lat, lng })
    } else {
      // GPS denied or unavailable — show denied dialog, do NOT call onSave (D-12)
      setGeoPhase('denied')
    }
  }

  const fieldLabelStyle: CSSProperties = {
    margin: 0,
    fontFamily: bodyFont,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: lh,
    color: 'var(--text-primary)',
  }
  const toggleLabelStyle: CSSProperties = { ...fieldLabelStyle, flex: 1 }
  const hintStyle: CSSProperties = {
    margin: '6px 0 0',
    fontFamily: bodyFont,
    fontSize: 13,
    fontWeight: 400,
    lineHeight: lh,
    color: 'var(--text-hint)',
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
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '20px 24px 0' }}>
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

          {/* Name */}
          <div style={{ marginTop: 24 }}>
            <p style={fieldLabelStyle}>{copy.nameLabel}</p>
            <div style={{ marginTop: 10 }}>
              <Input
                placeholder={copy.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <p style={hintStyle}>{copy.nameHint}</p>
          </div>

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

          {/* Divider */}
          <div style={{ marginTop: 28, height: 1, background: 'var(--border-card)' }} />

          {/* Show number toggle */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <p style={toggleLabelStyle}>{copy.showNumberLabel}</p>
              <div style={{ flex: 'none', marginTop: 2 }}>
                <Switch checked={showNumber} onChange={setShowNumber} ariaLabel={copy.showNumberLabel} />
              </div>
            </div>
            <p style={hintStyle}>{copy.showNumberHint}</p>
          </div>

          {/* Available toggle */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <p style={toggleLabelStyle}>{copy.availableLabel}</p>
              <div style={{ flex: 'none', marginTop: 2 }}>
                <Switch checked={available} onChange={setAvailable} ariaLabel={copy.availableLabel} />
              </div>
            </div>
            <p style={hintStyle}>{copy.availableHint}</p>
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
            disabled={saveDisabled || geoPhase === 'requesting'}
            onClick={handleSave}
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
          onConfirm={requestLocationAndSave}
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

export default DonorProfileSetup
