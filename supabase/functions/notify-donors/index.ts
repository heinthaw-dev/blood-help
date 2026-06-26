import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { initializeApp, cert, getApps } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'

/** Which donor blood types can donate TO a given requester blood type (inverse of COMPATIBLE_REQUEST_TYPES). */
const COMPATIBLE_DONOR_TYPES: Record<string, string[]> = {
  'O-':  ['O-'],
  'O+':  ['O-', 'O+'],
  'A-':  ['O-', 'A-'],
  'A+':  ['O-', 'O+', 'A-', 'A+'],
  'B-':  ['O-', 'B-'],
  'B+':  ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { requestId, bloodType, lat, lng, urgency, address } = await req.json()

    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)
      initializeApp({ credential: cert(serviceAccount) })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    console.log('[notify-donors] payload:', { requestId, bloodType, lat, lng, urgency, address })

    // donors_within_radius already filters is_available=true; returns profile_id + blood_type
    const { data: nearbyDonors, error: rpcErr } = await supabase.rpc('donors_within_radius', {
      lat,
      lng,
      radius_km: 10,
    })
    console.log('[notify-donors] nearby donors (is_available=true):', nearbyDonors?.length ?? 0, rpcErr ? '| RPC error: ' + rpcErr.message : '')

    const compatibleTypes = COMPATIBLE_DONOR_TYPES[String(bloodType)] ?? []
    console.log('[notify-donors] compatible donor types for', bloodType, ':', compatibleTypes)
    const targetProfileIds: string[] = (nearbyDonors ?? [])
      .filter((d: { blood_type: string }) => compatibleTypes.includes(d.blood_type))
      .map((d: { profile_id: string }) => d.profile_id)
    console.log('[notify-donors] compatible nearby donor profile IDs:', targetProfileIds)

    if (targetProfileIds.length === 0) {
      console.log('[notify-donors] no compatible nearby donors — skipping FCM')
      return new Response(JSON.stringify({ sent: 0, reason: 'no_compatible_donors' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { data: tokenRows, error: tokenErr } = await supabase
      .from('device_tokens')
      .select('fcm_token')
      .in('profile_id', targetProfileIds)
    console.log('[notify-donors] device tokens found:', tokenRows?.length ?? 0, tokenErr ? '| error: ' + tokenErr.message : '')

    const tokens: string[] = (tokenRows ?? [])
      .map((r: { fcm_token: string }) => r.fcm_token)
      .filter(Boolean)

    if (tokens.length === 0) {
      console.log('[notify-donors] no device tokens registered — skipping FCM')
      return new Response(JSON.stringify({ sent: 0, reason: 'no_device_tokens' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const deepLink =
      `/?fcm_type=donor_alert` +
      `&request_id=${encodeURIComponent(String(requestId))}` +
      `&blood_type=${encodeURIComponent(String(bloodType))}` +
      `&urgency=${encodeURIComponent(String(urgency ?? 'today'))}` +
      `&address=${encodeURIComponent(String(address ?? ''))}`

    // Data-only message: no notification field so FCM does not auto-display a notification.
    // The SW's onBackgroundMessage handler builds the title/body from data and calls showNotification().
    // Sending both notification + onBackgroundMessage causes duplicate alerts on Android Chrome.
    console.log('[notify-donors] sending FCM to', tokens.length, 'token(s)...')
    const result = await getMessaging().sendEachForMulticast({
      tokens,
      data: {
        fcm_type: 'donor_alert',
        request_id: String(requestId),
        blood_type: String(bloodType),
        urgency: String(urgency ?? 'today'),
        address: String(address ?? ''),
      },
      webpush: {
        fcmOptions: { link: deepLink },
      },
    })

    console.log('[notify-donors] FCM result — success:', result.successCount, 'failure:', result.failureCount)
    result.responses.forEach((r, i) => {
      if (!r.success) console.warn('[notify-donors] token', i, 'failed:', r.error?.message)
    })
    return new Response(JSON.stringify({ sent: result.successCount, failed: result.failureCount }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-donors error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
