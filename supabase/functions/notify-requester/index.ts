import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { initializeApp, cert, getApps } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'
import { getCorsHeaders } from '../_shared/cors.ts'
import { isValidUuid, sanitizeLength } from '../_shared/validate.ts'

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

    const { requestId, responderId } = await req.json()

    // ── Input validation ────────────────────────────────────────────────────
    if (!isValidUuid(requestId)) {
      return new Response(JSON.stringify({ error: 'Invalid requestId' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }
    if (!isValidUuid(responderId)) {
      return new Response(JSON.stringify({ error: 'Invalid responderId' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    // ── Firebase init ───────────────────────────────────────────────────────
    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)
      initializeApp({ credential: cert(serviceAccount) })
    }

    // ── Service-role client ─────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Ownership validation: caller must be the responder ──────────────────
    if (String(responderId) !== callerUid) {
      return new Response(JSON.stringify({ error: 'Forbidden: responderId does not match authenticated user' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Verify a legitimate request_responses row exists linking this responder to this request.
    const { data: responseRow } = await supabase
      .from('request_responses')
      .select('id')
      .eq('request_id', String(requestId))
      .eq('responder_id', String(responderId))
      .eq('status', 'responding')
      .maybeSingle()
    if (!responseRow) {
      return new Response(JSON.stringify({ error: 'No matching response found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    console.log('[notify-requester] processing notification')

    // Only send notification for the very first "Will Help" response on this request
    const { count } = await supabase
      .from('request_responses')
      .select('*', { count: 'exact', head: true })
      .eq('request_id', String(requestId))
      .eq('status', 'responding')

    if (count !== 1) {
      return new Response(JSON.stringify({ sent: 0, reason: 'not_first' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { data: request } = await supabase
      .from('blood_requests')
      .select('requester_id')
      .eq('id', String(requestId))
      .single()
    console.log('[notify-requester] requester found:', !!request)

    if (!request) {
      return new Response(JSON.stringify({ error: 'request_not_found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Fetch responder name, phone, blood_type in parallel
    const [{ data: donorRow }, { data: profileRow }] = await Promise.all([
      supabase.from('donors').select('blood_type').eq('profile_id', String(responderId)).single(),
      supabase.from('profiles').select('name, phone').eq('id', String(responderId)).single(),
    ])

    const responderName = profileRow?.name ?? 'A donor'
    const responderBloodType = String(donorRow?.blood_type ?? '')
    const responderPhone = profileRow?.phone ?? ''
    console.log('[notify-requester] responder resolved')

    // Get the requester's most recently registered device token
    const { data: tokenRow } = await supabase
      .from('device_tokens')
      .select('fcm_token')
      .eq('profile_id', request.requester_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!tokenRow) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_token' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const deepLink =
      `/?fcm_type=requester_alert` +
      `&responder_name=${encodeURIComponent(sanitizeLength(responderName, 50))}` +
      `&responder_phone=${encodeURIComponent(sanitizeLength(responderPhone, 15))}` +
      `&responder_blood_type=${encodeURIComponent(sanitizeLength(responderBloodType, 5))}` +
      `&request_id=${encodeURIComponent(String(requestId))}`

    // Data-only message — see notify-donors for rationale (duplicate prevention).
    await getMessaging().send({
      token: tokenRow.fcm_token,
      data: {
        fcm_type: 'requester_alert',
        responder_name: sanitizeLength(responderName, 50),
        responder_phone: sanitizeLength(responderPhone, 15),
        responder_blood_type: sanitizeLength(responderBloodType, 5),
        request_id: String(requestId),
      },
      webpush: {
        fcmOptions: { link: deepLink },
      },
    })

    console.log('[notify-requester] FCM sent successfully')
    return new Response(JSON.stringify({ sent: 1 }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch {
    console.error('[notify-requester] unexpected error')
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
