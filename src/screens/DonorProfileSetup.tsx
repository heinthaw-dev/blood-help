import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { BloodTypeSelector } from '../components/BloodTypeSelector'
import { Switch } from '../components/Switch'
import type { BloodType } from '../blood'
import type { Lang } from '../i18n'

/** The donor profile the user sets up. */
export interface DonorProfile {
  name: string
  bloodType: BloodType
  phone: string
  showNumber: boolean
  available: boolean
}

interface DonorProfileSetupProps {
  lang: Lang
  onLangChange: (lang: Lang) => void
  onBack: () => void
  /** Default contact number to prefill (the user's login phone). */
  defaultPhone?: string
  onSave: (profile: DonorProfile) => void
}

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
    },
  }
  const copy = strings[lang]

  const tabBase: CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1,
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    padding: '7px 12px',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
  }
  const activeTab: CSSProperties = { ...tabBase, background: 'var(--color-primary)', color: '#fff' }
  const idleTab: CSSProperties = { ...tabBase, background: 'transparent', color: 'var(--text-secondary)' }

  const fieldLabelStyle: CSSProperties = {
    margin: 0,
    fontFamily: bodyFont,
    fontSize: 15,
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
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border-card)',
          }}
        >
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              color: 'var(--text-primary)',
              padding: 0,
              marginRight: 8,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
              <line x1="19" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polyline
                points="12 19 5 12 12 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          <h2
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0 8px',
              margin: 0,
              fontFamily: bodyFont,
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.35,
              color: 'var(--text-primary)',
            }}
          >
            {copy.navTitle}
          </h2>
          <div
            style={{
              display: 'inline-flex',
              background: '#fff',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-pill)',
              padding: 3,
              gap: 2,
              flex: 'none',
            }}
          >
            <button type="button" onClick={() => onLangChange('my')} style={isMy ? activeTab : idleTab}>
              မြန်မာ
            </button>
            <button type="button" onClick={() => onLangChange('en')} style={isMy ? idleTab : activeTab}>
              ENG
            </button>
          </div>
        </div>

        {/* Scrollable form */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '20px 24px 0' }}>
          <p
            style={{
              margin: 0,
              fontFamily: bodyFont,
              fontSize: 15,
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
            disabled={saveDisabled}
            onClick={() => {
              if (bloodType) onSave({ name: name.trim(), bloodType, phone, showNumber, available })
            }}
          >
            {copy.cta}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DonorProfileSetup
