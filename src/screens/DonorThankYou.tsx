import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { ScreenHeader } from '../components/ScreenHeader'
import type { BloodType } from '../blood'
import type { Lang } from '../i18n'

export interface DonorThankYouProps {
  lang: Lang
  bloodType: BloodType
  onContinue: () => void
}

/**
 * Donor Thank You screen — shown immediately after a donor completes
 * registration. Confirms their blood type and explains they'll be alerted
 * for nearby compatible requests. Port of Donor Thank You.dc.html.
 */
export function DonorThankYou({ lang, bloodType, onContinue }: DonorThankYouProps) {
  const bodyFont = lang === 'my' ? 'var(--font-burmese)' : 'var(--font-sans)'

  const t = {
    my: {
      headline: 'ကျေးဇူးတင်ပါတယ်!',
      subheadline: 'သင် တစ်စုံတစ်ဦး၏ အသက်ကို ကယ်တင်နိုင်ပါပြီ',
      bloodTypeLabel: 'သင့်သွေးအုပ်စု —',
      body: 'သွေးလှူရှင်အဖြစ် ပါဝင်ခဲ့သည့်အတွက် ကျေးဇူးအများကြီး တင်ပါသည်။ သင့်အနီးနားတွင် ကိုက်ညီသော သွေးအုပ်စု လိုအပ်သည့်အခါ ချက်ချင်း အကြောင်းကြားပေးပါမည်။',
      cta: 'ပင်မသို့ ဆက်သွားရန်',
    },
    en: {
      headline: 'Thank You!',
      subheadline: 'You can now help save a life',
      bloodTypeLabel: 'Your blood type —',
      body: "Thank you for joining as a blood donor. When someone nearby needs a matching blood type, we'll alert you right away.",
      cta: 'Continue to home',
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

      {/* Main centered content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '12px 24px 32px',
        }}
      >
        {/* Heart icon */}
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '999px',
            background: 'var(--color-primary-tint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px',
            flex: 'none',
          }}
        >
          <svg
            width="44"
            height="44"
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
        <h1 style={{ margin: 0, fontFamily: bodyFont, fontSize: '32px', fontWeight: 600, lineHeight: 1.3, color: 'var(--text-primary)' }}>
          {s.headline}
        </h1>

        {/* Subheadline */}
        <p style={{ margin: '20px 0 0', fontFamily: bodyFont, fontSize: '18px', fontWeight: 500, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          {s.subheadline}
        </p>

        {/* Blood type badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '28px' }}>
          <span style={{ fontFamily: bodyFont, fontSize: '14px', color: 'var(--text-secondary)' }}>
            {s.bloodTypeLabel}
          </span>
          <Badge>{bloodType}</Badge>
        </div>

        {/* Warm message */}
        <p style={{ margin: '28px 0 0', fontFamily: bodyFont, fontSize: '15px', lineHeight: 1.75, color: 'var(--text-secondary)', maxWidth: '300px' }}>
          {s.body}
        </p>
      </div>

      {/* Primary CTA */}
      <div style={{ flex: 'none', padding: '0 24px 24px' }}>
        <Button type="button" fullWidth onClick={onContinue}>
          <span style={{ fontFamily: bodyFont }}>{s.cta}</span>
        </Button>
      </div>
    </div>
    </div>
  )
}

export default DonorThankYou
