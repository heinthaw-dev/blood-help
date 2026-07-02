import { getToken } from 'firebase/messaging'
import { messaging, VAPID_KEY } from './firebase'
import { supabase } from './supabase'
import { clearDeferredInstallPrompt, getDeferredInstallPrompt } from './pwa'

export type PushResult = 'granted' | 'denied' | 'unsupported' | 'error'

/** Outcome of firing the captured Android install prompt. */
export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

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
    console.warn('[Push] unsupported — missing Notification/serviceWorker/PushManager')
    return 'unsupported'
  }

  try {
    console.log('[Push] requesting permission...')
    const permission = await Notification.requestPermission()
    console.log('[Push] permission result:', permission)
    if (permission !== 'granted') return 'denied'

    // Reuse the app's single (merged Firebase) service worker — do not register a second one.
    console.log('[Push] waiting for service worker...')
    const swReg = await navigator.serviceWorker.ready
    console.log('[Push] SW ready:', swReg.active?.scriptURL)

    console.log('[Push] getting FCM token (VAPID key present:', !!VAPID_KEY, ')...')
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })
    console.log('[Push] FCM token:', token ? token.slice(0, 20) + '…' : 'EMPTY')
    if (!token) return 'error'

    // Remove stale web tokens for this profile (e.g. token rotated after SW update).
    // Without this, sendEachForMulticast would deliver two notifications to the same device.
    await supabase
      .from('device_tokens')
      .delete()
      .eq('profile_id', profileId)
      .eq('platform', 'web')
      .neq('fcm_token', token)

    console.log('[Push] upserting token to device_tokens for profile:', profileId)
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        { profile_id: profileId, fcm_token: token, platform: 'web' },
        { onConflict: 'fcm_token' },
      )
    if (error) console.error('[Push] upsert failed:', error.message)
    else console.log('[Push] token saved successfully')

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
    console.log('[Push] no captured install prompt — install unavailable')
    return 'unavailable'
  }

  try {
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    console.log('[Push] Android install prompt outcome:', outcome)
    return outcome
  } finally {
    clearDeferredInstallPrompt()
  }
}
