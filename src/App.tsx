import { useState } from 'react'
import { PhoneEntry } from './screens/PhoneEntry'
import { OtpVerification } from './screens/OtpVerification'
import { IntentChoice } from './screens/IntentChoice'
import type { Intent } from './screens/IntentChoice'
import { CreateRequest } from './screens/CreateRequest'
import type { RequestDraft } from './screens/CreateRequest'
import { DonorProfileSetup } from './screens/DonorProfileSetup'
import type { DonorProfile } from './screens/DonorProfileSetup'
import { Profile } from './screens/Profile'
import { Leaderboard } from './screens/Leaderboard'
import { DonorCongrats } from './screens/DonorCongrats'
import { DonorThankYou } from './screens/DonorThankYou'
import { Home } from './screens/Home'
import { RequestLive } from './screens/RequestLive'
import type { Tab } from './components/BottomNav'
import { hasLoggedInBefore, markLoggedIn } from './auth'
import type { BloodType } from './blood'
import type { Lang } from './i18n'

type Screen =
  | 'phone'
  | 'otp'
  | 'intent'
  | 'home'
  | 'profile'
  | 'leaderboard'
  | 'create-request'
  | 'donor-setup'
  | 'donor-congrats'
  | 'donor-thankyou'
  | 'request-live'

/** Dummy user profile state until Supabase persistence lands. */
interface UserState {
  name: string
  bloodType: BloodType
  available: boolean
  showNumber: boolean
  emergencyCallable: boolean
  donationCount: number
  lastDonation: string | null
  donorSetupComplete: boolean
  donorCode: string
}

const DEFAULT_USER: UserState = {
  name: 'You',
  bloodType: 'O+',
  available: true,
  showNumber: false,
  emergencyCallable: false,
  donationCount: 0,
  lastDonation: null,
  donorSetupComplete: false,
  donorCode: 'K7M2Q',
}

/** Format a national number for display under the +95 country code. */
function formatPhone(digits: string): string {
  return digits ? `+95 ${digits}` : '+95'
}

function App() {
  const [lang, setLang] = useState<Lang>('my')
  const [screen, setScreen] = useState<Screen>('phone')
  const [phone, setPhone] = useState('')
  const [user, setUser] = useState<UserState>(DEFAULT_USER)
  const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null)

  const handleVerified = () => {
    // Dummy flow: no real verification. First-time numbers see Intent Choice;
    // returning numbers go to the Home feed.
    const returning = hasLoggedInBefore(phone)
    markLoggedIn(phone)
    setScreen(returning ? 'home' : 'intent')
  }

  const handleChooseIntent = (intent: Intent) => {
    setScreen(intent === 'need' ? 'create-request' : 'donor-setup')
  }

  const handlePosted = (draft: RequestDraft) => {
    // Next phase: persist to Supabase + fan out push. For now, open request session.
    console.log('request posted (dummy)', draft)
    setRequestDraft(draft)
    setScreen('request-live')
  }

  const handleSaveDonor = (profile: DonorProfile) => {
    // Next phase: persist to Supabase profile. For now, capture into local state.
    console.log('donor profile saved (dummy)', profile)
    setUser((u) => ({
      ...u,
      name: profile.name,
      bloodType: profile.bloodType,
      available: profile.available,
      showNumber: profile.showNumber,
      donorSetupComplete: true,
    }))
    setScreen('donor-thankyou')
  }

  const handleNavigate = (tab: Tab) => {
    if (tab === 'home') setScreen('home')
    else if (tab === 'profile') setScreen('profile')
    else if (tab === 'leaderboard') setScreen('leaderboard')
  }

  const handleLogout = () => {
    setUser(DEFAULT_USER)
    setPhone('')
    setScreen('phone')
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
        onBack={() => setScreen('profile')}
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
        onBack={() => setScreen('profile')}
        defaultPhone={phone}
        onSave={handleSaveDonor}
      />
    )
  }

  if (screen === 'donor-thankyou') {
    return (
      <DonorThankYou
        lang={lang}
        bloodType={user.bloodType}
        onContinue={() => setScreen('profile')}
      />
    )
  }

  if (screen === 'donor-congrats') {
    return (
      <DonorCongrats
        lang={lang}
        donationCount={user.donationCount}
        onDone={() => setScreen('profile')}
        onLeaderboard={() => setScreen('leaderboard')}
      />
    )
  }

  if (screen === 'request-live') {
    return (
      <RequestLive
        lang={lang}
        bloodType={requestDraft?.bloodType}
        unitsNeeded={requestDraft?.units}
        onBack={() => setScreen('home')}
        onGoHome={() => { setRequestDraft(null); setScreen('home') }}
      />
    )
  }

  if (screen === 'home') {
    return (
      <Home
        lang={lang}
        donorReady={user.donorSetupComplete}
        available={user.available}
        onAvailableChange={(v) => setUser((u) => ({ ...u, available: v }))}
        hasOpenRequest={requestDraft !== null}
        onRequestBlood={() => setScreen('create-request')}
        onViewRequest={() => setScreen('request-live')}
        onFinishSetup={() => setScreen('donor-setup')}
        onNavigate={handleNavigate}
      />
    )
  }

  if (screen === 'profile') {
    return (
      <Profile
        lang={lang}
        onLangChange={setLang}
        name={user.name}
        bloodType={user.bloodType}
        donationCount={user.donationCount}
        lastDonation={user.lastDonation}
        isDonor={user.donorSetupComplete}
        donorCode={user.donorCode}
        showCooldown={user.donationCount > 0}
        available={user.available}
        onAvailableChange={(v) => setUser((u) => ({ ...u, available: v }))}
        emergencyCallable={user.emergencyCallable}
        onEmergencyChange={(v) => setUser((u) => ({ ...u, emergencyCallable: v }))}
        onEditProfile={() => setScreen('donor-setup')}
        onRegisterDonor={() => setScreen('donor-setup')}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    )
  }

  if (screen === 'leaderboard') {
    return (
      <Leaderboard
        lang={lang}
        onNavigate={handleNavigate}
        userName={user.name}
        userBloodType={user.bloodType}
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
