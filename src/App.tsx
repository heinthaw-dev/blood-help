import { useState } from 'react'
import { PhoneEntry } from './screens/PhoneEntry'
import { OtpVerification } from './screens/OtpVerification'
import { IntentChoice } from './screens/IntentChoice'
import type { Intent } from './screens/IntentChoice'
import { hasLoggedInBefore, markLoggedIn } from './auth'
import type { Lang } from './i18n'

type Screen = 'phone' | 'otp' | 'intent' | 'home'

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
    // Next phase: route to the request flow ('need') or donor flow ('donate').
    console.log('intent (dummy)', intent)
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

  if (screen === 'home') {
    // Placeholder until the Home Screen phase. Lets returning-user and
    // post-intent navigation land somewhere real.
    return (
      <div className="phone-entry-stage">
        <div
          className="phone-entry-card"
          style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>
            Home screen — coming next.
          </p>
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
