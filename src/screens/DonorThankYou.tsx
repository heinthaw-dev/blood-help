import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
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
  const altFont = lang === 'my' ? 'var(--font-sans)' : 'var(--font-burmese)'

  const t = {
    my: {
      headline: 'ကျေးဇူးတင်ပါတယ်!',
      headlineSub: 'Thank you!',
      subheadline: 'သင် တစ်စုံတစ်ဦး၏ အသက်ကို ကယ်တင်နိုင်ပါပြီ',
      subheadlineSub: 'You can now help save a life',
      bloodTypeLabel: 'သင့်သွေးအုပ်စု —',
      body: 'သွေးလှူရှင်အဖြစ် ပါဝင်ခဲ့သည့်အတွက် ကျေးဇူးအများကြီး တင်ပါသည်။ သင့်အနီးနားတွင် ကိုက်ညီသော သွေးအုပ်စု လိုအပ်သည့်အခါ ချက်ချင်း အကြောင်းကြားပေးပါမည်။',
      bodySub: "Thank you for joining as a blood donor. When someone nearby needs a matching blood type, we'll alert you right away.",
      cta: 'ပင်မသို့ ဆက်သွားရန်',
      ctaSub: 'Continue to home',
    },
    en: {
      headline: 'Thank You!',
      headlineSub: 'ကျေးဇူးတင်ပါတယ်!',
      subheadline: 'You can now help save a life',
      subheadlineSub: 'သင် တစ်စုံတစ်ဦး၏ အသက်ကို ကယ်တင်နိုင်ပါပြီ',
      bloodTypeLabel: 'Your blood type —',
      body: "Thank you for joining as a blood donor. When someone nearby needs a matching blood type, we'll alert you right away.",
      bodySub: 'သွေးလှူရှင်အဖြစ် ပါဝင်ခဲ့သည့်အတွက် ကျေးဇူးအများကြီး တင်ပါသည်။ သင့်အနီးနားတွင် ကိုက်ညီသော သွေးအုပ်စု လိုအပ်သည့်အခါ ချက်ချင်း အကြောင်းကြားပေးပါမည်။',
      cta: 'Continue to home',
      ctaSub: 'ပင်မသို့ ဆက်သွားရန်',
    },
  }

  const s = t[lang]

  return (
    <div className="phone-entry-stage">
    <div
      className="phone-entry-card"
      style={{ padding: '36px 28px 40px', fontFamily: bodyFont }}
    >
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 'none' }}>
        <svg width="18" height="22" viewBox="0 0 24 28" fill="none" style={{ display: 'block' }}>
          <path d="M12 1.5s9 9 9 15.5a9 9 0 0 1-18 0C3 10.5 12 1.5 12 1.5z" fill="var(--color-primary)" />
        </svg>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em', fontFamily: 'var(--font-sans)' }}>
          Blood Help
        </span>
      </div>

      {/* Main centered content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '12px 0 32px',
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
        <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-hint)', fontFamily: altFont }}>
          {s.headlineSub}
        </div>

        {/* Subheadline */}
        <p style={{ margin: '20px 0 0', fontFamily: bodyFont, fontSize: '18px', fontWeight: 500, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          {s.subheadline}
        </p>
        <div style={{ marginTop: '3px', fontSize: '13px', color: 'var(--text-hint)', fontFamily: altFont }}>
          {s.subheadlineSub}
        </div>

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
        <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.55, color: 'var(--text-hint)', maxWidth: '300px', fontFamily: altFont }}>
          {s.bodySub}
        </p>
      </div>

      {/* Primary CTA */}
      <div style={{ flex: 'none' }}>
        <Button type="button" fullWidth onClick={onContinue}>
          <span style={{ fontFamily: bodyFont }}>{s.cta}</span>
        </Button>
        <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '13px', color: 'var(--text-hint)', fontFamily: altFont }}>
          {s.ctaSub}
        </div>
      </div>
    </div>
    </div>
  )
}

export default DonorThankYou
