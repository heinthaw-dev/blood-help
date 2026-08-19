import { getToken } from 'firebase/messaging'
import { messaging, VAPID_KEY } from './firebase'
import { supabase } from './supabase'
import { clearDeferredInstallPrompt, detectPlatform, getDeferredInstallPrompt } from './pwa'

export type PushResult = 'granted' | 'denied' | 'unsupported' | 'error'

/** Outcome of firing the captured Android install prompt. */
export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

/**
 * How long to wait for the service worker to reach "ready" before giving up.
 * `navigator.serviceWorker.ready` NEVER rejects — if the SW fails to install
 * (its CDN importScripts timed out, the script 404'd) the promise simply hangs
 * forever, freezing the enable button with no error. This bounds that wait.
 */
const SW_READY_TIMEOUT_MS = 10_000

/**
 * `navigator.serviceWorker.ready`, but it always settles. Resolves with the
 * registration, or `null` once {@link SW_READY_TIMEOUT_MS} elapses.
 */
async function serviceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS)
  })
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** True if this browser environment supports web push. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

/**
 * Request push permission and — ONLY if granted — register the FCM device token
 * against the app's existing service worker, then upsert it into device_tokens.
 *
 * Must be user-initiated (a tap): it may show the permission prompt, so never
 * call it on page load. Safe to call repeatedly — if permission is already
 * granted it silently re-registers (the token can rotate after an SW update)
 * without prompting.
 */
export async function enablePush(profileId: string): Promise<PushResult> {
  if (!pushSupported()) {
    if (import.meta.env.DEV) console.warn('[Push] unsupported — missing Notification/serviceWorker/PushManager')
    return 'unsupported'
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    // Reuse the app's single (merged Firebase) service worker — do not register a second one.
    const swReg = await serviceWorkerReady()
    if (!swReg) {
      console.error(`[Push] service worker not ready after ${SW_READY_TIMEOUT_MS}ms — cannot register token`)
      return 'error'
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })
    if (!token) return 'error'

    // NOTE: do NOT delete the profile's other rows here. A blanket
    // delete-by-profile removes the user's OTHER devices — an iPhone and an
    // Android phone on one account would ping-pong, each registration killing
    // the other. Re-registering the same device is already idempotent via
    // onConflict: 'fcm_token'; tokens orphaned by FCM rotation are pruned on
    // the send path, where FCM reports registration-token-not-registered
    // authoritatively.
    //
    // platform records which device this token belongs to. Rows written before
    // this existed all say 'web'; the upsert corrects them in place on the next
    // registration, which happens on every app open for a granted device.
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        { profile_id: profileId, fcm_token: token, platform: detectPlatform() },
        { onConflict: 'fcm_token' },
      )
    // A failed write means there is no token to send to — do not report success.
    if (error) {
      console.error('[Push] device_tokens upsert failed:', error.message)
      return 'error'
    }

    return 'granted'
  } catch (err) {
    console.error('[Push] registration failed:', err)
    return 'error'
  }
}

/**
 * Fire the Android/Chromium install prompt captured at import time by pwa.ts.
 * Returns 'unavailable' when no prompt was captured (iOS, already installed, or
 * the browser never offered one). The prompt is single-use, so it is cleared
 * afterwards — a fresh `beforeinstallprompt` may re-arm it later.
 */
export async function promptAndroidInstall(): Promise<InstallOutcome> {
  const deferred = getDeferredInstallPrompt()
  if (!deferred) {
    return 'unavailable'
  }

  try {
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (import.meta.env.DEV) console.log('[Push] Android install prompt outcome:', outcome)
    return outcome
  } finally {
    clearDeferredInstallPrompt()
  }
}
