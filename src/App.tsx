import { useState } from 'react'
import { PhoneEntry } from './screens/PhoneEntry'
import { OtpVerification } from './screens/OtpVerification'
import { IntentChoice } from './screens/IntentChoice'
import type { Intent } from './screens/IntentChoice'
import { CreateRequest } from './screens/CreateRequest'
import type { RequestDraft } from './screens/CreateRequest'
import { DonorProfileSetup } from './screens/DonorProfileSetup'
import type { DonorProfile } from './screens/DonorProfileSetup'
import { Button } from './components/Button'
import { hasLoggedInBefore, markLoggedIn } from './auth'
import type { Lang } from './i18n'

type Screen = 'phone' | 'otp' | 'intent' | 'home' | 'create-request' | 'donor-setup'

/** Format a national number for display under the +95 country code. */
function formatPhone(digits: string): string {
  return digits ? `+95 ${digits}` : '+95'
}

function App() {
  const [lang, setLang] = useState<Lang>('my')
  const [screen, setScreen] = useState<Screen>('phone')
  const [phone, setPhone] = useState('')

  const handleVerified = () => {
    // Dummy flow: no real verification. First-time numbers see Intent Choice;
    // returning numbers skip straight to home.
    const returning = hasLoggedInBefore(phone)
    markLoggedIn(phone)
    setScreen(returning ? 'home' : 'intent')
  }

  const handleChooseIntent = (intent: Intent) => {
    setScreen(intent === 'need' ? 'create-request' : 'donor-setup')
  }

  const handlePosted = (draft: RequestDraft) => {
    // Next phase: persist to Supabase + fan out push. For now, log and go home.
    console.log('request posted (dummy)', draft)
    setScreen('home')
  }

  const handleSaveDonor = (profile: DonorProfile) => {
    // Next phase: persist to Supabase profile. For now, log and go home.
    console.log('donor profile saved (dummy)', profile)
    setScreen('home')
  }

  if (screen === 'otp') {
    return (
      <OtpVerification
        phoneDisplay={formatPhone(phone)}
        lang={lang}
        onLangChange={setLang}
        onBack={() => setScreen('phone')}
        onVerified={handleVerified}
      />
    )
  }

  if (screen === 'intent') {
    return <IntentChoice lang={lang} onLangChange={setLang} onChoose={handleChooseIntent} />
  }

  if (screen === 'create-request') {
    return (
      <CreateRequest
        lang={lang}
        onLangChange={setLang}
        onBack={() => setScreen('home')}
        defaultPhone={phone}
        onPosted={handlePosted}
      />
    )
  }

  if (screen === 'donor-setup') {
    return (
      <DonorProfileSetup
        lang={lang}
        onLangChange={setLang}
        onBack={() => setScreen('home')}
        defaultPhone={phone}
        onSave={handleSaveDonor}
      />
    )
  }

  if (screen === 'home') {
    // Placeholder until the Home Screen phase. Lets returning-user and
    // post-intent navigation land somewhere real.
    return (
      <div className="phone-entry-stage">
        <div
          className="phone-entry-card"
          style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}
        >
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', margin: 0 }}>
            Home screen — coming next.
          </p>
          <Button onClick={() => setScreen('create-request')}>Request blood</Button>
          <Button variant="secondary" onClick={() => setScreen('donor-setup')}>
            Set up donor profile
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PhoneEntry
      lang={lang}
      onLangChange={setLang}
      onSend={(digits) => {
        setPhone(digits)
        setScreen('otp')
      }}
    />
  )
}

export default App
