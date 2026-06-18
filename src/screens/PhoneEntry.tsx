import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button } from '../components/Button'

type Lang = 'my' | 'en'

const STRINGS: Record<Lang, { title: string; subtitle: string; cta: string; reassure: string }> = {
  my: {
    title: 'သင့်ဖုန်းနံပါတ်ကို ထည့်ပါ',
    subtitle:
      'ဝင်ရောက်ရန် ဂဏန်း ၆ လုံး ကုဒ်ကို SMS ဖြင့် ပို့ပေးပါမည် — စကားဝှက် မလိုအပ်ပါ။',
    cta: 'ကုဒ် ပို့ရန်',
    reassure:
      'သင့်နံပါတ်ကို အကောင့်ဝင်ရန်နှင့် သွေးလှူရှင်များ ဆက်သွယ်နိုင်ရန်အတွက်သာ အသုံးပြုပါမည်။',
  },
  en: {
    title: "What's your phone number?",
    subtitle: "We'll text you a 6-digit code to sign in — no password needed.",
    cta: 'Send code',
    reassure: 'Your number is only used to sign in and so donors can reach you.',
  },
}

interface PhoneEntryProps {
  /** Called with the normalized 9–13 digit national number when "Send code" is tapped. */
  onSend?: (digits: string) => void
}

/**
 * Phone Entry screen — pixel-faithful port of Phone Entry.dc.html from the
 * Blood Help Claude Design project. Dummy phone-OTP entry: enter a number,
 * send code. Default language is Burmese (my); a pill toggle switches to English.
 */
export function PhoneEntry({ onSend }: PhoneEntryProps) {
  const [lang, setLang] = useState<Lang>('my')
  const [phone, setPhone] = useState('')
  const [focus, setFocus] = useState(false)

  const isMy = lang === 'my'
  const burmeseFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'
  const copy = STRINGS[lang]

  const digits = phone.replace(/\D/g, '')
  const sendDisabled = digits.length < 9

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

  const titleStyle: CSSProperties = {
    margin: 0,
    fontFamily: burmeseFont,
    fontSize: '26px',
    fontWeight: 600,
    lineHeight: isMy ? 1.65 : 1.3,
    color: 'var(--text-primary)',
    letterSpacing: isMy ? 'normal' : '-0.01em',
  }
  const subtitleStyle: CSSProperties = {
    margin: '14px 0 0',
    fontFamily: burmeseFont,
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: isMy ? 1.8 : 1.5,
    color: 'var(--text-secondary)',
  }
  const inputStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: '52px',
    padding: '0 16px',
    background: '#fff',
    border: `1px solid ${focus ? 'var(--focus-ring)' : 'var(--border-field)'}`,
    borderRadius: 'var(--radius-input)',
    fontFamily: 'var(--font-sans)',
    fontSize: '16px',
    color: 'var(--text-primary)',
    outline: 'none',
    boxShadow: focus ? '0 0 0 3px var(--color-primary-wash)' : 'none',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
  }
  const reassureStyle: CSSProperties = {
    margin: '20px 0 0',
    fontFamily: burmeseFont,
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: isMy ? 1.8 : 1.5,
    color: 'var(--text-secondary)',
  }

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card">
        {/* top bar: wordmark + language toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 20px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="22" height="26" viewBox="0 0 24 28" fill="none" style={{ display: 'block' }}>
              <path
                d="M12 1.5s9 9 9 15.5a9 9 0 0 1-18 0C3 10.5 12 1.5 12 1.5z"
                fill="var(--color-primary)"
              />
            </svg>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              Blood Help
            </span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              background: '#fff',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-pill)',
              padding: 3,
              gap: 2,
            }}
          >
            <button type="button" onClick={() => setLang('my')} style={isMy ? activeTab : idleTab}>
              မြန်မာ
            </button>
            <button type="button" onClick={() => setLang('en')} style={isMy ? idleTab : activeTab}>
              ENG
            </button>
          </div>
        </div>

        {/* content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '40px 24px 28px',
          }}
        >
          <h1 style={titleStyle}>{copy.title}</h1>
          <p style={subtitleStyle}>{copy.subtitle}</p>

          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 52,
                  padding: '0 16px',
                  background: '#fff',
                  border: '1px solid var(--border-field)',
                  borderRadius: 'var(--radius-input)',
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  flex: 'none',
                }}
              >
                +95
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, '').slice(0, 13))}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                placeholder="9 7XX XXX XXX"
                style={inputStyle}
              />
            </div>

            <div style={{ marginTop: 24 }}>
              <Button fullWidth height={54} disabled={sendDisabled} onClick={() => onSend?.(digits)}>
                {copy.cta}
              </Button>
            </div>

            <p style={reassureStyle}>{copy.reassure}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhoneEntry
