import { useState } from 'react'
import { PhoneEntry } from './screens/PhoneEntry'
import { OtpVerification } from './screens/OtpVerification'
import type { Lang } from './i18n'

type Screen = 'phone' | 'otp'

/** Format a national number for display under the +95 country code. */
function formatPhone(digits: string): string {
  return digits ? `+95 ${digits}` : '+95'
}

function App() {
  const [lang, setLang] = useState<Lang>('my')
  const [screen, setScreen] = useState<Screen>('phone')
  const [phone, setPhone] = useState('')

  if (screen === 'otp') {
    return (
      <OtpVerification
        phoneDisplay={formatPhone(phone)}
        lang={lang}
        onLangChange={setLang}
        onBack={() => setScreen('phone')}
        onVerified={(code) => {
          // Dummy flow: no real verification. Next phase wires the Supabase
          // anonymous session + profile, then navigates to the home screen.
          console.log('verified (dummy)', code)
        }}
      />
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
