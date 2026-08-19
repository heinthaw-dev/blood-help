import { useEffect, useState } from 'react'

/**
 * Pure PWA install / push-onboarding detection for the Blood Help app.
 *
 * iOS cannot receive FCM web push in a normal browser tab — the user must add
 * the app to their Home Screen and open it standalone first (iOS 16.4+). This
 * module detects where a given visitor is in that funnel so the UI can show the
 * single next step they need to take.
 *
 * Nothing here requests permission or triggers an install — it is detection
 * only. The captured Android install prompt is exposed via
 * {@link getDeferredInstallPrompt} for the later "enable" phase to consume.
 */

/** The one actionable step (if any) the current visitor should be shown. */
export type PwaState =
  | 'ios-open-in-safari' // iOS, but in Chrome/Firefox/etc — must switch to Safari to install
  | 'ios-add-to-home' // iOS Safari, not yet installed — show Add to Home Screen guidance
  | 'ios-enable-push' // iOS installed (standalone) but push not yet granted
  | 'android-enable-push' // Android/desktop, push supported, permission not yet asked
  | 'granted' // push already granted — nothing to prompt
  | 'android-install' // a beforeinstallprompt was captured — offer one-tap install
  | 'hidden' // no onboarding step applies (unsupported, already handled, or desktop)

/** `Notification.permission`, plus `'unsupported'` when the API is absent. */
export type NotifPermission = NotificationPermission | 'unsupported'

/** Snapshot of the visitor's PWA install / push capabilities. */
export interface PwaCapabilities {
  isIOS: boolean
  isIOSSafari: boolean
  isIOSNonSafari: boolean
  isStandalone: boolean
  canInstallAndroid: boolean
  notifPermission: NotifPermission
  state: PwaState
}

/**
 * The Android/Chromium `beforeinstallprompt` event. Not in the standard DOM lib,
 * so we declare the minimal shape we rely on and augment WindowEventMap below.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
    appinstalled: Event
  }
}

// ---------------------------------------------------------------------------
// Module-level install-prompt capture
//
// `beforeinstallprompt` fires once, early. If we only listened inside the hook's
// effect we would miss it before any component mounts. So we capture at import
// time and let hook instances subscribe to changes via `subscribers`.
// ---------------------------------------------------------------------------

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null
const subscribers = new Set<() => void>()

function notifySubscribers(): void {
  subscribers.forEach((fn) => fn())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop Chrome's default mini-infobar; we drive install from our own UI.
    event.preventDefault()
    deferredInstallPrompt = event
    console.log('[PWA] beforeinstallprompt captured — Android install available')
    notifySubscribers()
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    console.log('[PWA] appinstalled — clearing deferred prompt')
    notifySubscribers()
  })
}

/**
 * The captured Android install prompt, or `null` if none is available. The
 * install-action phase calls `.prompt()` on it; the event is single-use, so this
 * is the only handle to it once captured.
 */
export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredInstallPrompt
}

/**
 * Clear the captured install prompt after it has been fired. The event is
 * single-use — once `.prompt()` is called it cannot be reused, so we drop it and
 * notify subscribers (flipping `canInstallAndroid` to false). A later
 * `beforeinstallprompt` can re-arm it.
 */
export function clearDeferredInstallPrompt(): void {
  deferredInstallPrompt = null
  notifySubscribers()
}

// ---------------------------------------------------------------------------
// Pure detection
// ---------------------------------------------------------------------------

/** True on iPhone/iPad/iPod, including iPadOS 13+ which reports as MacIntel. */
function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** OS family a device token was registered from — stored on `device_tokens.platform`. */
export type DevicePlatform = 'ios' | 'android' | 'web'

/**
 * The OS family of the current device, for recording alongside an FCM token.
 *
 * Every row used to be written as the literal `'web'`, which made it impossible
 * to tell one of a user's devices from another when debugging why alerts were
 * not arriving. `'web'` is kept as the catch-all for desktop and anything
 * unrecognised, so the value stays truthful rather than guessing.
 */
export function detectPlatform(): DevicePlatform {
  if (detectIOS()) return 'ios'
  if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) return 'android'
  return 'web'
}

/** True when running as an installed PWA (standalone display mode). */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // `navigator.standalone` is a non-standard iOS Safari flag, absent from lib.dom.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Derive the single onboarding step to surface. Precedence, most-terminal first:
 *
 *  1. `granted` — push already works; nothing to prompt, regardless of platform.
 *  2. iOS funnel — must install via Safari, then enable push once standalone:
 *       not standalone + non-Safari → `ios-open-in-safari`
 *       not standalone + Safari     → `ios-add-to-home`
 *       standalone + no web push API (iOS < 16.4) → `hidden` (cannot push)
 *       standalone + not granted    → `ios-enable-push`
 *  3. Android/Chromium — a captured prompt + not installed → `android-install`
 *     (installing is the better first step; the install handler chains into the
 *     permission request afterwards). Otherwise, if push is supported and has
 *     not been asked for yet → `android-enable-push`.
 *  4. Otherwise `hidden` (permission denied, unsupported, or no step applies).
 *
 * Note that `granted` means "the OS permission is granted", NOT "alerts work" —
 * the FCM token can still be missing. Registering the token when a session
 * appears is App.tsx's job, not this hook's; this only decides what to *show*.
 */
function deriveState(caps: Omit<PwaCapabilities, 'state'>): PwaState {
  const { isIOS, isIOSNonSafari, isStandalone, canInstallAndroid, notifPermission } = caps

  if (notifPermission === 'granted') return 'granted'

  if (isIOS) {
    if (!isStandalone) return isIOSNonSafari ? 'ios-open-in-safari' : 'ios-add-to-home'
    if (notifPermission === 'unsupported') return 'hidden'
    return 'ios-enable-push'
  }

  if (notifPermission === 'unsupported') return 'hidden'

  if (canInstallAndroid && !isStandalone) return 'android-install'

  // Android/desktop with a usable Notification API that has not been asked yet.
  // Without this the only non-iOS nudge was 'android-install', which never
  // requested permission — so Android users had no path to a registered token.
  if (notifPermission === 'default') return 'android-enable-push'

  return 'hidden'
}

/** Compute a fresh capability snapshot from the current environment. */
function computeCapabilities(): PwaCapabilities {
  const isIOS = detectIOS()
  const isIOSNonSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent)
  const isIOSSafari = isIOS && !isIOSNonSafari
  const isStandalone = detectStandalone()
  const canInstallAndroid = deferredInstallPrompt !== null
  const notifPermission: NotifPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'

  const base = { isIOS, isIOSSafari, isIOSNonSafari, isStandalone, canInstallAndroid, notifPermission }
  return { ...base, state: deriveState(base) }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Reactive PWA capability snapshot. Recomputes when the install prompt is
 * captured/consumed, when the display mode flips (user launches the installed
 * app), and when the tab regains focus (the only chance to re-read
 * `Notification.permission`, which has no change event).
 */
export function usePwaState(): PwaCapabilities {
  const [caps, setCaps] = useState<PwaCapabilities>(computeCapabilities)

  useEffect(() => {
    const recompute = () => setCaps(computeCapabilities())

    // Catch a prompt captured between initial render and effect mount.
    recompute()
    subscribers.add(recompute)

    const displayModeMql = window.matchMedia('(display-mode: standalone)')
    displayModeMql.addEventListener('change', recompute)
    document.addEventListener('visibilitychange', recompute)
    window.addEventListener('focus', recompute)

    return () => {
      subscribers.delete(recompute)
      displayModeMql.removeEventListener('change', recompute)
      document.removeEventListener('visibilitychange', recompute)
      window.removeEventListener('focus', recompute)
    }
  }, [])

  return caps
}
