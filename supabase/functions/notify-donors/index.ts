import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { initializeApp, cert, getApps } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'
import { getCorsHeaders } from '../_shared/cors.ts'
import { isValidUuid, isValidBloodType, isValidUrgency, sanitizeLength } from '../_shared/validate.ts'
import { pruneDeadTokens } from '../_shared/prune.ts'

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

serve(async (req) => {
  const CORS_HEADERS = getCorsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── JWT verification ───────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const authSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await authSupabase.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    const callerUid = user.id

    const { requestId, bloodType, lat, lng, urgency, address } = await req.json()

    // ── Input validation ────────────────────────────────────────────────────
    if (!isValidUuid(requestId)) {
      return new Response(JSON.stringify({ error: 'Invalid requestId' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }
    if (!isValidBloodType(bloodType)) {
      return new Response(JSON.stringify({ error: 'Invalid bloodType' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }
    if (!isValidUrgency(urgency)) {
      return new Response(JSON.stringify({ error: 'Invalid urgency' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      return new Response(JSON.stringify({ error: 'Invalid lat' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      return new Response(JSON.stringify({ error: 'Invalid lng' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }
    const safeAddress = sanitizeLength(address, 200)

    // ── Firebase init ───────────────────────────────────────────────────────
    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)
      initializeApp({ credential: cert(serviceAccount) })
    }

    // ── Service-role client for cross-user notification routing ──────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Ownership validation ────────────────────────────────────────────────
    const { data: requestRow, error: reqLookupErr } = await supabase
      .from('blood_requests')
      .select('requester_id')
      .eq('id', String(requestId))
      .single()
    if (reqLookupErr || !requestRow) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    if (requestRow.requester_id !== callerUid) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    console.log('[notify-donors] processing request, bloodType:', bloodType, 'urgency:', urgency)

    // donors_within_radius already filters is_available=true; returns profile_id + blood_type
    const { data: nearbyDonors } = await supabase.rpc('donors_within_radius', {
      lat,
      lng,
      radius_km: 10,
    })
    console.log('[notify-donors] nearby donors:', nearbyDonors?.length ?? 0)

    const compatibleTypes = COMPATIBLE_DONOR_TYPES[String(bloodType)] ?? []
    const targetProfileIds: string[] = (nearbyDonors ?? [])
      .filter((d: { blood_type: string }) => compatibleTypes.includes(d.blood_type))
      .map((d: { profile_id: string }) => d.profile_id)
    console.log('[notify-donors] compatible donors:', targetProfileIds.length)

    if (targetProfileIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_compatible_donors' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { data: tokenRows } = await supabase
      .from('device_tokens')
      .select('fcm_token')
      .in('profile_id', targetProfileIds)
    console.log('[notify-donors] device tokens:', tokenRows?.length ?? 0)

    const tokens: string[] = (tokenRows ?? [])
      .map((r: { fcm_token: string }) => r.fcm_token)
      .filter(Boolean)

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_device_tokens' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const deepLink =
      `/?fcm_type=donor_alert` +
      `&request_id=${encodeURIComponent(String(requestId))}` +
      `&blood_type=${encodeURIComponent(String(bloodType))}` +
      `&urgency=${encodeURIComponent(String(urgency ?? 'today'))}` +
      `&address=${encodeURIComponent(safeAddress)}`

    // Data-only message: no notification field so FCM does not auto-display a notification.
    // The SW's onBackgroundMessage handler builds the title/body from data and calls showNotification().
    // Sending both notification + onBackgroundMessage causes duplicate alerts on Android Chrome.
    const result = await getMessaging().sendEachForMulticast({
      tokens,
      data: {
        fcm_type: 'donor_alert',
        request_id: String(requestId),
        blood_type: String(bloodType),
        urgency: String(urgency ?? 'today'),
        address: safeAddress,
      },
      webpush: {
        fcmOptions: { link: deepLink },
      },
    })

    console.log('[notify-donors] FCM result — success:', result.successCount, 'failure:', result.failureCount)
    if (result.failureCount > 0) {
      console.warn('[notify-donors] failures:', result.failureCount)
      // Drop tokens FCM says are permanently dead. This replaces the client's
      // old delete-by-profile cleanup, which also wiped the user's other devices.
      await pruneDeadTokens(supabase, tokens, result.responses, '[notify-donors]')
    }
    return new Response(JSON.stringify({ sent: result.successCount, failed: result.failureCount }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch {
    console.error('[notify-donors] unexpected error')
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
