import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Card } from '../components/Card'
import { ScreenHeader } from '../components/ScreenHeader'
import { LanguageToggle } from '../components/LanguageToggle'
import type { Lang } from '../i18n'

/** Which action the user picked to get started. They can do both later. */
export type Intent = 'need' | 'donate'

interface IntentChoiceProps {
  lang: Lang
  onLangChange: (lang: Lang) => void
  onChoose: (intent: Intent) => void
}

/**
 * Intent Choice screen — port of Intent Choice.dc.html. Shown only on a user's
 * first login. Two cards: "I need blood" / "I want to donate". The choice just
 * picks a starting point — both actions stay available later.
 */
export function IntentChoice({ lang, onLangChange, onChoose }: IntentChoiceProps) {
  const [hovered, setHovered] = useState<Intent | null>(null)

  const isMy = lang === 'my'
  const bodyFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'
  const lh = isMy ? 1.75 : 1.5

  const strings = {
    my: {
      title: 'အခု ဘာ လိုအပ်ပါသလဲ?',
      subtitle: 'နှစ်မျိုးလုံး နောက်မှ လုပ်နိုင်ပါသည် — ဒါက အစပြုရန်သာ ဖြစ်သည်။',
      card1Title: 'သွေး လိုအပ်နေပါသည်',
      card1Desc: 'အနီးနားရှိ သွေးလှူရှင်များကို အမြန်ရှာပါ။',
      card2Title: 'သွေး လှူချင်ပါသည်',
      card2Desc: 'အနီးနားက လိုအပ်သူတစ်ဦးကို ကူညီပါ။',
    },
    en: {
      title: 'What do you need right now?',
      subtitle: 'You can do both later — this just gets you started.',
      card1Title: 'I need blood.',
      card1Desc: 'Find donors near you, fast.',
      card2Title: 'I want to donate.',
      card2Desc: 'Help someone nearby when they need it.',
    },
  }
  const copy = strings[lang]

  const cardDynStyle = (id: Intent) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    cursor: 'pointer',
    transition: 'border-color 120ms ease, background 120ms ease, transform 120ms ease',
    userSelect: 'none' as const,
    transform: hovered === id ? 'scale(0.988)' : 'scale(1)',
    boxShadow: hovered === id ? 'none' : 'var(--shadow-soft)',
  })

  const iconContainerStyle: CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'var(--color-primary-tint)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
  const cardTitleStyle: CSSProperties = {
    margin: 0,
    fontFamily: bodyFont,
    fontSize: 17,
    fontWeight: 600,
    lineHeight: isMy ? 1.6 : 1.3,
    color: 'var(--text-primary)',
  }
  const cardDescStyle: CSSProperties = {
    margin: '5px 0 0',
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: isMy ? 1.7 : 1.5,
    color: 'var(--text-secondary)',
  }

  const chevron = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-hint)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card">
        {/* Top bar: wordmark + language toggle */}
        <ScreenHeader variant="brand" align="left" right={<LanguageToggle lang={lang} onChange={onLangChange} />} />

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '28px 24px 36px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: bodyFont,
              fontSize: 26,
              fontWeight: 600,
              lineHeight: isMy ? 1.55 : 1.3,
              color: 'var(--text-primary)',
              letterSpacing: isMy ? 'normal' : '-0.01em',
            }}
          >
            {copy.title}
          </h1>
          <p
            style={{
              margin: '14px 0 0',
              fontFamily: bodyFont,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: lh,
              color: 'var(--text-secondary)',
            }}
          >
            {copy.subtitle}
          </p>

          {/* Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 44 }}>
            {/* Card 1: I need blood */}
            <Card
              padding="lg"
              selected={hovered === 'need'}
              background={hovered === 'need' ? 'var(--color-primary-wash)' : '#fff'}
              role="button"
              tabIndex={0}
              onClick={() => onChoose('need')}
              onMouseEnter={() => setHovered('need')}
              onMouseLeave={() => setHovered(null)}
              style={cardDynStyle('need')}
            >
              <div style={iconContainerStyle}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block' }}
                >
                  <path d="M12 2.7s6 6 6 10.3a6 6 0 0 1-12 0c0-4.3 6-10.3 6-10.3z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={cardTitleStyle}>{copy.card1Title}</p>
                <p style={cardDescStyle}>{copy.card1Desc}</p>
              </div>
              {chevron}
            </Card>

            {/* Card 2: I want to donate */}
            <Card
              padding="lg"
              selected={hovered === 'donate'}
              background={hovered === 'donate' ? 'var(--color-primary-wash)' : '#fff'}
              role="button"
              tabIndex={0}
              onClick={() => onChoose('donate')}
              onMouseEnter={() => setHovered('donate')}
              onMouseLeave={() => setHovered(null)}
              style={cardDynStyle('donate')}
            >
              <div style={iconContainerStyle}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block' }}
                >
                  <path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" />
                  <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
                  <path d="m2 15 6 6" />
                  <path d="M19.5 8.5c.7-.7 1.5 1.6 0 5" />
                  <path d="M22 8c1.2-2.8-.1-7-4.4-7C14 1 12 3.5 12 5" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={cardTitleStyle}>{copy.card2Title}</p>
                <p style={cardDescStyle}>{copy.card2Desc}</p>
              </div>
              {chevron}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IntentChoice
