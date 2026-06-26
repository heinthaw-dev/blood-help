import { getToken } from 'firebase/messaging'
import { messaging, VAPID_KEY } from './firebase'
import { supabase } from './supabase'

export type PushResult = 'granted' | 'denied' | 'unsupported' | 'error'

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
 * Request push notification permission, get the FCM device token, and upsert
 * it into device_tokens keyed on fcm_token (unique). Safe to call repeatedly —
 * silently re-registers if permission was already granted.
 */
export async function registerPushToken(profileId: string): Promise<PushResult> {
  if (!pushSupported()) {
    console.warn('[Push] unsupported — missing Notification/serviceWorker/PushManager')
    return 'unsupported'
  }

  try {
    console.log('[Push] requesting permission...')
    const permission = await Notification.requestPermission()
    console.log('[Push] permission result:', permission)
    if (permission !== 'granted') return 'denied'

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
